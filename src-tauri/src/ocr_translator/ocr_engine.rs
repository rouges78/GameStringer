// OCR Engine - Windows.Media.Ocr API

use super::{DetectedText, screen_capture::ImageData};

#[cfg(target_os = "windows")]
use windows::{
    core::HSTRING,
    Globalization::Language,
    Media::Ocr::OcrEngine,
    Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap},
};

/// Marcatore dell'errore «lingua OCR non installata». Il frontend lo cerca
/// nel messaggio per mostrare l'indicazione tradotta (vedi
/// `OCR_LANGUAGE_NOT_INSTALLED` in `lib/ocr-overlay-payload.ts`).
#[cfg(target_os = "windows")]
const OCR_LANGUAGE_NOT_INSTALLED: &str = "OCR_LANGUAGE_NOT_INSTALLED";
    
/// Crea il motore OCR per la lingua sorgente richiesta.
///
/// Prima si usava sempre `TryCreateFromUserProfileLanguages` e la lingua era
/// ignorata: su un Windows in italiano/inglese il giapponese, il cinese o il
/// coreano non venivano mai riconosciuti, qualunque lingua si scegliesse.
/// "auto" (o vuoto) resta sulle lingue del profilo utente: è l'unica forma di
/// automatico che Windows OCR offre.
#[cfg(target_os = "windows")]
fn create_engine(language: &str) -> Result<OcrEngine, String> {
    let tag = language.trim();
    if tag.is_empty() || tag.eq_ignore_ascii_case("auto") {
        return OcrEngine::TryCreateFromUserProfileLanguages().map_err(|_| {
            format!(
                "{}: none of the Windows profile languages has text recognition (OCR) installed. \
                 Add a language pack with optical character recognition in Settings > Time & language > Language & region.",
                OCR_LANGUAGE_NOT_INSTALLED
            )
        });
    }
    
    let lang = Language::CreateLanguage(&HSTRING::from(tag))
        .map_err(|e| format!("Invalid OCR language '{}': {:?}", tag, e))?;

    if !OcrEngine::IsLanguageSupported(&lang).unwrap_or(false) {
        // Un riconoscitore installato con la stessa scrittura legge comunque
        // il testo: misurato su un Windows con il solo OCR it-IT, «en» non è
        // supportato ma l'italiano legge l'inglese (entrambi "Latn"). Il
        // giapponese ("Jpan") invece no, ed è lì che serve il language pack.
        if let Some(engine) = engine_with_same_script(&lang) {
            return Ok(engine);
        }
        return Err(format!(
            "{}: Windows has no text recognition (OCR) for '{}'. \
             Install its language pack with optical character recognition in Settings > Time & language > Language & region, then start again.",
            OCR_LANGUAGE_NOT_INSTALLED, tag
        ));
    }

    OcrEngine::TryCreateFromLanguage(&lang)
        .map_err(|e| format!("Failed to create OCR engine for '{}': {:?}", tag, e))
}

/// Primo riconoscitore installato che usa la stessa scrittura di `lang`.
/// Le scritture indeterminate (Zyyy, Zzzz, Zxxx — p.es. "zh" senza Hans/Hant)
/// non combaciano con niente.
#[cfg(target_os = "windows")]
fn engine_with_same_script(lang: &Language) -> Option<OcrEngine> {
    let script = lang.Script().ok()?.to_string();
    if script.len() != 4 || script.starts_with('Z') {
        return None;
    }
    let available = OcrEngine::AvailableRecognizerLanguages().ok()?;
    for i in 0..available.Size().unwrap_or(0) {
        let candidate = match available.GetAt(i) {
            Ok(c) => c,
            Err(_) => continue,
        };
        if candidate.Script().map(|s| s.to_string() == script).unwrap_or(false) {
            let engine = OcrEngine::TryCreateFromLanguage(&candidate).ok()?;
            // debug, non info: il motore si ricrea a ogni fotogramma (ogni
            // 500 ms nel loop OCR), e a livello info riempirebbe il log.
            log::debug!(
                "OCR: nessun riconoscitore per {:?}, uso {:?} (stessa scrittura {})",
                lang.LanguageTag().unwrap_or_default(),
                candidate.LanguageTag().unwrap_or_default(),
                script
            );
            return Some(engine);
        }
    }
    None
}
    
/// Verifica che la lingua sorgente sia riconoscibile, senza eseguire l'OCR.
#[cfg(target_os = "windows")]
pub fn check_language(language: &str) -> Result<(), String> {
    create_engine(language).map(|_| ())
}

/// Riconosce testo da un'immagine usando Windows OCR
#[cfg(target_os = "windows")]
pub fn recognize_text(image: &ImageData, language: &str) -> Result<Vec<DetectedText>, String> {
    log::debug!("OCR su immagine {}x{}, lingua: {}", image.width, image.height, language);

    let engine = create_engine(language)?;

    // Converti BGRA a SoftwareBitmap
    let bitmap = create_software_bitmap(image)?;
    
    // Esegui OCR. `get()` aspetta in modo sincrono. Prima si costruiva un
    // runtime tokio e si chiamava `block_on`: dentro i comandi async
    // `ocr_recognize`/`ocr_recognize_png` Tokio va in panico («Cannot start a
    // runtime from within a runtime») e /live-ocr non riceveva mai risposta.
    let result = engine.RecognizeAsync(&bitmap)
        .map_err(|e| format!("OCR failed: {:?}", e))?
        .get()
        .map_err(|e| format!("OCR await failed: {:?}", e))?;
    
    // Estrai testi rilevati
    let mut detected = Vec::new();
    
    if let Ok(lines) = result.Lines() {
        for i in 0..lines.Size().unwrap_or(0) {
            if let Ok(line) = lines.GetAt(i) {
                if let Ok(text) = line.Text() {
                    let text_str = text.to_string();
                    if !text_str.trim().is_empty() {
                        // Bounding box della riga intera: unione dei riquadri
                        // di tutte le parole (prima copriva solo la prima).
                        let mut bbox: Option<(f32, f32, f32, f32)> = None;
                        if let Ok(words) = line.Words() {
                            for j in 0..words.Size().unwrap_or(0) {
                                if let Ok(rect) = words.GetAt(j).and_then(|w| w.BoundingRect()) {
                                    let (l, t, r, b) = (rect.X, rect.Y, rect.X + rect.Width, rect.Y + rect.Height);
                                    bbox = Some(match bbox {
                                        Some((l0, t0, r0, b0)) => (l0.min(l), t0.min(t), r0.max(r), b0.max(b)),
                                        None => (l, t, r, b),
                                    });
                                }
                            }
                        }
                        let (x, y, w, h) = match bbox {
                            Some((l, t, r, b)) => (l as i32, t as i32, (r - l) as i32, (b - t) as i32),
                            None => (0, 0, 0, 0),
                        };
                        
                        detected.push(DetectedText {
                            text: text_str,
                            translated: None,
                            x,
                            y,
                            width: w,
                            height: h,
                        });
                    }
                }
            }
        }
    }
    
    log::debug!("OCR rilevati {} testi", detected.len());
    Ok(detected)
}

#[cfg(target_os = "windows")]
fn create_software_bitmap(image: &ImageData) -> Result<SoftwareBitmap, String> {
    use windows::Graphics::Imaging::BitmapAlphaMode;
    #[allow(unused_imports)]
    use windows::Graphics::Imaging::BitmapBuffer;
    use windows::Graphics::Imaging::BitmapBufferAccessMode;
    #[allow(unused_imports)]
    use windows::Foundation::MemoryBuffer;
    
    // Crea SoftwareBitmap da dati BGRA
    let bitmap = SoftwareBitmap::CreateWithAlpha(
        BitmapPixelFormat::Bgra8,
        image.width as i32,
        image.height as i32,
        BitmapAlphaMode::Premultiplied,
    ).map_err(|e| format!("Failed to create bitmap: {:?}", e))?;
    
    // Ottieni BitmapBuffer per scrittura diretta
    let buffer = bitmap.LockBuffer(BitmapBufferAccessMode::Write)
        .map_err(|e| format!("Failed to lock buffer: {:?}", e))?;
    
    let reference = buffer.CreateReference()
        .map_err(|e| format!("Failed to create reference: {:?}", e))?;
    
    // Usa IMemoryBufferByteAccess per accesso diretto
    use windows::Win32::System::WinRT::IMemoryBufferByteAccess;
    // `ComInterface` è stato rinominato `Interface` in windows 0.58: è il
    // tratto che porta `cast()`.
    use windows::core::Interface;
    
    let byte_access: IMemoryBufferByteAccess = reference.cast()
        .map_err(|e| format!("Failed to cast: {:?}", e))?;
    
    unsafe {
        let mut ptr: *mut u8 = std::ptr::null_mut();
        let mut capacity: u32 = 0;
        byte_access.GetBuffer(&mut ptr, &mut capacity)
            .map_err(|e| format!("Failed to get buffer: {:?}", e))?;
        
        // Copia i dati dell'immagine
        let copy_len = std::cmp::min(image.data.len(), capacity as usize);
        std::ptr::copy_nonoverlapping(image.data.as_ptr(), ptr, copy_len);
    }
    
    drop(reference);
    drop(buffer);
    
    Ok(bitmap)
}

#[cfg(not(target_os = "windows"))]
pub fn recognize_text(_image: &ImageData, _language: &str) -> Result<Vec<DetectedText>, String> {
    Err("OCR supportato solo su Windows".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn check_language(_language: &str) -> Result<(), String> {
    Err("OCR supportato solo su Windows".to_string())
}

/// Lista delle lingue OCR disponibili sul sistema
#[allow(dead_code)]
pub fn get_available_languages() -> Vec<String> {
    vec![
        "en".to_string(),
        "ja".to_string(),
        "zh-Hans".to_string(),
        "zh-Hant".to_string(),
        "ko".to_string(),
        "de".to_string(),
        "fr".to_string(),
        "es".to_string(),
        "it".to_string(),
        "pt".to_string(),
        "ru".to_string(),
    ]
}
