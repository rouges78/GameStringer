//! Sonda per `capture_window`: cattura una finestra per titolo e salva un PNG.
//!
//! Perché esiste (22/08/2026). `capture_window` copiava dal DC dello schermo
//! alle coordinate della finestra, quindi restituiva i pixel di qualunque
//! finestra stesse davanti — misurato: puntando a un gioco tornava un video di
//! YouTube aperto nel browser. Questa sonda serve a verificare la correzione
//! sullo scenario che la produceva, cioè con la finestra bersaglio COPERTA.
//!
//! Uso:
//!   cargo run --example capture-window-probe -- "<pezzo di titolo>" [uscita.png]
//!
//! Esiti attesi dopo la correzione, entrambi corretti:
//!   - PNG salvato        → PrintWindow ha reso la finestra, coperta o no.
//!   - errore che nomina  → la finestra non sa disegnarsi (superfici accelerate,
//!     chi la copre         es. DirectDraw) ED è coperta: si rifiuta di
//!                          restituire i pixel di un'altra invece di mentire.

use gamestringer::ocr_translator::screen_capture;

fn main() {
    let argomenti: Vec<String> = std::env::args().skip(1).collect();
    let Some(ago) = argomenti.first() else {
        eprintln!("uso: cargo run --example capture-window-probe -- \"<titolo>\" [uscita.png]");
        std::process::exit(1);
    };
    let uscita = argomenti.get(1).cloned().unwrap_or_else(|| "cattura.png".to_string());

    let ago_min = ago.to_lowercase();
    let trovate: Vec<_> = screen_capture::list_windows()
        .into_iter()
        .filter(|w| w.title.to_lowercase().contains(&ago_min))
        .collect();

    if trovate.is_empty() {
        eprintln!("nessuna finestra con «{ago}» nel titolo");
        std::process::exit(1);
    }
    for w in &trovate {
        println!("candidata: hwnd={} '{}' [{}]", w.hwnd, w.title, w.class_name);
    }
    let finestra = &trovate[0];
    println!("catturo: '{}'", finestra.title);

    match screen_capture::capture_window(finestra.hwnd) {
        Err(e) => {
            // Non è un fallimento della sonda: è il comportamento voluto quando
            // i pixel non sarebbero della finestra richiesta.
            println!("RIFIUTATA (corretto se la finestra è coperta e non si disegna):\n  {e}");
        }
        Ok(img) => {
            let mut rgba = img.data.clone();
            for p in rgba.chunks_exact_mut(4) {
                p.swap(0, 2);
            }
            let buf = image::RgbaImage::from_raw(img.width, img.height, rgba)
                .expect("dimensioni incoerenti col buffer");

            // Quanti pixel non sono neri: distingue «resa» da «riquadro vuoto».
            let accesi = buf
                .pixels()
                .filter(|p| p.0[0] != 0 || p.0[1] != 0 || p.0[2] != 0)
                .count();
            let totale = (img.width * img.height) as usize;

            buf.save(&uscita).expect("salvataggio PNG");
            println!(
                "OK {}x{} → {uscita}  ({:.1}% pixel non neri)",
                img.width,
                img.height,
                100.0 * accesi as f64 / totale as f64
            );
        }
    }
}
