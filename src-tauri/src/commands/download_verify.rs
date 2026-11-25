//! Verifica d'integrità dei download di terze parti (archivi ed eseguibili che
//! poi estraiamo nella cartella di un gioco o lanciamo).
//!
//! Due strade:
//! - versione pinnata: lo SHA-256 atteso sta accanto all'URL e si confronta
//!   con i byte scaricati PRIMA di scrivere/estrarre qualunque cosa;
//! - URL che "galleggia" (es. OllamaSetup.exe, sempre l'ultima): un hash fisso
//!   è impossibile, quindi prima di eseguirlo si verifica la firma Authenticode
//!   di Windows e il nome del firmatario.

use sha2::{Digest, Sha256};
use std::path::Path;

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Normalizza un hash atteso: accetta il formato `sha256:<hex>` del campo
/// `digest` delle API GitHub e hex maiuscolo/minuscolo.
fn normalize_expected(expected: &str) -> String {
    let e = expected.trim();
    e.strip_prefix("sha256:").unwrap_or(e).to_ascii_lowercase()
}

/// Estrae lo SHA-256 dal campo `digest` di un asset GitHub (`"sha256:<64 hex>"`).
/// `None` se il campo manca, è di un altro algoritmo o non è un hex valido.
pub fn github_asset_sha256(digest: Option<&str>) -> Option<String> {
    let hex = digest?.trim().strip_prefix("sha256:")?;
    if hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(hex.to_ascii_lowercase())
    } else {
        None
    }
}

/// Confronta un digest SHA-256 già calcolato con quello atteso.
pub fn check_sha256_digest(actual: &[u8], expected: &str, what: &str) -> Result<(), String> {
    let actual_hex = to_hex(actual);
    if actual_hex == normalize_expected(expected) {
        Ok(())
    } else {
        Err(format!(
            "Verifica integrità fallita per {}: SHA-256 atteso {}, ottenuto {}. File scartato.",
            what,
            normalize_expected(expected),
            actual_hex
        ))
    }
}

/// Calcola lo SHA-256 di `bytes` e lo confronta con quello atteso.
pub fn verify_sha256(bytes: &[u8], expected: &str, what: &str) -> Result<(), String> {
    check_sha256_digest(&Sha256::digest(bytes), expected, what)
}

/// Esito di `Get-AuthenticodeSignature` nel formato `Status|Subject`.
/// Richiede `Status == Valid` e un CN del firmatario che inizi con `signer_cn`.
fn check_signature_line(line: &str, signer_cn: &str, what: &str) -> Result<(), String> {
    let line = line.trim();
    let (status, subject) = line.split_once('|').unwrap_or((line, ""));
    if status != "Valid" {
        return Err(format!(
            "Firma digitale di {} non valida (stato: {}). File scartato.",
            what,
            if status.is_empty() { "sconosciuto" } else { status }
        ));
    }
    let cn = subject
        .split(", ")
        .find_map(|part| part.strip_prefix("CN="))
        .unwrap_or("");
    if !cn.starts_with(signer_cn) {
        return Err(format!(
            "Firma digitale di {} valida ma del firmatario sbagliato ({}). File scartato.",
            what,
            if subject.is_empty() { "sconosciuto" } else { subject }
        ));
    }
    Ok(())
}

/// Verifica la firma Authenticode di un eseguibile Windows. Bloccante (avvia
/// PowerShell): dai contesti async chiamarla dentro `spawn_blocking`.
#[cfg(target_os = "windows")]
pub fn verify_authenticode(path: &Path, signer_cn: &str, what: &str) -> Result<(), String> {
    use super::process_util::no_window_command;
    // Percorso assoluto di PowerShell: niente risoluzione via PATH.
    let ps = std::env::var_os("SystemRoot")
        .map(|r| Path::new(&r).join(r"System32\WindowsPowerShell\v1.0\powershell.exe"))
        .filter(|p| p.exists())
        .unwrap_or_else(|| "powershell".into());
    // Il percorso passa da una variabile d'ambiente, non dentro lo script:
    // nessun problema di quoting o di iniezione.
    let out = no_window_command(ps)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$s = Get-AuthenticodeSignature -LiteralPath $env:GS_VERIFY_PATH; \"$($s.Status)|$($s.SignerCertificate.Subject)\"",
        ])
        .env("GS_VERIFY_PATH", path)
        .output()
        .map_err(|e| format!("Impossibile verificare la firma digitale di {}: {}", what, e))?;
    check_signature_line(&String::from_utf8_lossy(&out.stdout), signer_cn, what)
}

#[cfg(not(target_os = "windows"))]
pub fn verify_authenticode(path: &Path, _signer_cn: &str, what: &str) -> Result<(), String> {
    log::warn!(
        "Firma digitale di {} ({}) non verificata: Authenticode esiste solo su Windows",
        what,
        path.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // SHA-256("abc"), vettore di test FIPS 180-2.
    const ABC_SHA256: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    #[test]
    fn sha256_accetta_hash_giusto_in_ogni_formato() {
        assert!(verify_sha256(b"abc", ABC_SHA256, "test").is_ok());
        assert!(verify_sha256(b"abc", &ABC_SHA256.to_uppercase(), "test").is_ok());
        assert!(verify_sha256(b"abc", &format!("sha256:{}", ABC_SHA256), "test").is_ok());
    }

    #[test]
    fn sha256_rifiuta_hash_sbagliato_o_vuoto() {
        let err = verify_sha256(b"abd", ABC_SHA256, "test").unwrap_err();
        assert!(err.contains("Verifica integrità fallita"));
        assert!(verify_sha256(b"abc", "", "test").is_err());
    }

    #[test]
    fn digest_github() {
        let d = format!("sha256:{}", ABC_SHA256.to_uppercase());
        assert_eq!(github_asset_sha256(Some(&d)).as_deref(), Some(ABC_SHA256));
        assert_eq!(github_asset_sha256(None), None);
        assert_eq!(github_asset_sha256(Some("sha512:abcd")), None);
        assert_eq!(github_asset_sha256(Some("sha256:xyz")), None);
    }

    #[test]
    fn firma_authenticode() {
        let ok = "Valid|CN=Ollama Inc., O=Ollama Inc., L=Toronto, S=Ontario, C=CA\r\n";
        assert!(check_signature_line(ok, "Ollama", "x").is_ok());
        assert!(check_signature_line("NotSigned|", "Ollama", "x").is_err());
        assert!(check_signature_line("HashMismatch|CN=Ollama Inc.", "Ollama", "x").is_err());
        assert!(check_signature_line("Valid|CN=Evil Corp, O=Ollama", "Ollama", "x").is_err());
        assert!(check_signature_line("", "Ollama", "x").is_err());
    }
}
