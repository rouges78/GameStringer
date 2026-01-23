#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod models;
mod commands;

mod injekt;
mod multi_process_injekt;
mod anti_cheat;
mod engine_detector;
mod translation_bridge;
mod activity_history;
mod ue_translator;
mod ocr_translator;

pub mod profiles;
// Notification system: vedi src/notifications_disabled/

use profiles::storage::ProfileStorage;
use profiles::manager::ProfileManager;
use profiles::settings_manager::ProfileSettingsManager;
use commands::profiles::ProfileManagerState;
use commands::profile_settings::ProfileSettingsManagerState;
// use tauri::Manager; // Non usato attualmente

mod process_utils;

#[tauri::command]
fn close_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    // Usa la directory dei dati dell'app per evitare che Tauri riavvii quando i file cambiano
    let app_data_dir = if cfg!(debug_assertions) {
        // In dev, usa una directory temporanea fuori da src-tauri
        std::path::PathBuf::from("../gamestringer_data")
    } else {
        // In produzione, usa la directory dei dati dell'app
        std::path::PathBuf::from("profiles")
    };
    
    // Inizializza ProfileManager
    let profile_storage = ProfileStorage::new(app_data_dir.clone()).expect("Failed to initialize profile storage");
    let profile_manager = ProfileManager::new(profile_storage);
    let profile_state = ProfileManagerState {
        manager: std::sync::Arc::new(tokio::sync::Mutex::new(profile_manager)),
    };

    // Inizializza ProfileSettingsManager
    let settings_manager = ProfileSettingsManager::new(app_data_dir).expect("Failed to initialize settings manager");
    let settings_state = ProfileSettingsManagerState {
        manager: std::sync::Arc::new(tokio::sync::Mutex::new(settings_manager)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(commands::anti_cheat::AntiCheatState::default())

        .manage(profile_state)
        .manage(settings_state)
        .manage(commands::translation_bridge::TranslationBridgeState::new())
        .manage(commands::activity_history::ActivityHistoryState::default())
        .invoke_handler(tauri::generate_handler![
            close_app,
            commands::steam::auto_detect_steam_config,
            commands::steam::test_steam_connection,
            commands::steam::disconnect_steam,
            commands::steam::get_steam_games,
            commands::steam::fix_steam_id,
            commands::steam::get_game_details,
            commands::steam::get_steam_cover,
            commands::steam::get_steam_covers_batch,
            commands::steam::save_steam_credentials,
            commands::steam::load_steam_credentials,
            commands::steam::clear_steam_credentials,
            commands::steam::save_steam_connection_status,
            commands::steam::load_steam_connection_status,
            commands::steam::remove_steam_credentials,
            commands::steam::auto_connect_steam,
            commands::steam::force_refresh_steam_games,
            commands::steam::debug_steam_api_raw,
            commands::steam::debug_steam_api,
            commands::steam::debug_steam_api_extended,
            commands::steam::debug_steam_profile,
            commands::steam::add_game_to_library,
            commands::steam::get_steam_games_fast,
            commands::steam::get_all_local_steam_games,
            commands::steam::debug_steam_paths,
            commands::steam::test_single_acf,
            commands::steam::parse_shared_config_vdf,
            commands::steam::get_family_sharing_games,
            commands::steam::get_steam_games_with_family_sharing,
            // Steam Enhanced (steamlocate-rs integration)
            commands::steam_enhanced::scan_steam_with_steamlocate,
            commands::steam_enhanced::find_steam_game_by_id,
            commands::steam_enhanced::get_enhanced_steam_info,
            commands::steam_enhanced::test_steamlocate_integration,
            commands::steam_enhanced::scan_all_steam_games_fast,
            commands::steam_enhanced::load_steam_games_cache,
            commands::steam_enhanced::update_remote_game_database,
            commands::steam_enhanced::load_family_sharing_games,
            commands::steam_enhanced::save_family_sharing_ids,
            commands::steam_enhanced::load_family_sharing_ids,
            commands::steam_enhanced::get_steam_game_name,
            commands::steam_enhanced::fetch_steam_game_details,
            commands::steam_enhanced::get_steam_install_path,
            commands::steam_enhanced::find_game_install_path,
            commands::steam_enhanced::find_game_path_by_appid,
            // DLC Management (cross-store)
            commands::dlc_manager::scan_all_dlc,
            commands::dlc_manager::get_game_dlc,
            commands::dlc_manager::get_dlc_statistics,
            // Epic Games Enhanced (repository-based detection)
            commands::epic_enhanced::scan_epic_games_enhanced,
            commands::epic_enhanced::get_epic_game_enhanced,
            commands::epic_enhanced::get_epic_statistics_enhanced,
            // HowLongToBeat (game completion times) - Rimosso per eliminare dipendenza xml5ever
            // commands::hltb_manager::search_game_hltb,
            // commands::hltb_manager::get_hltb_statistics,
            // commands::hltb_manager::cleanup_hltb_cache,
            // commands::hltb_manager::search_games_batch_hltb,
            commands::epic::get_epic_game_details,
            commands::epic::get_epic_game_cover,
            commands::epic::get_epic_covers_batch,
            commands::epic::test_epic_connection,
            commands::epic::start_epic_oauth_flow,
            commands::epic::disconnect_epic,
            commands::epic::clear_epic_cache,
            commands::epic::get_epic_games_web,
            commands::epic::get_epic_games_by_account_id,
            commands::epic::get_epic_games_complete,
            commands::epic::check_legendary_status,
            commands::epic::install_legendary,
            commands::epic::authenticate_legendary,
            commands::epic::save_epic_credentials,
            commands::epic::load_epic_credentials,
            commands::epic::clear_epic_credentials,
            commands::gog::get_gog_game_details,
            commands::gog::search_gog_game,
            commands::gog::get_gog_game_cover,
            commands::gog::get_gog_covers_batch,
            commands::gog::test_gog_connection,
            commands::gog::connect_gog,
            commands::gog::save_gog_credentials,
            commands::gog::load_gog_credentials,
            commands::gog::clear_gog_credentials,
            commands::gog::disconnect_gog,
            commands::origin::test_origin_connection,
            commands::origin::connect_origin,
            commands::origin::save_origin_credentials,
            commands::origin::load_origin_credentials,
            commands::origin::clear_origin_credentials,
            commands::origin::get_origin_game_info,
            commands::origin::get_origin_covers_batch,
            commands::ubisoft::test_ubisoft_connection,
            commands::ubisoft::connect_ubisoft,
            commands::ubisoft::save_ubisoft_credentials,
            commands::ubisoft::load_ubisoft_credentials,
            commands::ubisoft::clear_ubisoft_credentials,
            commands::ubisoft::get_ubisoft_game_info,
            commands::ubisoft::get_ubisoft_covers_batch,
            commands::battlenet::test_battlenet_connection,
            commands::battlenet::connect_battlenet,
            commands::battlenet::save_battlenet_credentials,
            commands::battlenet::load_battlenet_credentials,
            commands::battlenet::clear_battlenet_credentials,
            commands::battlenet::disconnect_battlenet,
            commands::battlenet::get_battlenet_game_info,
            commands::battlenet::get_battlenet_covers_batch,
            commands::itchio::test_itchio_connection,
            commands::itchio::connect_itchio,
            commands::itchio::save_itchio_credentials,
            commands::itchio::load_itchio_credentials,
            commands::itchio::clear_itchio_credentials,
            commands::itchio::get_itchio_game_info,
            commands::itchio::get_itchio_covers_batch,
            commands::rockstar::test_rockstar_connection,
            commands::rockstar::connect_rockstar,
            commands::rockstar::save_rockstar_credentials,
            commands::rockstar::load_rockstar_credentials,
            commands::rockstar::clear_rockstar_credentials,
            commands::rockstar::get_rockstar_game_info,
            commands::rockstar::get_rockstar_covers_batch,
            // Game Launcher System
            commands::launcher::launch_steam_game,
            commands::launcher::launch_epic_game,
            commands::launcher::launch_gog_game,
            commands::launcher::launch_game_direct,
            commands::launcher::launch_game_universal,
            commands::launcher::get_installed_launchers,
            commands::launcher::test_launcher_functionality,
            commands::library::get_library_games,
            commands::library::get_game_path,
            commands::library::read_game_file,
            commands::library::scan_game_files,
            commands::library::list_directory_files,
            commands::library::scan_localization_files,
            commands::library::read_text_file,
            commands::games::get_games,
            commands::games::get_games_fast,
            commands::games::force_refresh_all_games,
            commands::games::detect_engine_for_game,
            commands::games::translate_text_simple,
            commands::games::find_executables_in_folder,
            commands::games::launch_executable,
            commands::games::get_game_by_id,
            commands::games::scan_games,
            commands::utilities::get_howlongtobeat_info,
            commands::utilities::get_steamgriddb_artwork,
            commands::utilities::get_preferences,
            commands::utilities::update_preferences,
            commands::utilities::save_app_settings,
            commands::utilities::load_app_settings,
            commands::utilities::clear_cache,
            commands::utilities::get_cache_stats,
            commands::utilities::check_path_exists,
            commands::utilities::create_directory_backup,
            commands::utilities::restore_directory_backup,
            commands::patches::get_patches,
            commands::patches::create_patch,
            commands::patches::update_patch,
            commands::patches::export_patch,
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
            commands::injekt::scan_process_memory,
            // Multi-Process Injection
            commands::injekt::start_multi_process_injection,
            commands::injekt::stop_multi_process_injection,
            commands::injekt::get_multi_process_stats,
            commands::injekt::get_multi_process_active_processes,
            commands::injekt::force_inject_process,
            commands::injekt::list_multi_process_games,
            // Anti-Cheat System
            commands::anti_cheat::detect_anti_cheat_systems,
            commands::anti_cheat::get_anti_cheat_compatibility_strategies,
            commands::anti_cheat::get_anti_cheat_cache_stats,
            commands::anti_cheat::clear_anti_cheat_cache,
            commands::anti_cheat::test_anti_cheat_detection,
            // Performance Optimization - Sistema rimosso per cleanup warning

            // Advanced OCR System - TEMPORANEAMENTE DISABILITATO PER ERRORI COMPILAZIONE
            // commands::advanced_ocr::process_image_ocr,
            // commands::advanced_ocr::batch_process_images_ocr,
            // commands::advanced_ocr::get_ocr_performance_metrics, // Sistema performance rimosso
            // commands::advanced_ocr::get_supported_ocr_engines,
            // commands::advanced_ocr::get_ocr_config,
            // commands::advanced_ocr::update_ocr_config,
            // commands::advanced_ocr::test_ocr_engines,
            // commands::advanced_ocr::clear_ocr_cache,
            // commands::advanced_ocr::get_ml_scoring_info,
            // Translation Backends System - TEMPORANEAMENTE DISABILITATO PER ERRORI COMPILAZIONE
            // commands::translation_backends::initialize_translation_backends,
            // commands::translation_backends::translate_text,
            // commands::translation_backends::translate_batch,
            // commands::translation_backends::get_translation_metrics,
            // commands::translation_backends::get_backend_status,
            // commands::translation_backends::get_supported_languages,
            // commands::translation_backends::get_translation_config,
            // commands::translation_backends::update_translation_config,
            // commands::translation_backends::configure_backend_api_key,
            // commands::translation_backends::toggle_backend,
            // commands::translation_backends::test_all_backends,
            // commands::translation_backends::test_translation_quality,
            // commands::translation_backends::clear_translation_cache,
            // commands::translation_backends::get_cost_estimation,
            // commands::translation_backends::get_cost_optimization_recommendations,
            // Offline Translation System - TEMPORANEAMENTE DISABILITATO PER ERRORI COMPILAZIONE
            // commands::offline_translation::initialize_offline_translation,
            // commands::offline_translation::translate_offline,
            // commands::offline_translation::translate_batch_offline,
            // commands::offline_translation::is_language_pair_supported_offline,
            // commands::offline_translation::get_available_offline_models,
            // commands::offline_translation::download_offline_model,
            // commands::offline_translation::remove_offline_model,
            // commands::offline_translation::get_offline_translation_stats,
            // commands::offline_translation::get_language_pair_support,
            // commands::offline_translation::get_offline_translation_config,
            // commands::offline_translation::update_offline_translation_config,
            // commands::offline_translation::clear_offline_translation_cache,
            // commands::offline_translation::cleanup_unused_offline_models,
            // commands::offline_translation::preload_popular_offline_models,
            // commands::offline_translation::test_offline_translation_quality,
            // commands::offline_translation::get_offline_model_metrics,
            // commands::offline_translation::get_offline_storage_recommendations,
            // Translation Logger System - TEMPORANEAMENTE DISABILITATO PER ERRORI COMPILAZIONE
            // commands::translation_logger::initialize_translation_logger,
            // commands::translation_logger::log_translation,
            // commands::translation_logger::add_human_feedback,
            // commands::translation_logger::add_translation_correction,
            // commands::translation_logger::export_translation_logs,
            // commands::translation_logger::get_logger_statistics,
            // commands::translation_logger::get_translations_for_review,
            // commands::translation_logger::generate_quality_report,
            // commands::translation_logger::get_logger_config,
            // commands::translation_logger::update_logger_config,
            // commands::translation_logger::get_supported_export_formats,
            // commands::translation_logger::search_translations,
            // commands::translation_logger::get_translations_by_game,
            // commands::translation_logger::get_translations_by_language_pair,
            // commands::translation_logger::get_quality_stats_by_method,
            // commands::translation_logger::get_quality_improvement_recommendations,
            // commands::translation_logger::cleanup_old_logs,
            // Low Latency Optimizer System - TEMPORANEAMENTE DISABILITATO PER ERRORI COMPILAZIONE
            // commands::low_latency_optimizer::initialize_low_latency_optimizer,
            // commands::low_latency_optimizer::optimize_translation,
            // commands::low_latency_optimizer::optimize_batch_translations,
            // commands::low_latency_optimizer::get_latency_statistics,
            // commands::low_latency_optimizer::auto_optimize_configuration,
            // commands::low_latency_optimizer::optimize_memory_usage,
            // commands::low_latency_optimizer::get_latency_optimizer_config,
            // commands::low_latency_optimizer::update_latency_optimizer_config,
            // commands::low_latency_optimizer::test_latency_performance, // Sistema performance rimosso
            // commands::low_latency_optimizer::get_performance_recommendations, // Sistema performance rimosso
            // commands::low_latency_optimizer::benchmark_optimizations,
            // commands::low_latency_optimizer::reset_performance_stats, // Sistema performance rimosso
            // Translation Pipeline System - TEMPORANEAMENTE DISABILITATO PER ERRORI COMPILAZIONE
            // commands::translation_pipeline::initialize_translation_pipeline,
            // commands::translation_pipeline::process_translation_pipeline,
            // commands::translation_pipeline::process_batch_translation_pipeline,
            // commands::translation_pipeline::get_pipeline_statistics,
            // commands::translation_pipeline::auto_optimize_pipeline,
            // commands::translation_pipeline::get_pipeline_config,
            // commands::translation_pipeline::update_pipeline_config,
            // commands::translation_pipeline::test_pipeline_performance, // Sistema performance rimosso
            // commands::translation_pipeline::get_pipeline_recommendations,
            // commands::translation_pipeline::benchmark_pipeline_vs_components,
            // commands::translation_pipeline::reset_pipeline_statistics,
            // Cache Management

            // Error Management

            // Steam Enhanced Error Management

            // Memory Audit System

            // Intelligent Cache System - Sistema rimosso per cleanup warning

            // Profile Management System
            commands::profiles::list_profiles,
            commands::profiles::create_profile,
            commands::profiles::authenticate_profile,
            commands::profiles::switch_profile,
            commands::profiles::get_current_profile,
            commands::profiles::logout,
            commands::profiles::update_settings,
            commands::profiles::delete_profile,
            commands::profiles::export_profile,
            commands::profiles::import_profile,
            commands::profiles::validate_export_file,
            commands::profiles::create_profile_backup,
            commands::profiles::get_auth_stats,
            commands::profiles::get_profile_avatar,
            commands::profiles::update_profile_avatar,
            commands::profiles::is_session_expired,
            commands::profiles::renew_session,
            commands::profiles::get_session_time_remaining,
            commands::profiles::can_authenticate,
            commands::profiles::unlock_profile,
            commands::profiles::get_failed_attempts,

            // Profile Settings Management System
            commands::profile_settings::load_profile_settings,
            commands::profile_settings::save_profile_settings,
            commands::profile_settings::delete_profile_settings,
            commands::profile_settings::load_global_settings,
            commands::profile_settings::save_global_settings,
            commands::profile_settings::migrate_legacy_settings,
            commands::profile_settings::profile_settings_to_legacy,
            commands::profile_settings::list_profiles_with_settings,
            commands::profile_settings::get_current_profile_settings,
            commands::profile_settings::save_current_profile_settings,
            commands::profile_settings::initialize_settings_system,

            // Migration System
            commands::migration::check_legacy_credentials,
            commands::migration::get_legacy_credentials_info,
            commands::migration::migrate_legacy_credentials_wizard,
            commands::migration::backup_legacy_credentials,
            commands::migration::restore_legacy_credentials,
            commands::migration::cleanup_legacy_credentials,
            commands::migration::check_legacy_settings,
            commands::migration::get_legacy_settings_info,
            commands::migration::migrate_legacy_settings_to_profile,
            commands::migration::backup_legacy_settings,
            commands::migration::cleanup_legacy_settings,
            commands::migration::migration_wizard,

            // Validation System
            commands::validation::validate_profile_name,
            commands::validation::validate_password,
            commands::validation::validate_unique_profile_name,
            commands::validation::sanitize_input,
            commands::validation::get_validation_config,
            commands::validation::update_validation_config,
            commands::validation::validate_profile_creation,
            commands::validation::generate_password_suggestions,
            commands::validation::check_password_strength_realtime,

            // Glossary System
            commands::glossary::create_glossary,
            commands::glossary::get_glossary,
            commands::glossary::list_glossaries,
            commands::glossary::add_glossary_entry,
            commands::glossary::update_glossary_entry,
            commands::glossary::delete_glossary_entry,
            commands::glossary::update_glossary_metadata,
            commands::glossary::export_glossary,
            commands::glossary::import_glossary,
            commands::glossary::search_glossary,

            // Translation Memory System
            commands::translation_memory::load_translation_memory,
            commands::translation_memory::save_translation_memory,
            commands::translation_memory::list_translation_memories,
            commands::translation_memory::delete_translation_memory,
            commands::translation_memory::export_translation_memory_tmx,
            commands::translation_memory::import_translation_memory_tmx,
            commands::translation_memory::search_translation_memory,
            commands::translation_memory::add_translation_to_memory,
            commands::translation_memory::add_translations_batch,

            // File Manager
            commands::file_manager::save_file_with_backup,
            commands::file_manager::read_file_content,
            commands::file_manager::list_file_backups,
            commands::file_manager::restore_backup,
            commands::file_manager::get_desktop_path,
            commands::file_manager::save_binary_file,
            commands::file_manager::ensure_directory,
            commands::file_manager::write_text_file,

            // Unity Patcher
            commands::unity_patcher::check_game_engine,
            commands::unity_patcher::install_unity_autotranslator,
            commands::unity_patcher::remove_unity_patch,
            commands::unity_patcher::detect_localization_files,
            commands::unity_patcher::apply_translation_file,
            commands::unity_patcher::get_translation_recommendation,
            commands::unity_patcher::read_xunity_translations,
            commands::unity_patcher::save_xunity_translation,

            // Unity Direct Injection (bypassa BepInEx)
            commands::unity_injector::inject_unity_translator,
            commands::unity_injector::start_unity_translation_server,
            commands::unity_injector::stop_unity_translation_server,

            // OCR Translator (Universal - funziona su qualsiasi gioco)
            ocr_translator::start_ocr_translator,
            ocr_translator::stop_ocr_translator,
            ocr_translator::get_detected_texts,
            ocr_translator::is_ocr_running,
            ocr_translator::list_capture_windows,
            ocr_translator::toggle_ocr_overlay,
            ocr_translator::position_overlay_on_window,

            // Unreal Engine Patcher
            commands::unreal_patcher::detect_unreal_game,
            commands::unreal_patcher::install_unreal_patch,
            commands::unreal_patcher::uninstall_unreal_patch,
            commands::unreal_patcher::get_unreal_patch_status,
            commands::unreal_patcher::launch_with_translator,

            // UE AutoTranslator (Runtime Translation for Unreal Engine)
            commands::ue_translator::start_ue_translator,
            commands::ue_translator::stop_ue_translator,
            commands::ue_translator::get_ue_translator_state,
            commands::ue_translator::toggle_ue_translation,
            commands::ue_translator::get_ue_cache_stats,
            commands::ue_translator::clear_ue_cache,
            commands::ue_translator::check_ue_translator_compatibility,

            // Translation Bridge (In-Game Translation System)
            commands::translation_bridge::translation_bridge_start,
            commands::translation_bridge::translation_bridge_stop,
            commands::translation_bridge::translation_bridge_status,
            commands::translation_bridge::translation_bridge_stats,
            commands::translation_bridge::translation_bridge_dictionary_stats,
            commands::translation_bridge::translation_bridge_load_translations,
            commands::translation_bridge::translation_bridge_load_json,
            commands::translation_bridge::translation_bridge_set_languages,
            commands::translation_bridge::translation_bridge_add_translation,
            commands::translation_bridge::translation_bridge_get_translation,
            commands::translation_bridge::translation_bridge_export_json,
            commands::translation_bridge::translation_bridge_clear,

            // Translation API (DeepL, Google, LibreTranslate)
            commands::translation_api::translate_deepl,
            commands::translation_api::translate_deepl_batch,
            commands::translation_api::translate_google,
            commands::translation_api::translate_google_batch,
            commands::translation_api::translate_libre,
            commands::translation_api::translate_text_unified,
            commands::translation_api::translate_batch_unified,
            commands::translation_api::get_supported_languages,

            // Activity History System
            commands::activity_history::activity_add,
            commands::activity_history::activity_get,
            commands::activity_history::activity_get_recent,
            commands::activity_history::activity_count_by_type,
            commands::activity_history::activity_delete,
            commands::activity_history::activity_clear,

            // Game Dictionaries System
            commands::game_dictionaries::list_installed_dictionaries,
            commands::game_dictionaries::load_dictionary,
            commands::game_dictionaries::save_dictionary,
            commands::game_dictionaries::import_dictionary_from_file,
            commands::game_dictionaries::import_dictionary_auto,
            commands::game_dictionaries::export_dictionary_simple,
            commands::game_dictionaries::delete_dictionary,
            commands::game_dictionaries::get_dictionary_status,
            commands::game_dictionaries::search_in_dictionary,
            commands::game_dictionaries::add_translation_to_dictionary,
            commands::game_dictionaries::merge_dictionaries,
            commands::game_dictionaries::apply_dictionary_to_xunity,
            commands::game_dictionaries::extract_xunity_translations,
            commands::game_dictionaries::import_from_xunity,
            commands::game_dictionaries::get_dictionaries_stats,

            // NOTIFICATION SYSTEM TEMPORANEAMENTE DISABILITATO PER ERRORI COMPILAZIONE
            // commands::notifications::create_notification,
            // commands::notifications::get_notifications,
            // commands::notifications::get_notifications_sorted,
            // commands::notifications::mark_notification_as_read,
            // commands::notifications::mark_multiple_notifications_as_read,
            // commands::notifications::mark_all_notifications_as_read,
            // commands::notifications::delete_notification,
            // commands::notifications::get_unread_notifications_count,
            // commands::notifications::get_notification_counts,
            // commands::notifications::clear_all_notifications,
            // commands::notifications::get_notification_preferences,
            // commands::notifications::update_notification_preferences,
            // commands::notifications::update_partial_notification_preferences,
            // commands::notifications::auto_save_notification_preferences,
            // commands::notifications::sync_notification_preferences_on_profile_switch,
            // commands::notifications::toggle_notification_type,
            // commands::notifications::reset_notification_preferences_to_default,
            // commands::notifications::handle_profile_event,
            // commands::notifications::handle_profile_switch,
            // commands::notifications::cleanup_profile_notifications,
            // commands::notifications::generate_notification_security_report, // TODO: Implementare
            // commands::notifications::verify_profile_notifications_integrity,
            // commands::notifications::get_high_priority_unread_notifications,
            // commands::notifications::cleanup_expired_notifications,
            // commands::notifications::create_authentication_error_notification,
            // commands::notifications::create_profile_locked_notification,
            // commands::notifications::create_credential_operation_notification,
            // commands::notifications::create_settings_update_notification,
            // commands::notifications::create_backup_notification,
            
            // System Notification Commands - TODO: Implementare quando necessario
            // commands::notifications::create_system_broadcast_notification,
            // commands::notifications::create_urgent_system_notification,
            // commands::notifications::create_maintenance_notification,
            // commands::notifications::create_update_available_notification,
            // commands::notifications::get_active_system_notifications,
            // commands::notifications::get_system_notification_stats,
            // commands::notifications::delete_system_notification_from_all_profiles,
            // commands::notifications::update_system_notification_expiry,
            // commands::notifications::update_system_notification_priority,
            // commands::notifications::get_system_notification_read_status,
            // commands::notifications::expire_old_system_notifications,
            // commands::notifications::get_profiles_for_notification_admin,

            // Update System
            commands::updates::check_for_updates,
            commands::updates::get_app_version,
            // Image Cache System
            commands::image_cache::cache_image,
            commands::image_cache::is_image_cached,
            commands::image_cache::get_image_cache_stats,
            commands::image_cache::cleanup_image_cache,
            commands::image_cache::clear_image_cache,
            // Backup System
            commands::backup::export_profile_settings,
            commands::backup::import_profile_settings,
            commands::backup::backup_translation_memory,
            commands::backup::get_backup_stats,
            commands::backup::list_backups,
            commands::backup::delete_backup,
            // Auto-Backup System
            commands::backup::load_autobackup_config,
            commands::backup::save_autobackup_config,
            commands::backup::run_auto_backup,
            commands::backup::should_run_auto_backup,
            commands::backup::restore_from_auto_backup,
            commands::backup::list_auto_backups,
            // QA Check System
            commands::qa_check::qa_check_translation,
            commands::qa_check::qa_check_batch,
            commands::qa_check::qa_auto_fix,
            // Export Multi-Format System
            commands::export_formats::export_to_csv,
            commands::export_formats::export_to_xliff,
            commands::export_formats::export_to_po,
            commands::export_formats::export_to_json,
            commands::export_formats::import_from_csv,
            commands::export_formats::import_from_po,
            commands::export_formats::get_supported_formats,
            // Smart Glossary 3-Tier System
            commands::smart_glossary::load_smart_glossary,
            commands::smart_glossary::save_smart_glossary,
            commands::smart_glossary::add_glossary_term,
            commands::smart_glossary::update_glossary_term,
            commands::smart_glossary::delete_glossary_term,
            commands::smart_glossary::search_glossary_terms,
            commands::smart_glossary::apply_glossary_to_text,
            commands::smart_glossary::check_glossary_consistency,
            commands::smart_glossary::import_glossary_csv,
            commands::smart_glossary::get_glossary_categories,
            commands::smart_glossary::get_glossary_stats,
            // Context Injection AI System
            commands::context_injection::generate_translation_context,
            commands::context_injection::extract_context_from_text,
            commands::context_injection::detect_text_tone,
            commands::context_injection::get_cultural_hints,
            commands::context_injection::get_language_variants,
            // Global Hotkeys System
            commands::global_hotkeys::init_global_hotkeys,
            commands::global_hotkeys::register_global_hotkey,
            commands::global_hotkeys::unregister_global_hotkey,
            commands::global_hotkeys::list_global_hotkeys,
            commands::global_hotkeys::clear_global_hotkeys,
            // Store Detection
            commands::store_detection::get_installed_stores,
            commands::store_detection::save_stores_config,
            commands::store_detection::load_stores_config,
            commands::store_detection::add_custom_game_folder,
            commands::store_detection::remove_custom_game_folder,
            
            // Amazon Games Store
            commands::amazon::get_amazon_installed_games,
            commands::amazon::is_amazon_games_installed,
            commands::amazon::test_amazon_connection,
            
            // Extension System (Vortex-inspired)
            commands::extensions::init_extension_system,
            commands::extensions::get_installed_extensions,
            commands::extensions::toggle_extension,
            commands::extensions::install_extension,
            commands::extensions::uninstall_extension,
            commands::extensions::create_extension_template,
            
            // Mod Profiles System (Vortex-inspired)
            commands::mod_profiles::init_mod_profiles,
            commands::mod_profiles::get_mod_profiles,
            commands::mod_profiles::create_mod_profile,
            commands::mod_profiles::activate_mod_profile,
            commands::mod_profiles::delete_mod_profile,
            commands::mod_profiles::clone_mod_profile,
            commands::mod_profiles::get_installed_mods,
            commands::mod_profiles::toggle_mod_in_profile,
            
            // Load Order Management (Vortex/LOOT-inspired)
            commands::load_order::init_load_order,
            commands::load_order::get_load_order,
            commands::load_order::move_mod_in_order,
            commands::load_order::auto_sort_load_order,
            commands::load_order::detect_mod_conflicts,
            commands::load_order::resolve_mod_conflict,
            commands::load_order::add_load_order_rule,
            commands::load_order::remove_load_order_rule,
            
            // Unity Asset Bundle (Localization extraction)
            commands::unity_bundle::analyze_localization_bundles,
            commands::unity_bundle::detect_localization_folder,
            // Unity Bundle - Estrazione automatica
            commands::unity_bundle::extract_strings_auto,
            commands::unity_bundle::read_extracted_strings,
            commands::unity_bundle::save_translated_strings,
            commands::unity_bundle::create_translated_bundle,
            commands::unity_bundle::save_uabea_dump,
            commands::unity_bundle::open_uabea,
            
            // Screen Capture System
            commands::screen_capture::check_screen_capture_available,
            commands::screen_capture::get_monitors,
            commands::screen_capture::capture_screen,
            commands::screen_capture::get_windows,
            commands::screen_capture::capture_window,
            // Batch Processor System
            commands::batch_processor::scan_folder_for_translation,
            commands::batch_processor::read_file_for_translation,
            commands::batch_processor::write_translated_file,
            commands::batch_processor::create_output_structure,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
