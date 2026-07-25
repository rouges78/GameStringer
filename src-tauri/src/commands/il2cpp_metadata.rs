//! Lettura READ-ONLY dell'header di `global-metadata.dat` (Unity IL2CPP).
//!
//! Non estrae né riscrive stringhe: legge solo i primi 8 byte del file di
//! metadata IL2CPP per (1) confermare che un gioco è davvero IL2CPP e (2)
//! ricavare la **versione di metadata**, che è ciò che determina se BepInEx
//! IL2CPP riesce ad agganciarsi — non la versione di Unity.
//!
//! Formato (invariato da anni, cfr. Il2CppDumper):
//!   offset 0: u32 magic  = 0xFAB11BAF  (su disco little-endian: AF 1B B1 FA)
//!   offset 4: i32 version (24, 27, 29, 31, …) — solo il "major"; le
//!             sotto-versioni (24.1, 24.2…) non stanno nell'header.

use std::path::{Path, PathBuf};

/// Magic dell'header global-metadata.dat.
pub const IL2CPP_METADATA_MAGIC: u32 = 0xFAB1_1BAF;

/// Versione di metadata più recente su cui il percorso BepInEx 6 IL2CPP
/// (v6.0.0-pre.2 + XUnity IL2CPP) è stato verificato funzionare.
///
/// - v24 → Unity 2019.3–2020.x · v27 → Unity 2021.x · v29 → Unity 2022.x
/// - v31 → Unity 2023 / Unity 6 → NON ancora agganciabile da BepInEx pre.2
///
/// Oltre questa soglia rifiutiamo l'installazione BepInEx e indirizziamo al
/// percorso asset (Unity CSV) o all'OCR, riportando la versione REALE invece
/// di indovinare dalla stringa "6000.x" di Unity.
pub const MAX_SUPPORTED_METADATA_VERSION: i32 = 29;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Il2CppMetadataInfo {
    /// Path del global-metadata.dat trovato.
    pub path: String,
    /// Versione major di metadata (dal campo header).
    pub version: i32,
    /// true se `version <= MAX_SUPPORTED_METADATA_VERSION`.
    pub bepinex_supported: bool,
}

/// Cerca `global-metadata.dat` sotto una directory di gioco Unity.
/// Percorso canonico: `<Game>_Data/il2cpp_data/Metadata/global-metadata.dat`,
/// ma la cartella `*_Data` ha nome variabile, quindi la scandiamo.
pub fn find_global_metadata(game_dir: &Path) -> Option<PathBuf> {
    // 1) Percorso diretto se qualcuno passa già la _Data
    let direct = game_dir
        .join("il2cpp_data")
        .join("Metadata")
        .join("global-metadata.dat");
    if direct.is_file() {
        return Some(direct);
    }

    // 2) Trova la cartella <nome>_Data e guarda dentro
    let entries = std::fs::read_dir(game_dir).ok()?;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() && p.file_name().map(|n| n.to_string_lossy().ends_with("_Data")).unwrap_or(false) {
            let candidate = p.join("il2cpp_data").join("Metadata").join("global-metadata.dat");
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Legge magic + versione dai primi 8 byte. Ritorna la versione se il magic è
/// valido; `None` se il file è troppo corto o il magic non corrisponde (quindi
/// non è un global-metadata.dat IL2CPP).
pub fn read_metadata_version(bytes: &[u8]) -> Option<i32> {
    if bytes.len() < 8 {
        return None;
    }
    let magic = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    if magic != IL2CPP_METADATA_MAGIC {
        return None;
    }
    let version = i32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]);
    Some(version)
}

/// Rileva e apre il metadata IL2CPP di un gioco, restituendo versione e verdetto
/// di supporto BepInEx. `None` se il gioco non è IL2CPP (nessun metadata valido).
pub fn detect_il2cpp_metadata(game_dir: &Path) -> Option<Il2CppMetadataInfo> {
    let path = find_global_metadata(game_dir)?;
    // Bastano 8 byte: leggiamo solo l'header, non l'intero file (può essere MB).
    let mut buf = [0u8; 8];
    {
        use std::io::Read;
        let mut f = std::fs::File::open(&path).ok()?;
        if f.read_exact(&mut buf).is_err() {
            return None;
        }
    }
    let version = read_metadata_version(&buf)?;
    Some(Il2CppMetadataInfo {
        path: path.to_string_lossy().to_string(),
        version,
        bepinex_supported: version <= MAX_SUPPORTED_METADATA_VERSION,
    })
}

/// Comando Tauri: ritorna versione metadata IL2CPP + verdetto BepInEx per un
/// gioco. `Ok(None)` = non è IL2CPP (o metadata non leggibile).
#[tauri::command]
pub async fn get_il2cpp_metadata_version(game_path: String) -> Result<Option<Il2CppMetadataInfo>, String> {
    let dir = Path::new(&game_path);
    if !dir.exists() {
        return Err(format!("Percorso non trovato: {}", game_path));
    }
    Ok(detect_il2cpp_metadata(dir))
}

// ─────────────────────────────────────────────────────────────────────────────
// Estrazione READ-ONLY delle string literal (ADR-003, blocco 1).
//
// Il testo hardcoded dei giochi IL2CPP vive nella `StringLiteral` table di
// `global-metadata.dat`, NON in un assembly .NET. Qui la leggiamo senza mai
// scrivere sul binario. Layout (stabile in tutte le versioni 24..=31, cfr.
// Il2CppDumper — sono i primi campi dell'header e non si sono mai spostati):
//
//   offset  8: u32 string_literal_offset       → inizio della tabella
//   offset 12: u32 string_literal_count         → DIMENSIONE IN BYTE della tabella
//   offset 16: u32 string_literal_data_offset   → inizio del blob dati
//   offset 20: u32 string_literal_data_count    → dimensione del blob dati
//
// Ogni entry della tabella è un `Il2CppStringLiteral` di 8 byte:
//   u32 length      (lunghezza in byte della stringa UTF-8)
//   u32 data_index  (offset della stringa RELATIVO a string_literal_data_offset)
// Numero di entry = string_literal_count / 8.
// ─────────────────────────────────────────────────────────────────────────────

/// Byte per entry `Il2CppStringLiteral` ({ u32 length; u32 data_index }).
const STRING_LITERAL_ENTRY_SIZE: usize = 8;

/// Byte minimi di header per contenere i 4 campi StringLiteral (fino a offset 24).
const HEADER_MIN_LEN: usize = 24;

/// Una string literal estratta dal metadata (read-only).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Il2CppStringLiteral {
    /// Indice progressivo nella tabella = l'ID usato dal bytecode IL2CPP.
    pub index: usize,
    /// Testo decodificato (UTF-8 lossy se il gioco contiene byte non validi).
    pub text: String,
    /// Lunghezza in byte dichiarata nell'entry.
    pub byte_len: u32,
    /// Euristica prudente: sembra testo mostrato all'utente (SUGGERIMENTO per la
    /// UI, non un filtro definitivo — cfr. `looks_translatable`).
    pub translatable: bool,
}

/// Legge un u32 little-endian a `off`, `None` se fuori dal buffer (mai panico).
fn read_u32_le(bytes: &[u8], off: usize) -> Option<u32> {
    let end = off.checked_add(4)?;
    let s = bytes.get(off..end)?;
    Some(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
}

/// Euristica prudente per distinguere il testo probabilmente mostrato
/// all'utente dagli identificatori interni (nomi di tipo/metodo, namespace,
/// path, format string). È solo un SUGGERIMENTO per ordinare/filtrare in UI:
/// non scarta nulla dall'estrazione, marca soltanto le entry.
fn looks_translatable(s: &str) -> bool {
    let t = s.trim();
    // Troppo corto o senza lettere → quasi mai testo utente.
    if t.chars().count() < 2 || !t.chars().any(|c| c.is_alphabetic()) {
        return false;
    }
    // Namespace/path tipici del runtime: non testo utente.
    if t.starts_with("System.")
        || t.starts_with("UnityEngine.")
        || t.starts_with("Microsoft.")
        || t.contains('/')
        || t.contains('\\')
    {
        return false;
    }
    // Uno spazio è un forte indizio di frase; altrimenti, se è un puro
    // identificatore C# (lettere/cifre/_/./<>/`) lo consideriamo interno.
    let has_space = t.chars().any(|c| c.is_whitespace());
    let looks_identifier = t
        .chars()
        .all(|c| c.is_alphanumeric() || matches!(c, '_' | '.' | '<' | '>' | '`'));
    has_space || !looks_identifier
}

/// Estrae TUTTE le string literal da un buffer completo di `global-metadata.dat`.
///
/// READ-ONLY: non modifica nulla. Ritorna `Err` solo se il buffer non è un
/// metadata IL2CPP valido o se i campi header puntano fuori dal file; le singole
/// entry malformate (offset/lunghezza incoerenti) vengono **saltate**, mai un
/// panico né una lettura fuori range.
pub fn extract_string_literals(bytes: &[u8]) -> Result<Vec<Il2CppStringLiteral>, String> {
    // 1) magic + versione: se falliscono, non è un metadata IL2CPP.
    let version = read_metadata_version(bytes).ok_or_else(|| {
        "Non è un global-metadata.dat IL2CPP valido (magic errato o file troppo corto)".to_string()
    })?;
    if bytes.len() < HEADER_MIN_LEN {
        return Err(format!(
            "Header troppo corto ({} byte) per contenere i campi StringLiteral (metadata v{})",
            bytes.len(),
            version
        ));
    }

    // 2) campi header della StringLiteral table + blob dati.
    let table_off = read_u32_le(bytes, 8).ok_or("header troncato (string_literal_offset)")? as usize;
    let table_size = read_u32_le(bytes, 12).ok_or("header troncato (string_literal_count)")? as usize;
    let data_off = read_u32_le(bytes, 16).ok_or("header troncato (data_offset)")? as usize;
    let data_size = read_u32_le(bytes, 20).ok_or("header troncato (data_count)")? as usize;

    // 3) i range di tabella e blob devono stare dentro il file.
    let table_end = table_off.checked_add(table_size).ok_or("overflow offset tabella")?;
    let data_end = data_off.checked_add(data_size).ok_or("overflow offset blob dati")?;
    if table_end > bytes.len() || data_end > bytes.len() {
        return Err(format!(
            "Offset StringLiteral fuori dal file (len={}, tabella={}..{}, blob={}..{}) — metadata v{} corrotto o non standard",
            bytes.len(), table_off, table_end, data_off, data_end, version
        ));
    }

    // 4) itera le entry (count = dimensione tabella / 8), saltando le corrotte.
    let count = table_size / STRING_LITERAL_ENTRY_SIZE;
    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        let entry_off = table_off + i * STRING_LITERAL_ENTRY_SIZE;
        let (len, data_index) = match (read_u32_le(bytes, entry_off), read_u32_le(bytes, entry_off + 4)) {
            (Some(l), Some(d)) => (l as usize, d as usize),
            _ => continue,
        };
        // La stringa vive a data_off + data_index, per `len` byte, dentro il blob.
        let s_start = match data_off.checked_add(data_index) {
            Some(v) => v,
            None => continue,
        };
        let s_end = match s_start.checked_add(len) {
            Some(v) => v,
            None => continue,
        };
        if s_end > data_end {
            // entry incoerente: la salto invece di leggere fuori dal blob.
            continue;
        }
        let text = String::from_utf8_lossy(&bytes[s_start..s_end]).into_owned();
        let translatable = looks_translatable(&text);
        out.push(Il2CppStringLiteral {
            index: i,
            text,
            byte_len: len as u32,
            translatable,
        });
    }
    Ok(out)
}

/// Risultato dell'estrazione string literal per un gioco.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Il2CppStringLiteralsResult {
    /// Path del global-metadata.dat letto.
    pub path: String,
    /// Versione major di metadata.
    pub version: i32,
    /// Totale string literal estratte (prima di filtro/limite).
    pub total: usize,
    /// Numero effettivamente restituito (dopo filtro/limite).
    pub returned: usize,
    /// Le string literal (eventualmente filtrate/troncate).
    pub literals: Vec<Il2CppStringLiteral>,
}

/// Comando Tauri: estrae le string literal dal metadata IL2CPP di un gioco.
/// `Ok(None)` = il gioco non è IL2CPP (nessun global-metadata.dat).
///
/// - `only_translatable`: se `true`, tiene solo le entry marcate dall'euristica.
/// - `limit`: tetto opzionale al numero di entry restituite (per la UI).
///
/// READ-ONLY: legge il file, non lo modifica mai.
#[tauri::command]
pub async fn get_il2cpp_string_literals(
    game_path: String,
    limit: Option<usize>,
    only_translatable: Option<bool>,
) -> Result<Option<Il2CppStringLiteralsResult>, String> {
    let dir = Path::new(&game_path);
    if !dir.exists() {
        return Err(format!("Percorso non trovato: {}", game_path));
    }
    let meta_path = match find_global_metadata(dir) {
        Some(p) => p,
        None => return Ok(None), // non è IL2CPP
    };
    let bytes = std::fs::read(&meta_path)
        .map_err(|e| format!("Lettura di {}: {}", meta_path.display(), e))?;
    let version = read_metadata_version(&bytes)
        .ok_or_else(|| "global-metadata.dat trovato ma header non valido".to_string())?;

    let mut literals = extract_string_literals(&bytes)?;
    let total = literals.len();
    if only_translatable.unwrap_or(false) {
        literals.retain(|l| l.translatable);
    }
    if let Some(lim) = limit {
        literals.truncate(lim);
    }
    let returned = literals.len();

    Ok(Some(Il2CppStringLiteralsResult {
        path: meta_path.to_string_lossy().to_string(),
        version,
        total,
        returned,
        literals,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header(magic: u32, version: i32) -> Vec<u8> {
        let mut v = Vec::new();
        v.extend_from_slice(&magic.to_le_bytes());
        v.extend_from_slice(&version.to_le_bytes());
        v
    }

    #[test]
    fn reads_valid_version() {
        let buf = header(IL2CPP_METADATA_MAGIC, 29);
        assert_eq!(read_metadata_version(&buf), Some(29));
    }

    #[test]
    fn rejects_bad_magic() {
        let buf = header(0x1234_5678, 29);
        assert_eq!(read_metadata_version(&buf), None);
    }

    #[test]
    fn rejects_short_buffer() {
        assert_eq!(read_metadata_version(&[0xAF, 0x1B, 0xB1]), None);
    }

    #[test]
    fn magic_on_disk_is_little_endian() {
        // I primi byte su disco devono essere AF 1B B1 FA.
        let buf = header(IL2CPP_METADATA_MAGIC, 24);
        assert_eq!(&buf[0..4], &[0xAF, 0x1B, 0xB1, 0xFA]);
    }

    #[test]
    fn support_ceiling_flags_unity6_metadata() {
        // v29 (Unity 2022) supportato; v31 (Unity 6) no.
        assert!(29 <= MAX_SUPPORTED_METADATA_VERSION);
        assert!(31 > MAX_SUPPORTED_METADATA_VERSION);
    }

    #[test]
    fn detect_reads_from_data_folder() {
        let tmp = tempfile::TempDir::new().unwrap();
        let meta_dir = tmp.path().join("MyGame_Data").join("il2cpp_data").join("Metadata");
        std::fs::create_dir_all(&meta_dir).unwrap();
        std::fs::write(meta_dir.join("global-metadata.dat"), header(IL2CPP_METADATA_MAGIC, 27)).unwrap();

        let info = detect_il2cpp_metadata(tmp.path()).expect("metadata IL2CPP non rilevato");
        assert_eq!(info.version, 27);
        assert!(info.bepinex_supported);
    }

    #[test]
    fn detect_none_when_not_il2cpp() {
        let tmp = tempfile::TempDir::new().unwrap();
        std::fs::create_dir_all(tmp.path().join("MyGame_Data")).unwrap();
        assert!(detect_il2cpp_metadata(tmp.path()).is_none());
    }

    // ── Estrazione string literal (ADR-003 blocco 1) ─────────────────────────

    /// Costruisce un `global-metadata.dat` sintetico con solo l'header + la
    /// StringLiteral table + il blob dati (i campi non usati restano 0).
    /// Layout: header 24B → table (8B/entry) → data blob.
    fn build_metadata(version: i32, strings: &[&str]) -> Vec<u8> {
        let table_off = HEADER_MIN_LEN; // 24
        let table_size = strings.len() * STRING_LITERAL_ENTRY_SIZE;
        let data_off = table_off + table_size;

        let mut blob: Vec<u8> = Vec::new();
        let mut entries: Vec<(u32, u32)> = Vec::new(); // (len, data_index)
        for s in strings {
            let idx = blob.len() as u32;
            let b = s.as_bytes();
            entries.push((b.len() as u32, idx));
            blob.extend_from_slice(b);
        }

        let mut out: Vec<u8> = Vec::new();
        out.extend_from_slice(&IL2CPP_METADATA_MAGIC.to_le_bytes()); // 0
        out.extend_from_slice(&version.to_le_bytes()); // 4
        out.extend_from_slice(&(table_off as u32).to_le_bytes()); // 8
        out.extend_from_slice(&(table_size as u32).to_le_bytes()); // 12
        out.extend_from_slice(&(data_off as u32).to_le_bytes()); // 16
        out.extend_from_slice(&(blob.len() as u32).to_le_bytes()); // 20
        assert_eq!(out.len(), HEADER_MIN_LEN, "header deve essere 24 byte");
        for (len, idx) in &entries {
            out.extend_from_slice(&len.to_le_bytes());
            out.extend_from_slice(&idx.to_le_bytes());
        }
        out.extend_from_slice(&blob);
        out
    }

    #[test]
    fn extracts_literals_in_order() {
        let buf = build_metadata(29, &["Hello world", "Premi E per aprire", "Assembly-CSharp"]);
        let lits = extract_string_literals(&buf).expect("estrazione fallita");
        assert_eq!(lits.len(), 3);
        assert_eq!(lits[0].index, 0);
        assert_eq!(lits[0].text, "Hello world");
        assert_eq!(lits[1].text, "Premi E per aprire");
        assert_eq!(lits[2].text, "Assembly-CSharp");
        assert_eq!(lits[0].byte_len, "Hello world".len() as u32);
    }

    #[test]
    fn handles_multibyte_utf8() {
        let buf = build_metadata(24, &["Città èàù 日本語"]);
        let lits = extract_string_literals(&buf).expect("estrazione fallita");
        assert_eq!(lits.len(), 1);
        assert_eq!(lits[0].text, "Città èàù 日本語");
        // byte_len è in byte, non in caratteri.
        assert_eq!(lits[0].byte_len, "Città èàù 日本語".len() as u32);
    }

    #[test]
    fn translatable_heuristic_flags_sentences_not_identifiers() {
        let buf = build_metadata(
            29,
            &["Press any key to continue", "System.Int32", "PlayerController", "Assets/UI/Menu.prefab"],
        );
        let lits = extract_string_literals(&buf).unwrap();
        assert!(lits[0].translatable, "una frase con spazi deve essere translatable");
        assert!(!lits[1].translatable, "un namespace System.* no");
        assert!(!lits[2].translatable, "un identificatore CamelCase no");
        assert!(!lits[3].translatable, "un path asset no");
    }

    #[test]
    fn rejects_non_il2cpp_buffer() {
        assert!(extract_string_literals(&[0x00, 0x11, 0x22, 0x33, 0, 0, 0, 0]).is_err());
    }

    #[test]
    fn errors_when_offsets_point_outside_file() {
        let mut buf = build_metadata(29, &["ok"]);
        // Sposta data_offset (offset 16) oltre la fine del file.
        let bogus = (buf.len() as u32 + 9_999).to_le_bytes();
        buf[16..20].copy_from_slice(&bogus);
        assert!(extract_string_literals(&buf).is_err());
    }

    #[test]
    fn skips_corrupt_entry_without_panic() {
        // Due entry: la seconda ha un data_index che sfora il blob → va saltata.
        let mut buf = build_metadata(29, &["good", "bad"]);
        // La seconda entry inizia a table_off + 8; il suo data_index è a +12..+16.
        let idx_field = HEADER_MIN_LEN + STRING_LITERAL_ENTRY_SIZE + 4;
        buf[idx_field..idx_field + 4].copy_from_slice(&999_999u32.to_le_bytes());
        let lits = extract_string_literals(&buf).expect("non deve andare in errore globale");
        // La prima resta, la corrotta è saltata: nessun panico, nessun crash.
        assert_eq!(lits.len(), 1);
        assert_eq!(lits[0].text, "good");
    }

    #[test]
    fn table_size_not_multiple_of_entry_is_truncated() {
        // count = table_size / 8 tronca: un table_size "sporco" non deve panicare.
        let mut buf = build_metadata(29, &["a", "b"]);
        // string_literal_count è a offset 12; era 16 (2*8) → mettiamo 20 (non /8).
        buf[12..16].copy_from_slice(&20u32.to_le_bytes());
        // Ora table_end = 24 + 20 = 44 potrebbe sforare: se sfora, è Err (accettabile);
        // se non sfora, non deve panicare. In entrambi i casi: nessun panico.
        let _ = extract_string_literals(&buf);
    }

    #[test]
    fn empty_table_yields_no_literals() {
        let buf = build_metadata(29, &[]);
        let lits = extract_string_literals(&buf).expect("tabella vuota è valida");
        assert!(lits.is_empty());
    }
}
