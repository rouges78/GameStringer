#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod models;
mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::steam::auto_detect_steam_config,
            commands::steam::test_steam_connection,
            commands::steam::get_steam_games,
            commands::steam::fix_steam_id,
            commands::steam::get_game_details,
            commands::steam::get_steam_cover,
            commands::steam::get_steam_covers_batch,
            commands::library::get_library_games,
            commands::library::get_game_path,
            commands::library::read_game_file,
            commands::library::scan_game_files,
            commands::games::get_games,
            commands::games::get_game_by_id,
            commands::games::scan_games,
            commands::utilities::get_howlongtobeat_info,
            commands::utilities::get_steamgriddb_artwork,
            commands::utilities::get_preferences,
            commands::utilities::update_preferences,
            commands::utilities::clear_cache,
            commands::utilities::get_cache_stats,
            commands::patches::get_patches,
            commands::patches::create_patch,
            commands::patches::update_patch,
            commands::patches::export_patch,
            commands::patches::translate_text,
            commands::patches::get_translation_suggestions,
            commands::patches::export_translations,
            commands::patches::import_translations,
            commands::injekt::start_injection,
            commands::injekt::stop_injection,
            commands::injekt::get_injection_stats,
            commands::injekt::test_injection,
            commands::injekt::get_processes,
            commands::injekt::get_process_info,
            commands::injekt::inject_translation,
            commands::injekt::scan_process_memory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
