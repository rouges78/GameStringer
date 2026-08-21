//! Dictionary Engine for GameStringer Translation Bridge
//! 
//! Gestisce i dizionari di traduzione in memoria con:
//! - HashMap ottimizzata per lookup O(1) tramite hash
//! - Hot-reload senza riavvio
//! - Supporto multi-lingua

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use super::protocol::TranslationRequest;

/// Entry di traduzione
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationEntry {
    /// Testo originale
    pub original: String,
    /// Testo tradotto
    pub translated: String,
    /// Contesto opzionale
    pub context: Option<String>,
    /// Se la traduzione è stata verificata manualmente
    pub verified: bool,
}

/// Limite massimo di entry per dizionario (previene OOM con file enormi)
const MAX_DICTIONARY_ENTRIES: usize = 500_000;

/// Dizionario per una coppia di lingue.
/// Storage singolo indicizzato per hash FNV-1a; il testo originale è dentro l'entry
/// per risolvere collisioni hash senza duplicare l'intera mappa.
#[derive(Debug, Default)]
pub struct LanguageDictionary {
    /// Traduzioni indicizzate per hash — unico storage
    entries: HashMap<u64, TranslationEntry>,
}

impl LanguageDictionary {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self::default()
    }

    /// Aggiunge una traduzione. Sovrascrive se la chiave esiste già (nessun count drift).
    /// Ritorna false se il dizionario ha raggiunto il limite massimo.
    pub fn add(&mut self, original: String, translated: String) -> bool {
        use std::collections::hash_map::Entry;
        let hash = TranslationRequest::compute_hash(&original);
        let at_capacity = self.entries.len() >= MAX_DICTIONARY_ENTRIES;

        match self.entries.entry(hash) {
            Entry::Occupied(mut e) => {
                let entry = e.get_mut();
                entry.original = original;
                entry.translated = translated;
                true
            }
            Entry::Vacant(e) => {
                if at_capacity { return false; }
                e.insert(TranslationEntry {
                    original,
                    translated,
                    context: None,
                    verified: false,
                });
                true
            }
        }
    }

    /// Cerca traduzione per hash (O(1), verifica collisioni)
    pub fn get_by_hash(&self, hash: u64, original_text: &str) -> Option<&TranslationEntry> {
        self.entries.get(&hash).filter(|e| e.original == original_text)
    }

    /// Controlla se un hash esiste (per diagnostica collisioni)
    pub fn has_hash(&self, hash: u64) -> bool {
        self.entries.contains_key(&hash)
    }

    /// Numero di traduzioni
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Pulisce il dizionario
    #[allow(dead_code)]
    pub fn clear(&mut self) {
        self.entries.clear();
    }

    /// Iteratore sulle entry (per export)
    pub fn iter(&self) -> impl Iterator<Item = &TranslationEntry> {
        self.entries.values()
    }
}

/// Dictionary Engine - Gestisce tutti i dizionari
#[derive(Debug, Default)]
pub struct DictionaryEngine {
    /// Dizionari per coppia di lingue (es. "en_it" -> dizionario)
    dictionaries: HashMap<String, LanguageDictionary>,
    /// Lingua sorgente attiva
    active_source: String,
    /// Lingua target attiva
    active_target: String,
    #[allow(dead_code)]
    /// Path per hot-reload con ultimo modification time noto
    watch_paths: HashMap<String, Option<SystemTime>>,
}

impl DictionaryEngine {
    pub fn new() -> Self {
        Self {
            dictionaries: HashMap::new(),
            active_source: "en".to_string(),
            active_target: "it".to_string(),
            watch_paths: HashMap::new(),
        }
    }
    
    /// Imposta la coppia di lingue attiva
    pub fn set_active_languages(&mut self, source: &str, target: &str) {
        self.active_source = source.to_string();
        self.active_target = target.to_string();
        info!("[DictionaryEngine] Lingue attive: {} -> {}", source, target);
    }
    
    /// Ottieni la chiave per una coppia di lingue
    fn get_key(source: &str, target: &str) -> String {
        format!("{}_{}", source, target)
    }
    
    /// Carica traduzioni per una coppia di lingue
    pub fn load_translations(&mut self, source: &str, target: &str, translations: Vec<(String, String)>) -> usize {
        let key = Self::get_key(source, target);
        let dict = self.dictionaries.entry(key).or_default();
        
        let count = translations.len();
        for (original, translated) in translations {
            dict.add(original, translated);
        }
        
        info!("[DictionaryEngine] Caricate {} traduzioni per {} -> {}", count, source, target);
        count
    }
    
    /// Carica traduzioni da file JSON
    pub fn load_from_json(&mut self, path: &str) -> Result<usize, String> {
        let path = Path::new(path);
        
        if !path.exists() {
            return Err(format!("File non trovato: {}", path.display()));
        }
        
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Errore lettura file: {}", e))?;
        
        // Supporta diversi formati JSON
        // Formato 1: { "original": "translated", ... }
        // Formato 2: [ { "original": "...", "translated": "..." }, ... ]
        // Formato 3: { "source": "en", "target": "it", "translations": {...} }
        
        if let Ok(simple_map) = serde_json::from_str::<HashMap<String, String>>(&content) {
            let translations: Vec<(String, String)> = simple_map.into_iter().collect();
            return Ok(self.load_translations(&self.active_source.clone(), &self.active_target.clone(), translations));
        }
        
        if let Ok(array) = serde_json::from_str::<Vec<TranslationEntry>>(&content) {
            let translations: Vec<(String, String)> = array
                .into_iter()
                .map(|e| (e.original, e.translated))
                .collect();
            return Ok(self.load_translations(&self.active_source.clone(), &self.active_target.clone(), translations));
        }
        
        // Formato con metadata
        #[derive(Deserialize)]
        struct DictionaryFile {
            source: Option<String>,
            target: Option<String>,
            translations: HashMap<String, String>,
        }
        
        if let Ok(dict_file) = serde_json::from_str::<DictionaryFile>(&content) {
            let source = dict_file.source.unwrap_or_else(|| self.active_source.clone());
            let target = dict_file.target.unwrap_or_else(|| self.active_target.clone());
            let translations: Vec<(String, String)> = dict_file.translations.into_iter().collect();
            return Ok(self.load_translations(&source, &target, translations));
        }
        
        Err("Formato JSON non riconosciuto".to_string())
    }
    
    /// Carica traduzioni da file CSV.
    /// Supporta campi quotati con virgole interne e escape `""` → `"`.
    #[allow(dead_code)]
    pub fn load_from_csv(&mut self, path: &str, source_col: usize, target_col: usize) -> Result<usize, String> {
        let path = Path::new(path);

        if !path.exists() {
            return Err(format!("File non trovato: {}", path.display()));
        }

        let content = fs::read_to_string(path)
            .map_err(|e| format!("Errore lettura file: {}", e))?;

        let mut translations = Vec::new();

        for (line_num, line) in content.lines().enumerate() {
            if line_num == 0 { continue; } // skip header

            let cols = Self::parse_csv_line(line);
            let max_col = source_col.max(target_col);

            if cols.len() > max_col {
                let original = cols[source_col].trim().to_string();
                let translated = cols[target_col].trim().to_string();

                if !original.is_empty() && !translated.is_empty() {
                    translations.push((original, translated));
                }
            }
        }

        Ok(self.load_translations(&self.active_source.clone(), &self.active_target.clone(), translations))
    }

    /// Parse di una riga CSV con supporto campi quotati e escape `""`.
    fn parse_csv_line(line: &str) -> Vec<String> {
        let mut fields = Vec::new();
        let mut current = String::new();
        let mut in_quotes = false;
        let mut chars = line.chars().peekable();

        while let Some(ch) = chars.next() {
            match ch {
                '"' if !in_quotes && current.is_empty() => {
                    in_quotes = true;
                }
                '"' if in_quotes => {
                    // "" escape → literal "
                    if chars.peek() == Some(&'"') {
                        current.push('"');
                        chars.next();
                    } else {
                        in_quotes = false;
                    }
                }
                ',' if !in_quotes => {
                    fields.push(current.clone());
                    current.clear();
                }
                _ => {
                    current.push(ch);
                }
            }
        }
        fields.push(current);
        fields
    }
    
    /// Cerca una traduzione (usa la coppia di lingue attiva)
    pub fn get_translation(&self, hash: u64, original_text: &str) -> Option<String> {
        let key = Self::get_key(&self.active_source, &self.active_target);

        if let Some(dict) = self.dictionaries.get(&key) {
            if let Some(entry) = dict.get_by_hash(hash, original_text) {
                return Some(entry.translated.clone());
            }
            // Hash presente ma original diverso = collisione FNV-1a (estremamente rara)
            if dict.has_hash(hash) {
                info!("[DictionaryEngine] Collisione hash FNV-1a per '{}' (hash={})", original_text, hash);
            }
        }

        None
    }

    /// Cerca traduzione con coppia di lingue specifica
    #[allow(dead_code)]
    pub fn get_translation_for(&self, source: &str, target: &str, original_text: &str) -> Option<String> {
        let key = Self::get_key(source, target);
        let hash = TranslationRequest::compute_hash(original_text);

        if let Some(dict) = self.dictionaries.get(&key) {
            if let Some(entry) = dict.get_by_hash(hash, original_text) {
                return Some(entry.translated.clone());
            }
        }

        None
    }
    
    /// Aggiunge una singola traduzione
    pub fn add_translation(&mut self, original: String, translated: String) {
        let key = Self::get_key(&self.active_source, &self.active_target);
        let dict = self.dictionaries.entry(key).or_default();
        dict.add(original, translated);
    }
    
    /// Batch translation lookup — traduce più testi in una sola chiamata
    #[allow(dead_code)]
    pub fn batch_translate(&self, texts: &[String]) -> Vec<Option<String>> {
        let key = Self::get_key(&self.active_source, &self.active_target);

        if let Some(dict) = self.dictionaries.get(&key) {
            texts.iter().map(|text| {
                let hash = TranslationRequest::compute_hash(text);
                dict.get_by_hash(hash, text).map(|e| e.translated.clone())
            }).collect()
        } else {
            vec![None; texts.len()]
        }
    }

    /// Registra un file JSON per hot-reload. Carica immediatamente e memorizza il mtime.
    #[allow(dead_code)]
    pub fn watch_file(&mut self, path: &str) -> Result<usize, String> {
        let count = self.load_from_json(path)?;
        let mtime = fs::metadata(path).ok().and_then(|m| m.modified().ok());
        self.watch_paths.insert(path.to_string(), mtime);
        info!("[DictionaryEngine] Watching file: {} ({} traduzioni)", path, count);
        Ok(count)
    }

    /// Controlla tutti i file watched per modifiche e ricarica quelli cambiati.
    /// Ritorna il numero totale di traduzioni ricaricate.
    #[allow(dead_code)]
    pub fn check_and_reload(&mut self) -> usize {
        // Fase 1: raccogli i path da ricaricare (borrow immutabile)
        let mut to_reload: Vec<(String, SystemTime)> = Vec::new();

        for (path, last_mtime) in &self.watch_paths {
            if let Ok(meta) = fs::metadata(path) {
                if let Ok(current_mtime) = meta.modified() {
                    let changed = match last_mtime {
                        Some(prev) => current_mtime > *prev,
                        None => true,
                    };
                    if changed {
                        to_reload.push((path.clone(), current_mtime));
                    }
                }
            }
        }

        // Fase 2: ricarica i file modificati (borrow mutabile)
        let mut reloaded = 0;
        for (path, mtime) in to_reload {
            match self.load_from_json(&path) {
                Ok(count) => {
                    info!("[DictionaryEngine] Hot-reload: {} ({} traduzioni)", path, count);
                    reloaded += count;
                    self.watch_paths.insert(path, Some(mtime));
                }
                Err(e) => {
                    warn!("[DictionaryEngine] Hot-reload errore {}: {}", path, e);
                }
            }
        }

        reloaded
    }

    /// Ottieni statistiche
    pub fn get_stats(&self) -> DictionaryStats {
        let mut total_entries = 0;
        let mut languages = Vec::new();
        
        for (key, dict) in &self.dictionaries {
            total_entries += dict.len();
            languages.push(key.clone());
        }
        
        DictionaryStats {
            total_entries,
            language_pairs: languages,
            active_source: self.active_source.clone(),
            active_target: self.active_target.clone(),
        }
    }
    
    /// Salva tutti i dizionari su disco in formato JSON
    pub fn save_to_dir(&self, dir: &str) -> Result<usize, String> {
        let dir_path = Path::new(dir);
        fs::create_dir_all(dir_path)
            .map_err(|e| format!("Impossibile creare directory: {}", e))?;

        let mut saved = 0;
        for (key, dict) in &self.dictionaries {
            if dict.is_empty() { continue; }
            let file_path = dir_path.join(format!("{}.json", key));
            let translations: HashMap<String, String> = dict.iter()
                .map(|entry| (entry.original.clone(), entry.translated.clone()))
                .collect();
            let json = serde_json::to_string_pretty(&translations)
                .map_err(|e| format!("Errore serializzazione {}: {}", key, e))?;
            fs::write(&file_path, json)
                .map_err(|e| format!("Errore scrittura {}: {}", file_path.display(), e))?;
            saved += translations.len();
        }
        info!("[DictionaryEngine] Salvate {} traduzioni in {}", saved, dir);
        Ok(saved)
    }

    /// Carica tutti i dizionari da una directory
    pub fn load_from_dir(&mut self, dir: &str) -> Result<usize, String> {
        let dir_path = Path::new(dir);
        if !dir_path.exists() { return Ok(0); }

        let mut loaded = 0;
        let entries = fs::read_dir(dir_path)
            .map_err(|e| format!("Errore lettura directory: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }

            let stem = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            // Il nome file è "source_target.json" (es. "en_it.json")
            let parts: Vec<&str> = stem.splitn(2, '_').collect();
            if parts.len() != 2 { continue; }

            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Errore lettura {}: {}", path.display(), e))?;
            let map: HashMap<String, String> = serde_json::from_str(&content)
                .map_err(|e| format!("Errore parsing {}: {}", path.display(), e))?;

            let translations: Vec<(String, String)> = map.into_iter().collect();
            let count = translations.len();
            self.load_translations(parts[0], parts[1], translations);
            loaded += count;
        }

        info!("[DictionaryEngine] Caricate {} traduzioni da {}", loaded, dir);
        Ok(loaded)
    }

    /// Pulisce tutti i dizionari
    pub fn clear_all(&mut self) {
        self.dictionaries.clear();
        info!("[DictionaryEngine] Tutti i dizionari puliti");
    }
    
    /// Pulisce un dizionario specifico
    #[allow(dead_code)]
    pub fn clear_pair(&mut self, source: &str, target: &str) {
        let key = Self::get_key(source, target);
        if let Some(dict) = self.dictionaries.get_mut(&key) {
            dict.clear();
            info!("[DictionaryEngine] Dizionario {} -> {} pulito", source, target);
        }
    }
    
    /// Esporta traduzioni in JSON
    /// Esporta la coppia di lingue attiva nel formato GSTC che la cache locale
    /// di gs-hook sa leggere (`unreal-translator/hook-dll/src/cache.cpp`).
    ///
    /// PERCHÉ ESISTE. Su Unreal la stessa stringa passa da `FText::ToString`
    /// una volta sola — la display string resta in cache dentro l'`FTextData` —
    /// quindi il percorso fire-and-forget della DLL, che chiede la traduzione al
    /// primo avvistamento e la usa dal secondo, non scatta mai. Se il testo non
    /// è già tradotto quando viene convertito, a schermo non cambia niente.
    /// Questo file va scritto PRIMA dell'iniezione.
    ///
    /// Formato: magic u32 LE `0x47535443` (sul disco sono i byte `CTSG`, non
    /// `GSTC`: sbagliare l'ordine fa rifiutare il file in silenzio), version
    /// u32 = 1, count u32, e per ogni voce `len u32` + testo UTF-16LE senza NUL,
    /// prima l'originale e poi la traduzione. `len` conta unità UTF-16, non
    /// caratteri Unicode: il C++ legge `len * sizeof(wchar_t)` byte.
    pub fn export_gstc(&self, path: &str) -> Result<usize, String> {
        let key = Self::get_key(&self.active_source, &self.active_target);
        let dict = self
            .dictionaries
            .get(&key)
            .ok_or_else(|| format!("Nessun dizionario per {}", key))?;

        let entries: Vec<&TranslationEntry> = dict.iter().collect();
        let mut buf: Vec<u8> = Vec::with_capacity(entries.len() * 64 + 12);
        buf.extend_from_slice(&0x4753_5443u32.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&(entries.len() as u32).to_le_bytes());

        for entry in &entries {
            for text in [&entry.original, &entry.translated] {
                let units: Vec<u16> = text.encode_utf16().collect();
                buf.extend_from_slice(&(units.len() as u32).to_le_bytes());
                for u in units {
                    buf.extend_from_slice(&u.to_le_bytes());
                }
            }
        }

        if let Some(parent) = Path::new(path).parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Impossibile creare {}: {}", parent.display(), e))?;
        }
        fs::write(path, &buf).map_err(|e| format!("Errore scrittura {}: {}", path, e))?;

        info!(
            "[DictionaryEngine] Esportate {} traduzioni in GSTC: {}",
            entries.len(),
            path
        );
        Ok(entries.len())
    }

    pub fn export_to_json(&self, path: &str) -> Result<(), String> {
        let key = Self::get_key(&self.active_source, &self.active_target);
        
        let dict = self.dictionaries.get(&key)
            .ok_or_else(|| "Dizionario non trovato".to_string())?;
        
        let translations: HashMap<String, String> = dict.iter()
            .map(|entry| (entry.original.clone(), entry.translated.clone()))
            .collect();
        
        let json = serde_json::to_string_pretty(&translations)
            .map_err(|e| format!("Errore serializzazione: {}", e))?;
        
        fs::write(path, json)
            .map_err(|e| format!("Errore scrittura file: {}", e))?;
        
        info!("[DictionaryEngine] Esportate {} traduzioni in {}", translations.len(), path);
        Ok(())
    }
}

/// Statistiche del dictionary engine
#[derive(Debug, Clone, Serialize)]
pub struct DictionaryStats {
    pub total_entries: usize,
    pub language_pairs: Vec<String>,
    pub active_source: String,
    pub active_target: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_dictionary_add_and_get() {
        let mut engine = DictionaryEngine::new();
        engine.set_active_languages("en", "it");
        
        engine.add_translation("Hello".to_string(), "Ciao".to_string());
        engine.add_translation("World".to_string(), "Mondo".to_string());
        
        let hash = TranslationRequest::compute_hash("Hello");
        assert_eq!(engine.get_translation(hash, "Hello"), Some("Ciao".to_string()));
        
        let hash2 = TranslationRequest::compute_hash("World");
        assert_eq!(engine.get_translation(hash2, "World"), Some("Mondo".to_string()));
    }
    
    #[test]
    fn test_dictionary_not_found() {
        let engine = DictionaryEngine::new();
        let hash = TranslationRequest::compute_hash("Unknown");
        assert_eq!(engine.get_translation(hash, "Unknown"), None);
    }
    
    #[test]
    fn test_load_translations() {
        let mut engine = DictionaryEngine::new();
        
        let translations = vec![
            ("Hello".to_string(), "Ciao".to_string()),
            ("Goodbye".to_string(), "Arrivederci".to_string()),
        ];
        
        let count = engine.load_translations("en", "it", translations);
        assert_eq!(count, 2);
        
        let stats = engine.get_stats();
        assert_eq!(stats.total_entries, 2);
    }
    
    #[test]
    fn test_export_gstc_formato_leggibile_dal_cpp() {
        // Il magic va scritto come u32 little-endian 0x47535443, che sul disco
        // da' i byte "CTSG". Scriverlo come "GSTC" fa rifiutare il file in
        // silenzio da cache.cpp: nessun errore, cache vuota, e il gioco resta
        // in inglese senza che niente lo segnali.
        let dir = std::env::temp_dir().join("gs_gstc_test");
        let _ = fs::remove_dir_all(&dir);
        let path = dir.join("c.gstc");

        let mut engine = DictionaryEngine::new();
        engine.set_active_languages("en", "it");
        engine.load_translations(
            "en",
            "it",
            vec![("Exit game".to_string(), "Esci dal gioco".to_string())],
        );

        let n = engine.export_gstc(path.to_str().unwrap()).unwrap();
        assert_eq!(n, 1);

        let raw = fs::read(&path).unwrap();
        assert_eq!(&raw[0..4], b"CTSG", "il magic sul disco deve essere CTSG");
        assert_eq!(u32::from_le_bytes(raw[4..8].try_into().unwrap()), 1, "version");
        assert_eq!(u32::from_le_bytes(raw[8..12].try_into().unwrap()), 1, "count");

        // len e' in unita' UTF-16, e il C++ legge len * sizeof(wchar_t) byte.
        let orig_len = u32::from_le_bytes(raw[12..16].try_into().unwrap()) as usize;
        assert_eq!(orig_len, "Exit game".encode_utf16().count());
        let orig: Vec<u16> = raw[16..16 + orig_len * 2]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        assert_eq!(String::from_utf16(&orig).unwrap(), "Exit game");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_export_gstc_senza_dizionario_attivo() {
        let engine = DictionaryEngine::new();
        let path = std::env::temp_dir().join("gs_gstc_vuoto.gstc");
        assert!(engine.export_gstc(path.to_str().unwrap()).is_err());
    }

    #[test]
    fn test_duplicate_key_no_count_drift() {
        let mut engine = DictionaryEngine::new();
        engine.set_active_languages("en", "it");

        engine.add_translation("Hello".to_string(), "Ciao".to_string());
        engine.add_translation("Hello".to_string(), "Salve".to_string()); // update, not new

        let stats = engine.get_stats();
        assert_eq!(stats.total_entries, 1, "duplicate key should not increment count");

        let hash = TranslationRequest::compute_hash("Hello");
        assert_eq!(engine.get_translation(hash, "Hello"), Some("Salve".to_string()));
    }

    #[test]
    fn test_multiple_language_pairs() {
        let mut engine = DictionaryEngine::new();
        
        engine.load_translations("en", "it", vec![
            ("Hello".to_string(), "Ciao".to_string()),
        ]);
        
        engine.load_translations("en", "de", vec![
            ("Hello".to_string(), "Hallo".to_string()),
        ]);
        
        engine.set_active_languages("en", "it");
        let hash = TranslationRequest::compute_hash("Hello");
        assert_eq!(engine.get_translation(hash, "Hello"), Some("Ciao".to_string()));
        
        engine.set_active_languages("en", "de");
        assert_eq!(engine.get_translation(hash, "Hello"), Some("Hallo".to_string()));
    }
}
