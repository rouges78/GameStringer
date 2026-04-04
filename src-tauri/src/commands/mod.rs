// === Store integrations (cross-platform with #[cfg(windows)] for registry) ===
pub mod steam;
pub mod steam_enhanced;
pub mod epic;
pub mod epic_enhanced;
pub mod gog;
pub mod origin;
pub mod ubisoft;
pub mod battlenet;
pub mod itchio;
pub mod rockstar;
pub mod amazon;
pub mod xbox;
pub mod library;
pub mod store_detection;
pub mod launcher;
pub mod steam_workshop;

// === Core features (cross-platform) ===
pub mod extensions;
pub mod mod_profiles;
pub mod load_order;
pub mod games;
pub mod utilities;
pub mod patches;
pub mod dlc_manager;
pub mod profile_credentials;
#[allow(dead_code)]
pub mod profile_store_integration;
pub mod profiles;
pub mod profile_settings;
pub mod migration;
pub mod validation;
pub mod glossary;
pub mod translation_memory;
pub mod qa_check;
pub mod export_formats;
pub mod smart_glossary;
pub mod context_injection;
pub mod prediction_tool;
pub mod file_manager;
#[cfg(windows)]
pub mod translation_bridge;
#[cfg(not(windows))]
pub mod translation_bridge { pub use super::platform_stubs::translation_bridge_stubs::*; }
pub mod translation_api;
pub mod activity_history;
pub mod game_dictionaries;
pub mod updates;
pub mod image_cache;
pub mod backup;
pub mod audit_log;
pub mod secure_delete;
pub mod two_factor;
pub mod security;
pub mod global_hotkeys;
pub mod batch_processor;
pub mod community_hub;
pub mod project_export;
pub mod translation_diff;
pub mod translation_stats;
pub mod audio_patcher;
pub mod offline_translation;
pub mod ollama_manager;
pub mod system_monitor;
pub mod gspack;
#[allow(dead_code, unused_imports)]
pub mod notifications;

// === Game engine patchers (cross-platform, file-based) ===
pub mod unity_patcher;
pub mod unity_bundle;
pub mod unity_csv;
pub mod unity_asset_injector;
pub mod unreal_patcher;
pub mod unreal_localization;
pub mod unreal_iostore;
pub mod danganronpa_patcher;
pub mod rpgmaker_patcher;
pub mod renpy_patcher;
pub mod wolfrpg_patcher;
pub mod tyranoscript_patcher;

// === Windows-only modules (memory injection, WinAPI OCR, screen capture) ===
#[cfg(windows)]
pub mod injekt;
#[cfg(windows)]
pub mod anti_cheat;
#[cfg(windows)]
pub mod unity_injector;
#[cfg(windows)]
pub mod ue_translator;
#[cfg(windows)]
pub mod screen_capture;
#[cfg(windows)]
pub mod universal_injector;
// Auto-Hook Scanner (cross-platform, con stubs per non-Windows)
pub mod auto_hook;
// Unity .assets file manager (UABEA integration)
pub mod unity_assets;
// Game update tracker (Steam buildid + patch integrity)
pub mod game_update_tracker;
// GameTranslator.it community integration
pub mod gamestranslator_integration;
// repak wrapper (PAK creation via repak binary)
pub mod repak_wrapper;
// RSS proxy (bypass CORS per feed news)
pub mod rss_proxy;
// Godot Engine PCK patcher
pub mod godot_patcher;
// GameMaker data.win string extractor & patcher
pub mod gamemaker_patcher;
// Visionaire Studio 5 .vis archive patcher
pub mod visionaire_patcher;

// === Linux stubs for Windows-only modules ===
#[cfg(not(windows))]
pub mod injekt { pub use super::platform_stubs::*; }
#[cfg(not(windows))]
pub mod anti_cheat { pub use super::platform_stubs::*; }
#[cfg(not(windows))]
pub mod unity_injector { pub use super::platform_stubs::*; }
#[cfg(not(windows))]
pub mod ue_translator { pub use super::platform_stubs::*; }
#[cfg(not(windows))]
pub mod screen_capture { pub use super::platform_stubs::*; }
#[cfg(not(windows))]
pub mod universal_injector {}

// === Shared stubs for non-Windows platforms ===
#[cfg(not(windows))]
pub mod platform_stubs;
