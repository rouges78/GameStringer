#![allow(dead_code)]
// Retro Game OCR Preprocessor
// Pre-processing ottimizzato per font pixelati di giochi retro (DOS, SNES, PC-98, etc.)

use super::screen_capture::ImageData;

/// Tipo di gioco retro per ottimizzazione specifica
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RetroGameType {
    /// 8-bit (NES, Master System, Game Boy)
    Bit8,
    /// 16-bit (SNES, Genesis, PC Engine)
    Bit16,
    /// DOS/PC (CGA, EGA, VGA)
    DosPC,
    /// PC-98 (Giapponese)
    PC98,
    /// Early Windows (Win3.1, Win95)
    EarlyWindows,
    /// Amiga/Atari ST
    AmigaST,
    /// Arcade
    Arcade,
    /// Auto-detect
    Auto,
}

/// Configurazione pre-processing
#[derive(Debug, Clone)]
pub struct RetroPreprocessConfig {
    pub game_type: RetroGameType,
    pub upscale_factor: u32,      // 2-8x
    pub contrast_boost: f32,       // 1.0-3.0
    pub threshold: Option<u8>,     // 0-255, None = no threshold
    pub remove_dithering: bool,
    pub sharpen: bool,
    pub invert_colors: bool,
    pub denoise_level: u8,         // 0-3
}

impl Default for RetroPreprocessConfig {
    fn default() -> Self {
        Self {
            game_type: RetroGameType::Auto,
            upscale_factor: 3,
            contrast_boost: 1.5,
            threshold: None,
            remove_dithering: false,
            sharpen: true,
            invert_colors: false,
            denoise_level: 1,
        }
    }
}

impl RetroPreprocessConfig {
    /// Preset per giochi 8-bit
    pub fn preset_8bit() -> Self {
        Self {
            game_type: RetroGameType::Bit8,
            upscale_factor: 4,
            contrast_boost: 2.0,
            threshold: Some(128),
            remove_dithering: false,
            sharpen: true,
            invert_colors: false,
            denoise_level: 0,
        }
    }

    /// Preset per giochi 16-bit
    pub fn preset_16bit() -> Self {
        Self {
            game_type: RetroGameType::Bit16,
            upscale_factor: 3,
            contrast_boost: 1.5,
            threshold: None,
            remove_dithering: false,
            sharpen: true,
            invert_colors: false,
            denoise_level: 1,
        }
    }

    /// Preset per DOS/PC
    pub fn preset_dos() -> Self {
        Self {
            game_type: RetroGameType::DosPC,
            upscale_factor: 3,
            contrast_boost: 1.8,
            threshold: Some(140),
            remove_dithering: true,
            sharpen: true,
            invert_colors: false,
            denoise_level: 2,
        }
    }

    /// Preset per PC-98
    pub fn preset_pc98() -> Self {
        Self {
            game_type: RetroGameType::PC98,
            upscale_factor: 4,
            contrast_boost: 2.0,
            threshold: Some(120),
            remove_dithering: true,
            sharpen: true,
            invert_colors: false,
            denoise_level: 1,
        }
    }

    /// Preset per Early Windows
    pub fn preset_early_windows() -> Self {
        Self {
            game_type: RetroGameType::EarlyWindows,
            upscale_factor: 2,
            contrast_boost: 1.3,
            threshold: None,
            remove_dithering: false,
            sharpen: false,
            invert_colors: false,
            denoise_level: 0,
        }
    }
}

/// Pre-processa un'immagine per OCR retro
pub fn preprocess_retro_image(image: &ImageData, config: &RetroPreprocessConfig) -> Result<ImageData, String> {
    log::info!("Retro preprocessing: {:?}, upscale {}x, contrast {}", 
        config.game_type, config.upscale_factor, config.contrast_boost);

    let mut result = image.clone();

    // 1. Upscale (nearest neighbor per preservare pixel)
    if config.upscale_factor > 1 {
        result = upscale_nearest_neighbor(result, config.upscale_factor)?;
    }

    // 2. Boost contrasto
    if config.contrast_boost > 1.0 {
        result = boost_contrast(result, config.contrast_boost)?;
    }

    // 3. Rimuovi dithering (opzionale)
    if config.remove_dithering {
        result = remove_dithering_patterns(result)?;
    }

    // 4. Denoise (opzionale)
    if config.denoise_level > 0 {
        result = denoise(result, config.denoise_level)?;
    }

    // 5. Sharpen (opzionale)
    if config.sharpen {
        result = sharpen_image(result)?;
    }

    // 6. Threshold binario (opzionale)
    if let Some(thresh) = config.threshold {
        result = apply_threshold(result, thresh)?;
    }

    // 7. Inverti colori (opzionale)
    if config.invert_colors {
        result = invert_colors(result)?;
    }

    log::info!("Retro preprocessing completato: {}x{} -> {}x{}", 
        image.width, image.height, result.width, result.height);

    Ok(result)
}

/// Upscale con nearest neighbor (preserva pixel art)
fn upscale_nearest_neighbor(image: ImageData, factor: u32) -> Result<ImageData, String> {
    let new_width = image.width * factor;
    let new_height = image.height * factor;
    let mut new_data = vec![0u8; (new_width * new_height * 4) as usize];

    for y in 0..new_height {
        for x in 0..new_width {
            let src_x = x / factor;
            let src_y = y / factor;
            let src_idx = ((src_y * image.width + src_x) * 4) as usize;
            let dst_idx = ((y * new_width + x) * 4) as usize;

            if src_idx + 3 < image.data.len() && dst_idx + 3 < new_data.len() {
                new_data[dst_idx] = image.data[src_idx];         // B
                new_data[dst_idx + 1] = image.data[src_idx + 1]; // G
                new_data[dst_idx + 2] = image.data[src_idx + 2]; // R
                new_data[dst_idx + 3] = image.data[src_idx + 3]; // A
            }
        }
    }

    Ok(ImageData {
        data: new_data,
        width: new_width,
        height: new_height,
    })
}

/// Aumenta il contrasto dell'immagine
fn boost_contrast(image: ImageData, factor: f32) -> Result<ImageData, String> {
    let mut new_data = image.data.clone();
    
    for i in (0..new_data.len()).step_by(4) {
        for c in 0..3 {
            let val = new_data[i + c] as f32;
            let adjusted = ((val - 128.0) * factor + 128.0).clamp(0.0, 255.0);
            new_data[i + c] = adjusted as u8;
        }
    }

    Ok(ImageData {
        data: new_data,
        width: image.width,
        height: image.height,
    })
}

/// Rimuove pattern di dithering comuni nei giochi retro
fn remove_dithering_patterns(image: ImageData) -> Result<ImageData, String> {
    let mut new_data = image.data.clone();
    let w = image.width as usize;
    let h = image.height as usize;

    // Semplice median filter 3x3 per rimuovere dithering
    for y in 1..h-1 {
        for x in 1..w-1 {
            for c in 0..3 {
                let mut neighbors: Vec<u8> = Vec::with_capacity(9);
                
                for dy in -1i32..=1 {
                    for dx in -1i32..=1 {
                        let nx = (x as i32 + dx) as usize;
                        let ny = (y as i32 + dy) as usize;
                        let idx = (ny * w + nx) * 4 + c;
                        neighbors.push(image.data[idx]);
                    }
                }
                
                neighbors.sort();
                let idx = (y * w + x) * 4 + c;
                new_data[idx] = neighbors[4]; // Median
            }
        }
    }

    Ok(ImageData {
        data: new_data,
        width: image.width,
        height: image.height,
    })
}

/// Denoise con box blur leggero
fn denoise(image: ImageData, level: u8) -> Result<ImageData, String> {
    let mut result = image.clone();
    
    for _ in 0..level {
        result = box_blur(result, 1)?;
    }
    
    Ok(result)
}

/// Box blur
fn box_blur(image: ImageData, radius: usize) -> Result<ImageData, String> {
    let mut new_data = image.data.clone();
    let w = image.width as usize;
    let h = image.height as usize;
    let kernel_size = (2 * radius + 1) * (2 * radius + 1);

    for y in radius..h-radius {
        for x in radius..w-radius {
            for c in 0..3 {
                let mut sum: u32 = 0;
                
                for dy in 0..2*radius+1 {
                    for dx in 0..2*radius+1 {
                        let nx = x - radius + dx;
                        let ny = y - radius + dy;
                        let idx = (ny * w + nx) * 4 + c;
                        sum += image.data[idx] as u32;
                    }
                }
                
                let idx = (y * w + x) * 4 + c;
                new_data[idx] = (sum / kernel_size as u32) as u8;
            }
        }
    }

    Ok(ImageData {
        data: new_data,
        width: image.width,
        height: image.height,
    })
}

/// Sharpen con kernel 3x3
fn sharpen_image(image: ImageData) -> Result<ImageData, String> {
    let mut new_data = image.data.clone();
    let w = image.width as usize;
    let h = image.height as usize;

    // Sharpen kernel: [0, -1, 0], [-1, 5, -1], [0, -1, 0]
    let kernel: [i32; 9] = [0, -1, 0, -1, 5, -1, 0, -1, 0];

    for y in 1..h-1 {
        for x in 1..w-1 {
            for c in 0..3 {
                let mut sum: i32 = 0;
                let mut k = 0;
                
                for dy in -1i32..=1 {
                    for dx in -1i32..=1 {
                        let nx = (x as i32 + dx) as usize;
                        let ny = (y as i32 + dy) as usize;
                        let idx = (ny * w + nx) * 4 + c;
                        sum += image.data[idx] as i32 * kernel[k];
                        k += 1;
                    }
                }
                
                let idx = (y * w + x) * 4 + c;
                new_data[idx] = sum.clamp(0, 255) as u8;
            }
        }
    }

    Ok(ImageData {
        data: new_data,
        width: image.width,
        height: image.height,
    })
}

/// Applica threshold binario
fn apply_threshold(image: ImageData, threshold: u8) -> Result<ImageData, String> {
    let mut new_data = image.data.clone();

    for i in (0..new_data.len()).step_by(4) {
        // Converti a grayscale
        let gray = (
            image.data[i] as u32 * 114 +     // B
            image.data[i + 1] as u32 * 587 + // G
            image.data[i + 2] as u32 * 299   // R
        ) / 1000;
        
        let val = if gray > threshold as u32 { 255u8 } else { 0u8 };
        new_data[i] = val;
        new_data[i + 1] = val;
        new_data[i + 2] = val;
    }

    Ok(ImageData {
        data: new_data,
        width: image.width,
        height: image.height,
    })
}

/// Inverti colori
fn invert_colors(image: ImageData) -> Result<ImageData, String> {
    let mut new_data = image.data.clone();

    for i in (0..new_data.len()).step_by(4) {
        new_data[i] = 255 - new_data[i];         // B
        new_data[i + 1] = 255 - new_data[i + 1]; // G
        new_data[i + 2] = 255 - new_data[i + 2]; // R
        // Alpha rimane invariato
    }

    Ok(ImageData {
        data: new_data,
        width: image.width,
        height: image.height,
    })
}

/// Auto-detect tipo di gioco basato su analisi immagine
pub fn detect_retro_game_type(image: &ImageData) -> RetroGameType {
    // Analisi basica della palette colori
    let mut unique_colors = std::collections::HashSet::new();
    
    for i in (0..image.data.len().min(10000)).step_by(4) {
        let color = (
            image.data[i] / 16,
            image.data[i + 1] / 16,
            image.data[i + 2] / 16
        );
        unique_colors.insert(color);
    }
    
    let color_count = unique_colors.len();
    
    // Euristica basata su numero colori
    if color_count <= 4 {
        RetroGameType::Bit8 // Probabilmente Game Boy o simile
    } else if color_count <= 16 {
        RetroGameType::Bit8 // NES, Master System
    } else if color_count <= 64 {
        RetroGameType::Bit16 // SNES, Genesis
    } else if color_count <= 256 {
        RetroGameType::DosPC // VGA
    } else {
        RetroGameType::EarlyWindows // High color
    }
}

/// Ottiene configurazione consigliata per un tipo di gioco
pub fn get_recommended_config(game_type: RetroGameType) -> RetroPreprocessConfig {
    match game_type {
        RetroGameType::Bit8 => RetroPreprocessConfig::preset_8bit(),
        RetroGameType::Bit16 => RetroPreprocessConfig::preset_16bit(),
        RetroGameType::DosPC => RetroPreprocessConfig::preset_dos(),
        RetroGameType::PC98 => RetroPreprocessConfig::preset_pc98(),
        RetroGameType::EarlyWindows => RetroPreprocessConfig::preset_early_windows(),
        RetroGameType::AmigaST => RetroPreprocessConfig::preset_16bit(),
        RetroGameType::Arcade => RetroPreprocessConfig::preset_16bit(),
        RetroGameType::Auto => RetroPreprocessConfig::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_upscale() {
        let image = ImageData {
            data: vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255],
            width: 2,
            height: 2,
        };
        
        let result = upscale_nearest_neighbor(image.clone(), 2).unwrap();
        assert_eq!(result.width, 4);
        assert_eq!(result.height, 4);
    }

    #[test]
    fn test_threshold() {
        let image = ImageData {
            data: vec![100, 100, 100, 255, 200, 200, 200, 255],
            width: 2,
            height: 1,
        };
        
        let result = apply_threshold(image.clone(), 128).unwrap();
        assert_eq!(result.data[0], 0); // Sotto threshold
        assert_eq!(result.data[4], 255); // Sopra threshold
    }
}
