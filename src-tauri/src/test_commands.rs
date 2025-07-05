// Test rapido per verificare che i comandi Tauri funzionino
use crate::commands::*;

#[tokio::test]
async fn test_steam_commands() {
    println!("🧪 Test Steam Commands");
    
    // Test auto_detect_steam_config
    match steam::auto_detect_steam_config().await {
        Ok(config) => println!("✅ auto_detect_steam_config: {:?}", config),
        Err(e) => println!("❌ auto_detect_steam_config: {}", e),
    }
    
    // Test get_steam_games
    match steam::get_steam_games("demo_key".to_string(), "demo_id".to_string(), false).await {
        Ok(games) => println!("✅ get_steam_games: {} giochi", games.len()),
        Err(e) => println!("❌ get_steam_games: {}", e),
    }
    
    // Test get_game_details
    match steam::get_game_details("730".to_string()).await {
        Ok(details) => println!("✅ get_game_details: {:?}", details),
        Err(e) => println!("❌ get_game_details: {}", e),
    }
}

#[tokio::test]
async fn test_library_commands() {
    println!("🧪 Test Library Commands");
    
    // Test get_library_games
    match library::get_library_games().await {
        Ok(games) => println!("✅ get_library_games: {:?}", games),
        Err(e) => println!("❌ get_library_games: {}", e),
    }
    
    // Test get_game_path
    match library::get_game_path("test_game".to_string()).await {
        Ok(path) => println!("✅ get_game_path: {:?}", path),
        Err(e) => println!("❌ get_game_path: {}", e),
    }
}

#[tokio::test]
async fn test_games_commands() {
    println!("🧪 Test Games Commands");
    
    // Test get_games
    match games::get_games().await {
        Ok(games) => println!("✅ get_games: {} giochi", games.len()),
        Err(e) => println!("❌ get_games: {}", e),
    }
    
    // Test scan_games
    match games::scan_games().await {
        Ok(results) => println!("✅ scan_games: {} risultati", results.len()),
        Err(e) => println!("❌ scan_games: {}", e),
    }
}

#[tokio::test]
async fn test_utilities_commands() {
    println!("🧪 Test Utilities Commands");
    
    // Test get_preferences
    match utilities::get_preferences().await {
        Ok(prefs) => println!("✅ get_preferences: {:?}", prefs),
        Err(e) => println!("❌ get_preferences: {}", e),
    }
    
    // Test get_cache_stats
    match utilities::get_cache_stats().await {
        Ok(stats) => println!("✅ get_cache_stats: {:?}", stats),
        Err(e) => println!("❌ get_cache_stats: {}", e),
    }
}

#[tokio::test]
async fn test_patches_commands() {
    println!("🧪 Test Patches Commands");
    
    // Test get_patches
    match patches::get_patches(None).await {
        Ok(patches) => println!("✅ get_patches: {:?}", patches),
        Err(e) => println!("❌ get_patches: {}", e),
    }
    
    // Test translate_text
    match patches::translate_text(
        "Hello World".to_string(),
        "openai".to_string(),
        "test_key".to_string(),
        "it".to_string()
    ).await {
        Ok(translation) => println!("✅ translate_text: {:?}", translation),
        Err(e) => println!("❌ translate_text: {}", e),
    }
}

#[tokio::test]
async fn test_injekt_commands() {
    println!("🧪 Test Injekt Commands");
    
    // Test test_injection
    match injekt::test_injection().await {
        Ok(result) => println!("✅ test_injection: {:?}", result),
        Err(e) => println!("❌ test_injection: {}", e),
    }
    
    // Test get_processes
    match injekt::get_processes().await {
        Ok(processes) => println!("✅ get_processes: {:?}", processes),
        Err(e) => println!("❌ get_processes: {}", e),
    }
}

pub async fn run_all_tests() {
    println!("🚀 Avvio test completo di tutti i comandi Tauri...");
    
    test_steam_commands().await;
    test_library_commands().await;
    test_games_commands().await;
    test_utilities_commands().await;
    test_patches_commands().await;
    test_injekt_commands().await;
    
    println!("✅ Test completo terminato!");
}
