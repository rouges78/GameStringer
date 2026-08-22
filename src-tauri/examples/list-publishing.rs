//! Elenca i giochi che stanno pubblicando fotogrammi, come fa il percorso OCR.
//!
//! È l'anello che `detectGameProcess` usa per capire da quale gioco prendere le
//! immagini senza chiedere niente all'utente. Qui si verifica sul sistema vero:
//! con un gioco agganciato deve trovarne esattamente uno.

use gamestringer::commands::game_frame::list_publishing_games;

fn main() {
    let giochi = list_publishing_games();
    if giochi.is_empty() {
        println!("nessun gioco sta pubblicando fotogrammi");
        std::process::exit(1);
    }
    println!("{} gioco/giochi che pubblicano:", giochi.len());
    for g in &giochi {
        println!("  PID {}  {}", g.pid, g.process_name);
    }
    // Il percorso OCR sceglie solo quando il candidato è UNO: con due, tradurre
    // quello sbagliato sarebbe silenzioso.
    println!(
        "\ndetectGameProcess restituirebbe: {}",
        if giochi.len() == 1 { giochi[0].process_name.as_str() } else { "null (ambiguo)" }
    );
}
