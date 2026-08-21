//! Host di prova per il server della pipe `GameStringerTranslator`.
//!
//! Fa girare `translator_pipe::serve` da solo, senza l'app Tauri: dizionario
//! preseedato con le righe della testapp GDI di gs-hook, miss stampati a video.
//! Serve per il test end-to-end manuale:
//!
//! ```text
//! cargo run --example translator_pipe_server          # terminale 1
//! gs-hook\testapp\build-x64\bin\Release\gdi-texttest.exe   # terminale 2
//! gs-hook\build-x64\bin\Release\gs-injector.exe <pid> <path a gs-hook.dll>
//! ```
//!
//! Atteso: la DLL logga "connesso a GameStringer via IPC", qui compaiono le
//! richieste (hit per le righe preseedate, miss per il resto).

#[cfg(windows)]
fn main() {
    use gamestringer::translation_bridge::dictionary_engine::DictionaryEngine;
    use parking_lot::RwLock;
    use std::sync::{mpsc, Arc};

    // Le 4 righe di gdi_text_test.cpp — tre tradotte, una lasciata fuori
    // apposta per vedere il percorso miss.
    let mut engine = DictionaryEngine::new();
    engine.set_active_languages("en", "it");
    engine.load_translations(
        "en",
        "it",
        vec![
            (
                "You found a mysterious key!".to_string(),
                "Hai trovato una chiave misteriosa!".to_string(),
            ),
            (
                "A wild slime appears before you.".to_string(),
                "Uno slime selvatico ti appare davanti.".to_string(),
            ),
            (
                "The old merchant smiles and says: welcome back, traveler.".to_string(),
                "Il vecchio mercante sorride e dice: bentornato, viaggiatore.".to_string(),
            ),
            // "The dragon roars from the mountain." → miss voluto
        ],
    );
    let dictionary = Arc::new(RwLock::new(engine));
    let (miss_tx, miss_rx) = mpsc::channel::<String>();

    std::thread::spawn(move || {
        for text in miss_rx {
            println!("MISS  → \"{}\" (in coda per l'AI fallback)", text);
        }
    });

    // Logger minimo a stdout così i log::debug! del server (hit/miss/connessioni)
    // diventano visibili in questo host di prova.
    struct StdoutLogger;
    impl log::Log for StdoutLogger {
        fn enabled(&self, _: &log::Metadata) -> bool {
            true
        }
        fn log(&self, record: &log::Record) {
            println!("[{}] {}", record.level(), record.args());
        }
        fn flush(&self) {}
    }
    static LOGGER: StdoutLogger = StdoutLogger;
    let _ = log::set_logger(&LOGGER).map(|_| log::set_max_level(log::LevelFilter::Debug));

    println!(
        "Server di prova su {} — 3 righe preseedate, Ctrl+C per uscire",
        gamestringer::translator_pipe::PIPE_NAME
    );

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");
    if let Err(e) = rt.block_on(gamestringer::translator_pipe::serve(
        gamestringer::translator_pipe::PIPE_NAME,
        dictionary,
        miss_tx,
    )) {
        eprintln!("server terminato: {e}");
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!("Named pipe: solo Windows.");
}
