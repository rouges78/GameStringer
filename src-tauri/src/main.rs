#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod models;
mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::steam::auto_detect_steam_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
