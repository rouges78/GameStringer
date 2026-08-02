//! retoc wrapper — genera la coppia .utoc/.ucas che completa la TRIPLETTA.
//!
//! PERCHÉ ESISTE. Nei giochi UE5 IoStore (5.6+) un `_P.pak`
//! da solo NON viene montato: il motore lo ignora senza dire niente — il pak
//! esiste, la UI dice "patch installata", il gioco resta in lingua originale.
//! Serve la tripletta `_P.pak + _P.utoc + _P.ucas`. La coppia può essere
//! FITTIZIA (202+64 byte, zero asset): i .locres non sono asset, quindi
//! `retoc to-zen` produce una coppia vuota ma VALIDA, che rinominata col nome
//! base del pak lo fa montare. Misurato su un gioco reale il 02/08/2026: senza coppia
//! patch invisibile, con la coppia l'italiano è A SCHERMO.
//!
//! Il 02/08 pomeriggio la trappola si è mostrata due volte in un'ora: il
//! Rimuovi cancella la tripletta, l'apply ricreava SOLO il pak → orfano di
//! nuovo, e l'esperimento in gioco è stato invalidato senza nessun errore.
//! Da qui questo modulo: la coppia la scrive l'apply, non l'utente a mano.
//!
//! ⚠️ NOME ASSET (lezione repak, 02/08): l'asset GitHub di trumank si chiama
//! `retoc_cli-…` (con _cli), NON `retoc-…`. Con il nome sbagliato il download
//! darebbe 404 e — se il fallback fosse muto — torneremmo esattamente al pak
//! orfano. Qui il fallimento del download è un Err con le istruzioni.

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use super::process_util::no_window_command;
use reqwest::Client;
use zip::ZipArchive;

const RETOC_DOWNLOAD_URL: &str =
    "https://github.com/trumank/retoc/releases/latest/download/retoc_cli-x86_64-pc-windows-msvc.zip";

/// Versione container passata a `to-zen`. Misurata su un gioco UE5.6+ reale: UE5_7
/// produce una coppia che il gioco monta. Se un altro gioco la rifiutasse,
/// questo è il primo posto dove guardare — e il rifiuto si vedrà nei log,
/// perché la coppia mancante ora è un Err, non un silenzio.
const RETOC_CONTAINER_VERSION: &str = "UE5_7";

fn retoc_dir() -> PathBuf {
    dirs::data_dir()
        .or_else(dirs::config_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer")
        .join("tools")
        .join("retoc")
}

pub fn retoc_exe() -> PathBuf {
    retoc_dir().join("retoc.exe")
}

pub fn is_retoc_installed() -> bool {
    retoc_exe().exists()
}

pub async fn ensure_retoc() -> Result<PathBuf, String> {
    if is_retoc_installed() {
        return Ok(retoc_exe());
    }
    download_retoc().await
}

pub async fn download_retoc() -> Result<PathBuf, String> {
    let dir = retoc_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Cartella retoc: {}", e))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build().map_err(|e| e.to_string())?;

    let resp = client.get(RETOC_DOWNLOAD_URL).send().await
        .map_err(|e| format!("Connessione: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {} da {}", resp.status().as_u16(), RETOC_DOWNLOAD_URL));
    }
    let ct = resp.headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if ct.contains("text/html") {
        return Err("GitHub ha restituito HTML (404?)".to_string());
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() < 4 || &bytes[..4] != b"PK\x03\x04" {
        return Err("Non è uno ZIP valido".to_string());
    }

    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("ZIP: {}", e))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.mangled_name();
        let fname = name.file_name().unwrap_or_default().to_string_lossy().to_string();
        // Nome flessibile come per repak: l'eseguibile può stare in una
        // sottocartella e chiamarsi retoc.exe.
        if fname.starts_with("retoc") && fname.ends_with(".exe") {
            let dest = dir.join("retoc.exe");
            let mut out = fs::File::create(&dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
            log::info!("✅ retoc installato: {}", dest.display());
            return Ok(dest);
        }
    }
    Err("retoc.exe non trovato nello ZIP".to_string())
}

/// I percorsi della coppia accanto a un pak: `X_P.pak` → (`X_P.utoc`, `X_P.ucas`).
pub fn zen_pair_paths(pak_path: &Path) -> (PathBuf, PathBuf) {
    (pak_path.with_extension("utoc"), pak_path.with_extension("ucas"))
}

/// Genera la coppia .utoc/.ucas fittizia per `pak_path` e la scrive ACCANTO
/// al pak, con lo stesso nome base. Ritorna (utoc, ucas).
///
/// La generazione avviene in una cartella temporanea: `to-zen` produce anche
/// un pak di output, e NON deve toccare il nostro pak buono.
pub async fn write_zen_pair_for(pak_path: &Path) -> Result<(PathBuf, PathBuf), String> {
    let retoc = ensure_retoc().await.map_err(|e| format!(
        "retoc non disponibile ({}). Senza la coppia .utoc/.ucas il gioco IGNORA il pak \
         e la patch sembrerebbe installata ma non farebbe nulla. Rimedi: riprova con la \
         rete attiva, oppure scarica retoc_cli-x86_64-pc-windows-msvc.zip da \
         https://github.com/trumank/retoc/releases ed estrai retoc.exe in {} — se il \
         download viene bloccato, controlla antivirus/firewall.",
        e, retoc_dir().display()
    ))?;

    let tmp_dir = std::env::temp_dir().join(format!("gs_retoc_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()));
    fs::create_dir_all(&tmp_dir).map_err(|e| format!("Tmp dir retoc: {}", e))?;
    let tmp_utoc = tmp_dir.join("gs_dummy_P.utoc");

    let output = no_window_command(&retoc)
        .args([
            "to-zen",
            &pak_path.to_string_lossy(),
            &tmp_utoc.to_string_lossy(),
            "--version", RETOC_CONTAINER_VERSION,
        ])
        .output()
        .map_err(|e| format!("Esecuzione retoc: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = fs::remove_dir_all(&tmp_dir);
        return Err(format!("retoc exit {}: {}", output.status.code().unwrap_or(-1), stderr));
    }

    let tmp_ucas = tmp_utoc.with_extension("ucas");
    // Prova di effetto: "retoc è uscito 0" non basta. I file devono esistere
    // e avere una taglia plausibile (misurate sul campo: utoc 202, ucas 64).
    let utoc_len = fs::metadata(&tmp_utoc).map(|m| m.len()).unwrap_or(0);
    let ucas_len = fs::metadata(&tmp_ucas).map(|m| m.len()).unwrap_or(0);
    if utoc_len < 60 || ucas_len == 0 {
        let _ = fs::remove_dir_all(&tmp_dir);
        return Err(format!(
            "retoc ha terminato ma la coppia non è plausibile (utoc {} byte, ucas {} byte)",
            utoc_len, ucas_len
        ));
    }

    let (dest_utoc, dest_ucas) = zen_pair_paths(pak_path);
    fs::copy(&tmp_utoc, &dest_utoc).map_err(|e| format!("Copia utoc: {}", e))?;
    fs::copy(&tmp_ucas, &dest_ucas).map_err(|e| format!("Copia ucas: {}", e))?;
    let _ = fs::remove_dir_all(&tmp_dir);

    log::info!("📦 Coppia zen scritta: {} ({} B) + {} ({} B)",
        dest_utoc.display(), utoc_len, dest_ucas.display(), ucas_len);
    Ok((dest_utoc, dest_ucas))
}

#[cfg(test)]
mod tests {
    use super::zen_pair_paths;
    use std::path::Path;

    #[test]
    fn coppia_accanto_al_pak_con_lo_stesso_nome_base() {
        let (utoc, ucas) = zen_pair_paths(Path::new(
            r"C:\Giochi\MioGioco\Content\Paks\MioGioco_GameStringer_it_P.pak",
        ));
        assert!(utoc.to_string_lossy().ends_with("MioGioco_GameStringer_it_P.utoc"));
        assert!(ucas.to_string_lossy().ends_with("MioGioco_GameStringer_it_P.ucas"));
        assert_eq!(utoc.parent(), ucas.parent());
    }
}
