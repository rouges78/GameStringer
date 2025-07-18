// TEMPORANEAMENTE COMMENTATO PER DEBUG - RIPRISTINARE DOPO RISOLUZIONE
// #![cfg_attr(
//     all(not(debug_assertions), target_os = "windows"),
//     windows_subsystem = "windows"
// )]

mod models;
mod commands;

fn main() {
    println!("🚀 Avvio GameStringer - Versione Minimale per Debug");
    
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Solo comandi essenziali per test
            commands::steam::test_steam_connection,
            commands::steam::get_steam_games,
            commands::epic::test_epic_connection,
            commands::gog::test_gog_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
