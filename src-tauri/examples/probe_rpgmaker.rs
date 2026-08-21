//! Interroga il rilevatore RPG Maker su un percorso, senza avviare l'app.
//!
//! Il ramo «RPG Maker classico» di `startAutoTranslate` scatta quando
//! `detect_rpgmaker_game` NON dice mv/mz **e** `extract_all_rpgmaker_strings`
//! ritorna 0. Prima di lanciare l'intero flusso conviene sapere se quelle due
//! condizioni sono davvero soddisfatte, e su QUALE percorso: i file RPG_RT
//! possono stare in una sottocartella, non nella radice d'installazione.
//!
//! ```text
//! cargo run --example probe_rpgmaker -- "<percorso>"
//! ```

fn main() {
    let path = match std::env::args().nth(1) {
        Some(p) => p,
        None => {
            eprintln!("uso: probe_rpgmaker <percorso del gioco>");
            std::process::exit(2);
        }
    };

    println!("percorso: {path}\n");

    match gamestringer::commands::rpgmaker_patcher::detect_rpgmaker_game(path.clone()) {
        Ok(game) => {
            println!("  rilevato: {game:#?}");
        }
        Err(e) => {
            println!("  detect_rpgmaker_game -> ERRORE: {e}");
            return;
        }
    }

    match gamestringer::commands::rpgmaker_patcher::extract_all_rpgmaker_strings(path) {
        Ok(res) => println!("\n  estrazione: {} stringhe", res.total_count),
        Err(e) => println!("\n  extract_all_rpgmaker_strings -> ERRORE: {e}"),
    }
}
