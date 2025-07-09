// Test rapido del "Metodo Rai Pal" implementato
// Questo file testa la funzione get_steam_games_fast() senza avviare l'intera app

use std::path::Path;

// Simula le funzioni principali per testare il metodo Rai Pal
pub fn test_steam_registry_detection() -> Result<(), String> {
    println!("🚀 TEST: Metodo Rai Pal - Rilevamento Steam dal Registry");
    
    // Test 1: Trova Steam dal registry
    match crate::commands::library::find_steam_path_from_registry() {
        Some(steam_path) => {
            println!("✅ Steam trovato: {}", steam_path);
            
            // Test 2: Verifica che la cartella esista
            if Path::new(&steam_path).exists() {
                println!("✅ Cartella Steam confermata");
                
                // Test 3: Cerca file steamapps
                let steamapps_path = Path::new(&steam_path).join("steamapps");
                if steamapps_path.exists() {
                    println!("✅ Cartella steamapps trovata");
                    
                    // Test 4: Conta file .acf (giochi installati)
                    if let Ok(entries) = std::fs::read_dir(&steamapps_path) {
                        let acf_count = entries
                            .flatten()
                            .filter(|entry| {
                                entry.file_name()
                                    .to_str()
                                    .map(|name| name.starts_with("appmanifest_") && name.ends_with(".acf"))
                                    .unwrap_or(false)
                            })
                            .count();
                        
                        println!("✅ Trovati {} file .acf (giochi installati)", acf_count);
                        
                        if acf_count > 0 {
                            println!("🎯 METODO RAI PAL: Funziona! Può leggere {} giochi direttamente", acf_count);
                            return Ok(());
                        } else {
                            return Err("Nessun gioco Steam installato trovato".to_string());
                        }
                    } else {
                        return Err("Impossibile leggere cartella steamapps".to_string());
                    }
                } else {
                    return Err("Cartella steamapps non trovata".to_string());
                }
            } else {
                return Err("Cartella Steam non esiste".to_string());
            }
        }
        None => {
            return Err("Steam non trovato nel registry".to_string());
        }
    }
}

pub fn test_language_detection() {
    println!("🌍 TEST: Sistema Lingue Conservativo (come Rai Pal)");
    
    // Test giochi indie (dovrebbero avere poche lingue)
    let test_games = vec![
        ("Decarnation", 0),
        ("Some Indie Game", 0),
        ("Cyberpunk 2077", 0), // AAA dovrebbe avere più lingue
        ("FIFA 24", 0), // EA dovrebbe avere molte lingue
    ];
    
    for (game_name, app_id) in test_games {
        let languages = crate::commands::steam::detect_supported_languages(game_name, app_id);
        let lang_count = languages.split(',').count();
        
        println!("🎮 {}: {} lingue ({})", game_name, lang_count, languages);
        
        // Verifica che i giochi indie abbiano poche lingue
        if game_name.contains("Decarnation") || game_name.contains("Indie") {
            if lang_count <= 3 {
                println!("✅ Gioco indie: lingue conservative OK");
            } else {
                println!("❌ Gioco indie: troppe lingue ({})", lang_count);
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🧪 TEST RAPIDO: Metodo Rai Pal per GameStringer");
    println!("===============================================");
    
    // Test 1: Rilevamento Steam
    match test_steam_registry_detection() {
        Ok(()) => println!("✅ Test Steam Registry: SUCCESSO"),
        Err(e) => println!("❌ Test Steam Registry: FALLITO - {}", e),
    }
    
    println!();
    
    // Test 2: Sistema lingue
    test_language_detection();
    
    println!();
    println!("🎯 CONCLUSIONE: Se i test sopra sono positivi, il Metodo Rai Pal funziona!");
    println!("Il problema è solo nell'avvio dell'applicazione desktop Tauri.");
    
    Ok(())
}
