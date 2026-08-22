//! Salva quello che `capture_screen` restituisce davvero.
//!
//! Serve a guardare l'immagine invece di ragionare sui sintomi: l'OCR leggeva
//! spazzatura (`=O Qé¢€¢> - OQ -xX`) e ci sono tre spiegazioni incompatibili —
//! immagine capovolta, canali invertiti, dati corrotti. Un PNG le separa tutte.
use gamestringer::ocr_translator::screen_capture;

fn main() {
    let img = match screen_capture::capture_screen(&None) {
        Ok(i) => i,
        Err(e) => { eprintln!("cattura fallita: {e}"); std::process::exit(1); }
    };
    println!("catturato {}x{} ({} byte)", img.width, img.height, img.data.len());

    let mut rgba = img.data.clone();
    for p in rgba.chunks_exact_mut(4) { p.swap(0, 2); p[3] = 255; }
    let buf = image::RgbaImage::from_raw(img.width, img.height, rgba)
        .expect("dimensioni incoerenti col buffer");
    let out = std::env::args().nth(1).unwrap_or_else(|| "schermo.png".into());
    buf.save(&out).expect("salvataggio");
    println!("salvato -> {out}");
}
