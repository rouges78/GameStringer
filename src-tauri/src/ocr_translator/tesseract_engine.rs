use std::path::PathBuf;
use crate::commands::process_util::no_window_command;

/// Risultato riconoscimento Tesseract
#[derive(Debug, Clone)]
pub struct TesseractResult {
    pub text: String,
    pub confidence: f32,
}

/// Motore OCR Tesseract (usa CLI esterno)
pub struct TesseractEngine {
    exe_path: Option<PathBuf>,
    language: String,
}

impl TesseractEngine {
    /// Crea nuovo motore Tesseract
    pub fn new(language: &str) -> Self {
        let exe_path = Self::find_tesseract_exe();
        
        Self {
            exe_path,
            language: language.to_string(),
        }
    }
    
    /// Trova eseguibile Tesseract
    fn find_tesseract_exe() -> Option<PathBuf> {
        let possible_paths = [
            PathBuf::from(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
            PathBuf::from(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
            PathBuf::from(r"tesseract.exe"), // Nel PATH
        ];
        
        for path in &possible_paths {
            if path.exists() {
                log::info!("🔍 Trovato Tesseract: {:?}", path);
                return Some(path.clone());
            }
        }
        
        // Prova nel PATH
        if let Ok(output) = no_window_command("where").arg("tesseract").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = path_str.lines().next() {
                    let path = PathBuf::from(first_line.trim());
                    if path.exists() {
                        log::info!("🔍 Trovato Tesseract nel PATH: {:?}", path);
                        return Some(path);
                    }
                }
            }
        }
        
        log::warn!("⚠️ Tesseract non trovato");
        None
    }
    
    /// Verifica se Tesseract è disponibile
    pub fn is_available(&self) -> bool {
        self.exe_path.is_some()
    }
    
    /// Riconosci testo da immagine in memoria (salva temp file)
    pub fn recognize_from_memory(&self, image_data: &[u8]) -> Result<TesseractResult, String> {
        let exe_path = self.exe_path.as_ref()
            .ok_or("Tesseract non installato")?;
        
        // Salva immagine temporanea
        let temp_dir = std::env::temp_dir();
        let input_path = temp_dir.join("gamestringer_ocr_input.png");
        let output_path = temp_dir.join("gamestringer_ocr_output");
        
        std::fs::write(&input_path, image_data)
            .map_err(|e| format!("Errore salvataggio immagine temp: {}", e))?;
        
        // Esegui Tesseract
        let output = no_window_command(exe_path)
            .arg(&input_path)
            .arg(&output_path)
            .arg("-l")
            .arg(&self.language)
            .arg("--psm")
            .arg("6") // Assume uniform block of text
            .output()
            .map_err(|e| format!("Errore esecuzione Tesseract: {}", e))?;
        
        // Cleanup input
        let _ = std::fs::remove_file(&input_path);
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Tesseract error: {}", stderr));
        }
        
        // Leggi output
        let output_txt = output_path.with_extension("txt");
        let text = std::fs::read_to_string(&output_txt)
            .map_err(|e| format!("Errore lettura output: {}", e))?;
        
        // Cleanup output
        let _ = std::fs::remove_file(&output_txt);
        
        Ok(TesseractResult {
            text: text.trim().to_string(),
            confidence: 85.0,
        })
    }
    
    /// Riconosci testo da file immagine
    #[allow(dead_code)]
    pub fn recognize_from_file(&self, image_path: &str) -> Result<TesseractResult, String> {
        let exe_path = self.exe_path.as_ref()
            .ok_or("Tesseract non installato")?;
        
        let temp_dir = std::env::temp_dir();
        let output_path = temp_dir.join("gamestringer_ocr_output");
        
        let output = no_window_command(exe_path)
            .arg(image_path)
            .arg(&output_path)
            .arg("-l")
            .arg(&self.language)
            .arg("--psm")
            .arg("6")
            .output()
            .map_err(|e| format!("Errore esecuzione Tesseract: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Tesseract error: {}", stderr));
        }
        
        let output_txt = output_path.with_extension("txt");
        let text = std::fs::read_to_string(&output_txt)
            .map_err(|e| format!("Errore lettura output: {}", e))?;
        
        let _ = std::fs::remove_file(&output_txt);
        
        Ok(TesseractResult {
            text: text.trim().to_string(),
            confidence: 85.0,
        })
    }
    
    /// Imposta lingua
    #[allow(dead_code)]
    pub fn set_language(&mut self, language: &str) {
        self.language = language.to_string();
    }
    
    /// Ottieni lingue disponibili
    pub fn get_available_languages(&self) -> Vec<String> {
        let Some(exe_path) = &self.exe_path else {
            return vec![];
        };
        
        // Esegui tesseract --list-langs
        let output = no_window_command(exe_path)
            .arg("--list-langs")
            .output();
        
        match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                stdout.lines()
                    .skip(1) // Prima riga è header
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }
            _ => vec![]
        }
    }
}

/// Mappa codice lingua ISO a Tesseract
pub fn map_language_code(iso_code: &str) -> &str {
    match iso_code.to_lowercase().as_str() {
        "en" | "eng" => "eng",
        "it" | "ita" => "ita",
        "ja" | "jpn" => "jpn",
        "zh" | "chi" | "zho" => "chi_sim",
        "ko" | "kor" => "kor",
        "de" | "deu" => "deu",
        "fr" | "fra" => "fra",
        "es" | "spa" => "spa",
        "pt" | "por" => "por",
        "ru" | "rus" => "rus",
        _ => iso_code,
    }
}
