use tauri::command;
use std::path::Path;
use std::fs;
use std::io::Cursor;
use reqwest::Client;
use zip::ZipArchive;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct PatchStatus {
    success: bool,
    message: String,
    steps_completed: Vec<String>,
}

const BEPINEX_URL: &str = "https://github.com/BepInEx/BepInEx/releases/download/v5.4.22/BepInEx_x64_5.4.22.0.zip";
const XUNITY_URL: &str = "https://github.com/bbepis/XUnity.AutoTranslator/releases/download/v5.3.0/XUnity.AutoTranslator-BepInEx-5.3.0.zip";

#[command]
pub async fn install_unity_autotranslator(game_path: String, game_exe_name: String) -> Result<PatchStatus, String> {
    let mut steps = Vec::new();
    let game_dir = Path::new(&game_path);
    
    if !game_dir.exists() {
        return Err("Cartella del gioco non trovata".to_string());
    }

    // Verifica che sia effettivamente un gioco Unity
    // Cerca UnityPlayer.dll (Windows)
    if !game_dir.join("UnityPlayer.dll").exists() {
        // Fallback: a volte potrebbe non esserci nella root, ma è un check standard
        // Verifichiamo almeno che ci sia l'eseguibile del gioco
        if !game_dir.join(&game_exe_name).exists() {
             return Err(format!("Eseguibile del gioco '{}' non trovato nella cartella specificata", game_exe_name));
        }
        steps.push("Avviso: UnityPlayer.dll non trovato nella root, procedo comunque verificando l'eseguibile.".to_string());
    }

    // Verifica architettura (semplice check euristico o TODO per futuro)
    // Per ora assumiamo x64 come da URL hardcoded, ma avvisiamo
    steps.push("Nota: Installazione versione x64. Assicurati che il gioco sia a 64-bit.".to_string());

    // 1. Scarica e Installa BepInEx
    steps.push("Download BepInEx...".to_string());
    match download_and_extract(BEPINEX_URL, game_dir).await {
        Ok(_) => steps.push("BepInEx installato".to_string()),
        Err(e) => return Err(format!("Errore installazione BepInEx: {}", e)),
    }

    // 2. Scarica e Installa XUnity.AutoTranslator
    steps.push("Download XUnity.AutoTranslator...".to_string());
    match download_and_extract(XUNITY_URL, game_dir).await {
        Ok(_) => steps.push("XUnity.AutoTranslator installato".to_string()),
        Err(e) => return Err(format!("Errore installazione XUnity: {}", e)),
    }

    // 3. Configurazione Iniziale (Creazione cartelle se necessario)
    // Nota: La configurazione vera e propria viene generata al primo avvio del gioco da BepInEx
    // Ma possiamo pre-creare la cartella config per iniettare le nostre preferenze
    let config_dir = game_dir.join("BepInEx").join("config");
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    let auto_translator_config = config_dir.join("AutoTranslatorConfig.ini");
    if !auto_translator_config.exists() {
        let default_config = r#"[General]
Language=it
FromLanguage=en
MaxCharactersPerTranslation=200
IgnoreWhitespaceInDialogue=true
OverrideFont=
[Behaviour]
AutoTranslator=true
"#;
        fs::write(auto_translator_config, default_config).map_err(|e| e.to_string())?;
        steps.push("Configurazione base creata".to_string());
    }

    Ok(PatchStatus {
        success: true,
        message: "Patch Unity installata con successo! Avvia il gioco per completare il setup.".to_string(),
        steps_completed: steps,
    })
}

async fn download_and_extract(url: &str, target_dir: &Path) -> Result<(), String> {
    let client = Client::new();
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Download fallito: {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = target_dir.join(file.mangled_name());

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
