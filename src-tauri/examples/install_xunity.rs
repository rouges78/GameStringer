//! Esegue l'installer XUnity di GameStringer su un gioco Unity, senza avviare l'app.
//!
//! Chiama `install_unity_autotranslator` esattamente come il pulsante dell'app:
//! stesso rilevamento Mono/IL2CPP, stessa scelta di BepInEx, stessa config.
//! Serve a provare in gioco il percorso vero, non una sua imitazione a mano.
//!
//! ```text
//! cargo run --example install_xunity -- "<cartella del gioco>" "<Gioco.exe>" [lingua] [modalità]
//! ```
//!
//! Lingua di default `it`, modalità di default `capture` (nessun endpoint).

#[tokio::main]
async fn main() {
    let mut args = std::env::args().skip(1);
    let (Some(game_path), Some(exe)) = (args.next(), args.next()) else {
        eprintln!("uso: install_xunity <cartella del gioco> <Gioco.exe> [lingua] [modalità]");
        std::process::exit(2);
    };
    let lang = args.next();
    let mode = args.next();

    println!("gioco: {game_path}\nexe:   {exe}\n");
    match gamestringer::commands::unity_patcher::install_unity_autotranslator(game_path, exe, lang, mode).await {
        Ok(status) => {
            for step in &status.steps_completed {
                println!("  {step}");
            }
            println!("\nsuccess={} · {}", status.success, status.message);
        }
        Err(e) => {
            println!("install_unity_autotranslator -> ERRORE: {e}");
            std::process::exit(1);
        }
    }
}
