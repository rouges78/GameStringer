//! Legge l'ultimo fotogramma che gs-hook pubblica per un gioco e lo salva.
//!
//! Perché esiste. I test unitari provano il LETTORE contro un'intestazione che
//! si costruisce da sé: se il produttore C++ scrivesse a offset diversi,
//! passerebbero lo stesso. Solo due processi veri, uno che scrive e uno che
//! legge, dimostrano che il contratto in `gs-hook/include/gs_frame_share.h` è
//! rispettato da entrambi i lati.
//!
//! Uso:
//!   cargo run --example read-game-frame -- <pid> [uscita.png]
//!
//! Il gioco deve girare con gs-hook iniettato e `GS_HOOK_FRAME_SHARE=1`.

use gamestringer::commands::game_frame::read_game_frame;

fn main() {
    let argomenti: Vec<String> = std::env::args().skip(1).collect();
    let Some(pid) = argomenti.first().and_then(|s| s.parse::<u32>().ok()) else {
        eprintln!("uso: cargo run --example read-game-frame -- <pid> [uscita.png]");
        std::process::exit(1);
    };
    let uscita = argomenti.get(1).cloned().unwrap_or_else(|| "fotogramma.png".to_string());

    // Due letture di seguito: la seconda serve a vedere se il contatore avanza,
    // cioè se il gioco sta davvero pubblicando e non ci stiamo rileggendo lo
    // stesso fotogramma fermo.
    let primo = match read_game_frame(pid) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("lettura fallita: {e}");
            std::process::exit(2);
        }
    };
    std::thread::sleep(std::time::Duration::from_millis(400));
    let secondo = read_game_frame(pid).ok();

    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let png = STANDARD.decode(&primo.image_data).expect("base64");
    std::fs::write(&uscita, &png).expect("scrittura PNG");

    println!(
        "letto {}x{} seq={} -> {uscita} ({} byte PNG)",
        primo.width,
        primo.height,
        primo.sequence,
        png.len()
    );
    match secondo {
        Some(s) if s.sequence > primo.sequence => {
            println!("seq avanzata {} -> {}: il gioco sta pubblicando", primo.sequence, s.sequence)
        }
        Some(s) => println!(
            "seq ferma a {}: il gioco non ha pubblicato nulla di nuovo in 400 ms",
            s.sequence
        ),
        None => println!("seconda lettura fallita"),
    }
}
