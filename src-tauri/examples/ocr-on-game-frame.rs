//! Fa leggere all'OCR un fotogramma preso dal gioco, con e senza il
//! preprocessore retro, e dice cosa ha letto in ciascun caso.
//!
//! PERCHÉ. La catena costruita finora consegna il fotogramma giusto: nativo,
//! opaco, immune alle occlusioni. Ma consegnare un'immagine non è tradurre. La
//! domanda aperta è se l'OCR riesca a leggere il testo di RPG Maker — un font
//! bitmap minuscolo su una superficie 320×240 — perché se non ci riesce, tutta
//! la strada visiva su quei giochi non produce nulla, per quanto pulito sia il
//! fotogramma.
//!
//! E c'è una seconda domanda, che la prima da sola non separa: se l'OCR
//! fallisce, è perché il font è ILLEGGIBILE o solo perché è PICCOLO? Sono esiti
//! opposti — il secondo si risolve ingrandendo, il primo no. Per questo il
//! confronto è a tre: grezzo, ingrandito, e passato dal preprocessore retro che
//! il progetto ha già in casa (`retro_preprocessor`, oggi senza un solo
//! chiamante).
//!
//! Uso:
//!   cargo run --example ocr-on-game-frame -- <nome-processo>

use gamestringer::commands::game_frame::read_game_frame;
use gamestringer::ocr_translator::ocr_engine;
use gamestringer::ocr_translator::retro_preprocessor as retro;
use gamestringer::ocr_translator::screen_capture::ImageData;

fn prova(nome: &str, dati: &ImageData) {
    print!("{nome} ({}x{}): ", dati.width, dati.height);
    match ocr_engine::recognize_text(dati, "en") {
        Err(e) => println!("OCR fallito — {e}"),
        Ok(righe) if righe.is_empty() => println!("nessuna riga riconosciuta"),
        Ok(righe) => {
            println!("{} righe", righe.len());
            for r in &righe {
                println!("    «{}»  conf={:.2}", r.text, r.confidence);
            }
        }
    }
}

/// Ingrandimento a pixel interi. Nearest-neighbour di proposito: su un font
/// bitmap l'interpolazione impasta i pixel invece di ingrandirli, e il testo
/// diventa MENO leggibile. Qui si vogliono pixel più grandi, non più morbidi.
fn ingrandisci(src: &ImageData, fattore: u32) -> ImageData {
    let (w, h) = (src.width * fattore, src.height * fattore);
    let mut out = vec![0u8; (w * h * 4) as usize];
    for y in 0..h {
        let sy = y / fattore;
        for x in 0..w {
            let sx = x / fattore;
            let si = ((sy * src.width + sx) * 4) as usize;
            let di = ((y * w + x) * 4) as usize;
            out[di..di + 4].copy_from_slice(&src.data[si..si + 4]);
        }
    }
    ImageData { width: w, height: h, data: out }
}

fn main() {
    let Some(processo) = std::env::args().nth(1) else {
        eprintln!("uso: cargo run --example ocr-on-game-frame -- <nome-processo>");
        std::process::exit(1);
    };

    let frame = match read_game_frame(processo) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("nessun fotogramma: {e}");
            std::process::exit(2);
        }
    };
    println!("fotogramma {}x{} seq={}\n", frame.width, frame.height, frame.sequence);

    // Il comando restituisce un PNG base64; l'OCR vuole BGRA grezzo.
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let png = STANDARD.decode(&frame.image_data).expect("base64");
    let rgba = image::load_from_memory(&png).expect("png").to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut bgra = rgba.into_raw();
    for p in bgra.chunks_exact_mut(4) {
        p.swap(0, 2);
    }
    let grezzo = ImageData { width: w, height: h, data: bgra };

    prova("grezzo", &grezzo);
    prova("ingrandito x4", &ingrandisci(&grezzo, 4));

    // Il preprocessore che il progetto ha già: upscale + contrasto + soglia +
    // sharpen. Se aiuta, la conclusione non è «serve scrivere qualcosa», è
    // «serve collegare quello che c'è».
    let cfg = retro::RetroPreprocessConfig::preset_8bit();
    match retro::preprocess_retro_image(&grezzo, &cfg) {
        Err(e) => println!("preprocessore retro fallito: {e}"),
        Ok(pronto) => prova("preprocessore retro (preset 8-bit)", &pronto),
    }

    let tipo = retro::detect_retro_game_type(&grezzo);
    println!("\ntipo rilevato dal preprocessore: {tipo:?}");
}
