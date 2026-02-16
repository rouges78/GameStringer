//! # Extension System Module
//! 
//! Sistema di estensioni per GameStringer ispirato a Vortex.
//! Permette di aggiungere supporto per nuovi store, giochi e funzionalità tramite plugin.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use log::{info, warn};

// ============================================================================
// STRUTTURE DATI
// ============================================================================

/// Tipo di estensione supportato
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExtensionType {
    /// Supporto per nuovo game store (es. Humble Bundle)
    GameStore,
    /// Supporto per gioco specifico (traduzione, mod, etc.)
    GameSupport,
    /// Tool di traduzione/localizzazione
    TranslationTool,
    /// Tema UI personalizzato
    Theme,
    /// Funzionalità generiche
    Utility,
}

/// Stato di un'estensione
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExtensionState {
    Enabled,
    Disabled,
    Error(String),
    NeedsUpdate,
}

/// Metadati di un'estensione
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionManifest {
    /// ID univoco dell'estensione
    pub id: String,
    /// Nome visualizzato
    pub name: String,
    /// Versione (semver)
    pub version: String,
    /// Descrizione
    pub description: String,
    /// Autore
    pub author: String,
    /// Tipo di estensione
    pub extension_type: ExtensionType,
    /// Versione minima di GameStringer richiesta
    pub min_app_version: Option<String>,
    /// Dipendenze da altre estensioni
    pub dependencies: Vec<String>,
    /// Giochi supportati (per GameSupport)
    pub supported_games: Vec<String>,
    /// URL repository/download
    pub repository: Option<String>,
    /// Entry point (file principale)
    pub main: String,
}

/// Un'estensione caricata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extension {
    pub manifest: ExtensionManifest,
    pub path: PathBuf,
    pub state: ExtensionState,
    pub load_order: i32,
    pub settings: HashMap<String, serde_json::Value>,
}

/// Manager delle estensioni
pub struct ExtensionManager {
    extensions: HashMap<String, Extension>,
    extensions_dir: PathBuf,
}

// ============================================================================
// IMPLEMENTAZIONE
// ============================================================================

impl ExtensionManager {
    pub fn new(extensions_dir: PathBuf) -> Self {
        Self {
            extensions: HashMap::new(),
            extensions_dir,
        }
    }
    
    /// Carica tutte le estensioni dalla directory
    pub async fn load_all(&mut self) -> Result<Vec<String>, String> {
        info!("[EXTENSIONS] Caricamento estensioni da: {:?}", self.extensions_dir);
        
        if !self.extensions_dir.exists() {
            std::fs::create_dir_all(&self.extensions_dir)
                .map_err(|e| format!("Errore creazione directory estensioni: {}", e))?;
            return Ok(Vec::new());
        }
        
        let mut loaded = Vec::new();
        
        if let Ok(entries) = std::fs::read_dir(&self.extensions_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    match self.load_extension(&path).await {
                        Ok(ext_id) => {
                            info!("[EXTENSIONS] ✅ Caricata: {}", ext_id);
                            loaded.push(ext_id);
                        }
                        Err(e) => {
                            warn!("[EXTENSIONS] ⚠️ Errore caricamento {:?}: {}", path, e);
                        }
                    }
                }
            }
        }
        
        info!("[EXTENSIONS] Caricate {} estensioni", loaded.len());
        Ok(loaded)
    }
    
    /// Carica una singola estensione
    async fn load_extension(&mut self, path: &PathBuf) -> Result<String, String> {
        let manifest_path = path.join("manifest.json");
        
        if !manifest_path.exists() {
            return Err("manifest.json non trovato".to_string());
        }
        
        let manifest_content = std::fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Errore lettura manifest: {}", e))?;
        
        let manifest: ExtensionManifest = serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Errore parsing manifest: {}", e))?;
        
        let extension = Extension {
            manifest: manifest.clone(),
            path: path.clone(),
            state: ExtensionState::Enabled,
            load_order: self.extensions.len() as i32,
            settings: HashMap::new(),
        };
        
        self.extensions.insert(manifest.id.clone(), extension);
        Ok(manifest.id)
    }
    
    /// Ottieni tutte le estensioni
    pub fn get_all(&self) -> Vec<&Extension> {
        self.extensions.values().collect()
    }
    
    /// Ottieni un'estensione per ID
    #[allow(dead_code)]
    pub fn get(&self, id: &str) -> Option<&Extension> {
        self.extensions.get(id)
    }
    
    /// Abilita/disabilita un'estensione
    pub fn set_enabled(&mut self, id: &str, enabled: bool) -> Result<(), String> {
        if let Some(ext) = self.extensions.get_mut(id) {
            ext.state = if enabled { ExtensionState::Enabled } else { ExtensionState::Disabled };
            Ok(())
        } else {
            Err(format!("Estensione '{}' non trovata", id))
        }
    }
    
    /// Ottieni estensioni per tipo
    #[allow(dead_code)]
    pub fn get_by_type(&self, ext_type: ExtensionType) -> Vec<&Extension> {
        self.extensions.values()
            .filter(|e| e.manifest.extension_type == ext_type && e.state == ExtensionState::Enabled)
            .collect()
    }
}

// ============================================================================
// COMANDI TAURI
// ============================================================================

use std::sync::Mutex;
use once_cell::sync::Lazy;

static EXTENSION_MANAGER: Lazy<Mutex<Option<ExtensionManager>>> = Lazy::new(|| Mutex::new(None));

fn get_extensions_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    
    PathBuf::from(home).join(".gamestringer").join("extensions")
}

/// Inizializza il sistema di estensioni
#[tauri::command]
pub async fn init_extension_system() -> Result<Vec<String>, String> {
    info!("[EXTENSIONS] Inizializzazione sistema estensioni...");
    
    let extensions_dir = get_extensions_dir();
    let mut manager = ExtensionManager::new(extensions_dir);
    let loaded = manager.load_all().await?;
    
    let mut global = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    *global = Some(manager);
    
    Ok(loaded)
}

/// Ottieni lista estensioni installate
#[tauri::command]
pub async fn get_installed_extensions() -> Result<Vec<Extension>, String> {
    let global = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    
    if let Some(manager) = global.as_ref() {
        Ok(manager.get_all().into_iter().cloned().collect())
    } else {
        Ok(Vec::new())
    }
}

/// Abilita/disabilita un'estensione
#[tauri::command]
pub async fn toggle_extension(id: String, enabled: bool) -> Result<(), String> {
    let mut global = EXTENSION_MANAGER.lock().map_err(|e| e.to_string())?;
    
    if let Some(manager) = global.as_mut() {
        manager.set_enabled(&id, enabled)
    } else {
        Err("Sistema estensioni non inizializzato".to_string())
    }
}

/// Installa un'estensione da URL o path locale
#[tauri::command]
pub async fn install_extension(source: String) -> Result<String, String> {
    info!("[EXTENSIONS] Installazione estensione da: {}", source);
    
    let extensions_dir = get_extensions_dir();
    
    // Crea directory se non esiste
    if !extensions_dir.exists() {
        std::fs::create_dir_all(&extensions_dir)
            .map_err(|e| format!("Errore creazione directory: {}", e))?;
    }
    
    // Download da URL HTTP/HTTPS
    if source.starts_with("http") {
        info!("[EXTENSIONS] Download estensione da URL: {}", source);
        
        let temp_dir = std::env::temp_dir().join("gamestringer_ext_download");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Errore creazione temp dir: {}", e))?;
        
        // Scarica il file
        let response = reqwest::get(&source).await
            .map_err(|e| format!("Errore download: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("Download fallito: HTTP {}", response.status()));
        }
        
        let content_type = response.headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        
        let bytes = response.bytes().await
            .map_err(|e| format!("Errore lettura risposta: {}", e))?;
        
        // Determina nome file dall'URL
        let url_path = source.split('?').next().unwrap_or(&source);
        let file_name = url_path.rsplit('/').next().unwrap_or("extension.zip").to_string();
        let is_zip = file_name.ends_with(".zip") || content_type.contains("zip");
        
        if is_zip {
            // Salva come ZIP temporaneo
            let zip_path = temp_dir.join(&file_name);
            std::fs::write(&zip_path, &bytes)
                .map_err(|e| format!("Errore scrittura file temp: {}", e))?;
            
            // Estrai ZIP
            let extract_dir = temp_dir.join("extracted");
            if extract_dir.exists() {
                let _ = std::fs::remove_dir_all(&extract_dir);
            }
            std::fs::create_dir_all(&extract_dir)
                .map_err(|e| format!("Errore creazione dir estrazione: {}", e))?;
            
            let zip_file = std::fs::File::open(&zip_path)
                .map_err(|e| format!("Errore apertura zip: {}", e))?;
            let mut archive = zip::ZipArchive::new(zip_file)
                .map_err(|e| format!("Errore lettura zip: {}", e))?;
            
            for i in 0..archive.len() {
                let mut file = archive.by_index(i)
                    .map_err(|e| format!("Errore file zip #{}: {}", i, e))?;
                let out_path = extract_dir.join(file.mangled_name());
                
                if file.name().ends_with('/') {
                    std::fs::create_dir_all(&out_path)
                        .map_err(|e| format!("Errore creazione dir: {}", e))?;
                } else {
                    if let Some(parent) = out_path.parent() {
                        std::fs::create_dir_all(parent)
                            .map_err(|e| format!("Errore creazione parent dir: {}", e))?;
                    }
                    let mut outfile = std::fs::File::create(&out_path)
                        .map_err(|e| format!("Errore creazione file: {}", e))?;
                    std::io::copy(&mut file, &mut outfile)
                        .map_err(|e| format!("Errore estrazione file: {}", e))?;
                }
            }
            
            // Trova la directory radice dell'estensione (contiene manifest.json)
            let ext_root = find_extension_root(&extract_dir)
                .ok_or("Nessun manifest.json trovato nell'archivio. Assicurati che il ZIP contenga una cartella con manifest.json.")?;
            
            let ext_name = ext_root.file_name()
                .unwrap_or_else(|| std::ffi::OsStr::new("unknown-ext"))
                .to_string_lossy()
                .to_string();
            
            let dest_path = extensions_dir.join(&ext_name);
            copy_dir_recursive(&ext_root, &dest_path)?;
            
            // Pulizia temp
            let _ = std::fs::remove_dir_all(&temp_dir);
            
            // Ricarica estensioni
            init_extension_system().await?;
            
            info!("[EXTENSIONS] ✅ Estensione installata da URL: {}", ext_name);
            return Ok(ext_name);
        } else {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err("Il file scaricato non è un archivio ZIP. Sono supportati solo file .zip.".to_string());
        }
    }
    
    let source_path = PathBuf::from(&source);
    if !source_path.exists() {
        return Err(format!("Percorso non trovato: {}", source));
    }
    
    // Copia la cartella dell'estensione
    let ext_name = source_path.file_name()
        .ok_or("Nome cartella non valido")?
        .to_string_lossy()
        .to_string();
    
    let dest_path = extensions_dir.join(&ext_name);
    
    copy_dir_recursive(&source_path, &dest_path)?;
    
    // Ricarica le estensioni
    init_extension_system().await?;
    
    Ok(ext_name)
}

/// Disinstalla un'estensione
#[tauri::command]
pub async fn uninstall_extension(id: String) -> Result<(), String> {
    info!("[EXTENSIONS] Disinstallazione estensione: {}", id);
    
    let extensions_dir = get_extensions_dir();
    let ext_path = extensions_dir.join(&id);
    
    if ext_path.exists() {
        std::fs::remove_dir_all(&ext_path)
            .map_err(|e| format!("Errore rimozione: {}", e))?;
    }
    
    // Ricarica le estensioni
    init_extension_system().await?;
    
    Ok(())
}

/// Crea un'estensione template
#[tauri::command]
pub async fn create_extension_template(name: String, ext_type: String) -> Result<String, String> {
    info!("[EXTENSIONS] Creazione template estensione: {} ({})", name, ext_type);
    
    let extensions_dir = get_extensions_dir();
    let ext_id = name.to_lowercase().replace(" ", "-");
    let ext_path = extensions_dir.join(&ext_id);
    
    if ext_path.exists() {
        return Err(format!("Estensione '{}' già esistente", ext_id));
    }
    
    std::fs::create_dir_all(&ext_path)
        .map_err(|e| format!("Errore creazione directory: {}", e))?;
    
    let extension_type = match ext_type.as_str() {
        "game_store" => ExtensionType::GameStore,
        "game_support" => ExtensionType::GameSupport,
        "translation" => ExtensionType::TranslationTool,
        "theme" => ExtensionType::Theme,
        _ => ExtensionType::Utility,
    };
    
    let manifest = ExtensionManifest {
        id: ext_id.clone(),
        name: name.clone(),
        version: "1.0.0".to_string(),
        description: format!("Estensione {} per GameStringer", name),
        author: "Your Name".to_string(),
        extension_type,
        min_app_version: Some("1.0.0".to_string()),
        dependencies: Vec::new(),
        supported_games: Vec::new(),
        repository: None,
        main: "index.js".to_string(),
    };
    
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(ext_path.join("manifest.json"), manifest_json)
        .map_err(|e| format!("Errore scrittura manifest: {}", e))?;
    
    // Crea file index.js template
    let index_content = r#"// Extension: {{NAME}}
// Questo file viene caricato quando l'estensione è attiva

module.exports = {
    // Chiamato quando l'estensione viene caricata
    init: function(api) {
        console.log('Extension {{NAME}} loaded!');
    },
    
    // Chiamato quando l'estensione viene disattivata
    cleanup: function() {
        console.log('Extension {{NAME}} unloaded');
    }
};
"#.replace("{{NAME}}", &name);
    
    std::fs::write(ext_path.join("index.js"), index_content)
        .map_err(|e| format!("Errore scrittura index.js: {}", e))?;
    
    // Crea README
    let readme_content = format!(r#"# {}

## Descrizione
Estensione per GameStringer.

## Installazione
1. Copia questa cartella in `~/.gamestringer/extensions/`
2. Riavvia GameStringer
3. Abilita l'estensione nelle impostazioni

## Sviluppo
Modifica `index.js` per implementare la logica dell'estensione.

## Licenza
MIT
"#, name);
    
    std::fs::write(ext_path.join("README.md"), readme_content)
        .map_err(|e| format!("Errore scrittura README: {}", e))?;
    
    info!("[EXTENSIONS] ✅ Template creato: {:?}", ext_path);
    
    Ok(ext_path.to_string_lossy().to_string())
}

// Helper: trova la directory radice di un'estensione (contiene manifest.json)
fn find_extension_root(dir: &PathBuf) -> Option<PathBuf> {
    // manifest.json nella root stessa?
    if dir.join("manifest.json").exists() {
        return Some(dir.clone());
    }
    // Cerca nelle sottodirectory (massimo 2 livelli)
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if path.join("manifest.json").exists() {
                    return Some(path);
                }
                // Un livello più in profondità
                if let Ok(sub_entries) = std::fs::read_dir(&path) {
                    for sub in sub_entries.flatten() {
                        let sub_path = sub.path();
                        if sub_path.is_dir() && sub_path.join("manifest.json").exists() {
                            return Some(sub_path);
                        }
                    }
                }
            }
        }
    }
    None
}

// Helper per copiare directory
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    if !dst.exists() {
        std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    }
    
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let dest_path = dst.join(entry.file_name());
        
        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            std::fs::copy(&path, &dest_path).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}
