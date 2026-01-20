// OCR Engine - Windows.Media.Ocr API

use super::{DetectedText, screen_capture::ImageData};

#[cfg(target_os = "windows")]
use windows::{
    Media::Ocr::OcrEngine,
    Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap},
};

/// Riconosce testo da un'immagine usando Windows OCR
#[cfg(target_os = "windows")]
pub fn recognize_text(image: &ImageData, language: &str) -> Result<Vec<DetectedText>, String> {
    log::debug!("OCR su immagine {}x{}, lingua: {}", image.width, image.height, language);
    
    // Crea runtime tokio locale per questo thread
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| format!("Failed to create runtime: {:?}", e))?;
    
    rt.block_on(async {
        recognize_text_async(image, language).await
    })
}

#[cfg(target_os = "windows")]
async fn recognize_text_async(image: &ImageData, _language: &str) -> Result<Vec<DetectedText>, String> {
    // Crea OcrEngine per la lingua
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| format!("Failed to create OCR engine: {:?}", e))?;
    
    // Converti BGRA a SoftwareBitmap
    let bitmap = create_software_bitmap(image)?;
    
    // Esegui OCR
    let result = engine.RecognizeAsync(&bitmap)
        .map_err(|e| format!("OCR failed: {:?}", e))?
        .await
        .map_err(|e| format!("OCR await failed: {:?}", e))?;
    
    // Estrai testi rilevati
    let mut detected = Vec::new();
    
    if let Ok(lines) = result.Lines() {
        for i in 0..lines.Size().unwrap_or(0) {
            if let Ok(line) = lines.GetAt(i) {
                if let Ok(text) = line.Text() {
                    let text_str = text.to_string();
                    if !text_str.trim().is_empty() {
                        // Ottieni bounding box dalla prima parola
                        let (x, y, w, h) = if let Ok(words) = line.Words() {
                            if words.Size().unwrap_or(0) > 0 {
                                if let Ok(word) = words.GetAt(0) {
                                    if let Ok(rect) = word.BoundingRect() {
                                        (rect.X as i32, rect.Y as i32, rect.Width as i32, rect.Height as i32)
                                    } else {
                                        (0, 0, 0, 0)
                                    }
                                } else {
                                    (0, 0, 0, 0)
                                }
                            } else {
                                (0, 0, 0, 0)
                            }
                        } else {
                            (0, 0, 0, 0)
                        };
                        
                        detected.push(DetectedText {
                            text: text_str,
                            translated: None,
                            x,
                            y,
                            width: w,
                            height: h,
                            confidence: 0.9, // Windows OCR non fornisce confidence per linea
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
    use windows::core::ComInterface;
    
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
