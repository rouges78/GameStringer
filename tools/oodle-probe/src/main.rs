//! Decomprime i blocchi Oodle salvati da `ue-pak-extract-stringtables.js --raw`.
//!
//! Contesto (05/08/2026, American Arcadia): i testi del gioco stanno in CSV
//! per lingua (`TextLocalization/<lang>/L10N*.csv`) compressi Oodle dentro il
//! pak. Il gioco NON spedisce oo2core*.dll (Oodle statico nell'exe), quindi
//! niente caricamento del DLL di terzi: si usa `oozextract`, port MIT puro
//! Rust del decoder open-source ooz. Stessa via prevista per il reader
//! dell'app (unreal_localization.rs), qui provata da sola.
//!
//! Uso:  cargo run --release -- [cartella]     (default: estratti-arcadia)
//!
//! Prova di effetto: il totale decompresso deve combaciare col manifest e i
//! CSV devono mostrare testo leggibile — si stampano le prime righe.

use serde::Deserialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
struct Blocco {
    bin: String,
    #[serde(rename = "rawSize")]
    raw_size: usize,
    #[serde(rename = "uncompressedSize")]
    uncompressed_size: usize,
}

#[derive(Deserialize)]
struct Manifest {
    file: String,
    metodo: String,
    #[serde(rename = "uncompressedSize")]
    uncompressed_size: usize,
    blocks: Vec<Blocco>,
}

fn trova_manifest(dir: &Path, trovati: &mut Vec<PathBuf>) {
    let Ok(letti) = fs::read_dir(dir) else { return };
    for voce in letti.flatten() {
        let p = voce.path();
        if p.is_dir() {
            trova_manifest(&p, trovati);
        } else if p.to_string_lossy().ends_with(".oodle.json") {
            trovati.push(p);
        }
    }
}

fn decomprimi(manifest_path: &Path) -> Result<(PathBuf, usize), String> {
    let testo = fs::read_to_string(manifest_path).map_err(|e| e.to_string())?;
    let m: Manifest = serde_json::from_str(&testo).map_err(|e| e.to_string())?;
    let cartella = manifest_path.parent().unwrap_or(Path::new("."));

    let mut estratto = Vec::with_capacity(m.uncompressed_size);
    let mut ex = oozextract::Extractor::new();

    for b in &m.blocks {
        let raw = fs::read(cartella.join(&b.bin)).map_err(|e| format!("{}: {e}", b.bin))?;
        if raw.len() != b.raw_size {
            return Err(format!("{}: {} byte su disco, {} nel manifest", b.bin, raw.len(), b.raw_size));
        }
        let mut out = vec![0u8; b.uncompressed_size];
        match ex.read_from_slice(&raw, &mut out) {
            Ok(_) => estratto.extend_from_slice(&out),
            Err(e) => {
                // Blocco memorizzato raw (capita quando non comprime): copia
                // dichiarata, NON un ripiego muto — vale solo a parità di size.
                if b.raw_size == b.uncompressed_size {
                    estratto.extend_from_slice(&raw);
                } else {
                    return Err(format!("{}: oozextract: {e:?}", b.bin));
                }
            }
        }
    }

    if estratto.len() != m.uncompressed_size {
        return Err(format!(
            "totale {} byte, attesi {} — NON scrivo un file corrotto",
            estratto.len(),
            m.uncompressed_size
        ));
    }

    // <percorso>.oodle.json → <percorso>
    let dest = manifest_path.with_extension("").with_extension("");
    fs::write(&dest, &estratto).map_err(|e| e.to_string())?;
    Ok((dest, m.uncompressed_size))
}

fn main() {
    let radice = env::args().nth(1).unwrap_or_else(|| "estratti-arcadia".into());
    let mut manifest = Vec::new();
    trova_manifest(Path::new(&radice), &mut manifest);
    manifest.sort();

    if manifest.is_empty() {
        eprintln!("Nessun .oodle.json sotto {radice}/ — prima: node scripts/ue-pak-extract-stringtables.js <pak> --raw --filter ...");
        std::process::exit(2);
    }
    println!("🔧 {} manifest da decomprimere sotto {radice}/", manifest.len());

    let (mut ok, mut ko) = (0u32, 0u32);
    for mp in &manifest {
        match decomprimi(mp) {
            Ok((dest, size)) => {
                ok += 1;
                println!("   ✅ {} ({size} byte)", dest.display());
                // Prova di effetto sui CSV: testo vero, non conteggi.
                if dest.extension().is_some_and(|e| e.eq_ignore_ascii_case("csv")) {
                    if let Ok(dati) = fs::read(&dest) {
                        let testo = String::from_utf8_lossy(&dati);
                        for riga in testo.lines().take(3) {
                            let r: String = riga.chars().take(110).collect();
                            println!("      │ {r}");
                        }
                    }
                }
            }
            Err(e) => {
                ko += 1;
                println!("   ❌ {}: {e}", mp.display());
            }
        }
    }

    println!("\n📊 {ok} decompressi, {ko} falliti");
    if ko > 0 {
        std::process::exit(1);
    }
}
