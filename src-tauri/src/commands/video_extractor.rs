// ═══════════════════════════════════════════════════════════════════════
// VIDEO EXTRACTOR — Estrazione e conversione video da giochi retro e moderni
// Formati supportati: VMD (Sierra), BIK (Bink), SMK (Smacker), USM (CRI Sofdec),
//                     ROQ (id Software), THP (Nintendo), PSX STR
// ═══════════════════════════════════════════════════════════════════════

use tauri::command;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use walkdir::WalkDir;

// ── Data Models ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VideoFormat {
    VMD,        // Sierra (Gabriel Knight 2, Phantasmagoria, etc.)
    BIK,        // Bink Video (RAD Game Tools)
    SMK,        // Smacker (RAD Game Tools, older)
    USM,        // CRI Sofdec 2 (Persona, Yakuza, Tales of)
    ROQ,        // id Software (Quake III, etc.)
    THP,        // Nintendo GameCube/Wii
    BK2,        // Bink 2 (newer RAD)
    RBT,        // Sierra ROBOT (Phantasmagoria)
    DUK,        // Sierra (Phantasmagoria 2)
    AVI,        // Standard AVI (some older games)
    WMV,        // Windows Media (some PC games)
    Unknown,
}

impl VideoFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            VideoFormat::VMD => "VMD (Sierra)",
            VideoFormat::BIK => "Bink Video",
            VideoFormat::SMK => "Smacker",
            VideoFormat::USM => "CRI Sofdec 2",
            VideoFormat::ROQ => "ROQ (id Software)",
            VideoFormat::THP => "THP (Nintendo)",
            VideoFormat::BK2 => "Bink 2",
            VideoFormat::RBT => "ROBOT (Sierra)",
            VideoFormat::DUK => "DUK (Sierra)",
            VideoFormat::AVI => "AVI",
            VideoFormat::WMV => "WMV",
            VideoFormat::Unknown => "Sconosciuto",
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            VideoFormat::VMD => "vmd",
            VideoFormat::BIK => "bik",
            VideoFormat::SMK => "smk",
            VideoFormat::USM => "usm",
            VideoFormat::ROQ => "roq",
            VideoFormat::THP => "thp",
            VideoFormat::BK2 => "bk2",
            VideoFormat::RBT => "rbt",
            VideoFormat::DUK => "duk",
            VideoFormat::AVI => "avi",
            VideoFormat::WMV => "wmv",
            VideoFormat::Unknown => "",
        }
    }

    /// FFmpeg supporta la decodifica nativa di questo formato?
    pub fn ffmpeg_supported(&self) -> bool {
        match self {
            VideoFormat::VMD => true,
            VideoFormat::BIK => true,
            VideoFormat::SMK => true,
            VideoFormat::USM => false,  // Parziale, serve demuxer custom
            VideoFormat::ROQ => true,
            VideoFormat::THP => true,
            VideoFormat::BK2 => false,  // Bink 2 non ancora supportato da FFmpeg
            VideoFormat::RBT => false,  // Serve ScummVM tools
            VideoFormat::DUK => false,  // Serve tool dedicato
            VideoFormat::AVI => true,
            VideoFormat::WMV => true,
            VideoFormat::Unknown => false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameVideoFile {
    /// Nome del file
    pub name: String,
    /// Percorso completo
    pub path: String,
    /// Percorso relativo alla cartella del gioco
    pub relative_path: String,
    /// Dimensione in bytes
    pub size_bytes: u64,
    /// Formato rilevato (da magic bytes o estensione)
    pub format: VideoFormat,
    /// Formato come stringa leggibile
    pub format_name: String,
    /// Risoluzione (se rilevabile dall'header)
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// Numero di frame (se rilevabile)
    pub frame_count: Option<u32>,
    /// FFmpeg può convertire nativamente questo formato?
    pub ffmpeg_convertible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoScanResult {
    pub game_path: String,
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub files: Vec<GameVideoFile>,
    /// Formati trovati con conteggio
    pub format_summary: Vec<FormatCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatCount {
    pub format: String,
    pub count: usize,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionOptions {
    /// Formato di output: "mp4", "mkv", "webm"
    pub output_format: String,
    /// Codec video: "libx264", "libx265", "libvpx-vp9", "copy"
    pub video_codec: String,
    /// Qualità CRF (0-51, minore = migliore). Default 18
    pub crf: Option<u32>,
    /// Scala risuluzione (es. "1920:-1" per upscale a 1080p mantenendo aspect ratio)
    pub scale: Option<String>,
    /// Filtro di upscaling: "lanczos", "bicubic", "neighbor" (per pixel art)
    pub scale_filter: Option<String>,
    /// FPS di output (None = mantieni originale)
    pub fps: Option<u32>,
    /// Codec audio: "aac", "libopus", "copy", "none"
    pub audio_codec: String,
    /// Directory di output (None = stessa cartella del video)
    pub output_dir: Option<String>,
}

impl Default for ConversionOptions {
    fn default() -> Self {
        Self {
            output_format: "mp4".to_string(),
            video_codec: "libx264".to_string(),
            crf: Some(18),
            scale: None,
            scale_filter: Some("lanczos".to_string()),
            fps: None,
            audio_codec: "aac".to_string(),
            output_dir: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionResult {
    pub success: bool,
    pub input_path: String,
    pub output_path: String,
    pub error: Option<String>,
    /// Dimensione del file di output in bytes
    pub output_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchConversionProgress {
    pub total: usize,
    pub completed: usize,
    pub current_file: String,
    pub results: Vec<ConversionResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoHeaderInfo {
    pub format: VideoFormat,
    pub format_name: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub frame_count: Option<u32>,
    pub audio_sample_rate: Option<u32>,
    pub audio_channels: Option<u32>,
    pub has_audio: bool,
    /// Info extra specifiche del formato
    pub extra_info: Vec<(String, String)>,
}

// ── Binary Read Helpers ────────────────────────────────────────────────

fn read_u16_le(data: &[u8], offset: &mut usize) -> Result<u16, String> {
    if *offset + 2 > data.len() {
        return Err(format!("EOF leggendo u16 a offset {}", offset));
    }
    let val = u16::from_le_bytes([data[*offset], data[*offset + 1]]);
    *offset += 2;
    Ok(val)
}

fn read_u32_le(data: &[u8], offset: &mut usize) -> Result<u32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF leggendo u32 a offset {}", offset));
    }
    let val = u32::from_le_bytes([data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3]]);
    *offset += 4;
    Ok(val)
}

#[allow(dead_code)]
fn read_u32_be(data: &[u8], offset: &mut usize) -> Result<u32, String> {
    if *offset + 4 > data.len() {
        return Err(format!("EOF leggendo u32 BE a offset {}", offset));
    }
    let val = u32::from_be_bytes([data[*offset], data[*offset + 1], data[*offset + 2], data[*offset + 3]]);
    *offset += 4;
    Ok(val)
}

// ── Format Detection (Magic Bytes) ────────────────────────────────────

/// Identifica il formato video dai magic bytes dell'header
fn detect_format_from_magic(data: &[u8]) -> VideoFormat {
    if data.len() < 8 {
        return VideoFormat::Unknown;
    }

    // VMD — Sierra: header inizia con la lunghezza dell'header (0x32E = 814) come u16 LE
    // I primi 2 byte sono tipicamente 0x2E 0x03 (814 in LE)
    if data.len() >= 816 {
        let header_len = u16::from_le_bytes([data[0], data[1]]) as usize;
        if header_len == 0x32E || header_len == 0x330 {
            return VideoFormat::VMD;
        }
    }

    // BIK — "BIK" + revision letter (b/d/f/g/h/i)
    if data[0] == b'B' && data[1] == b'I' && data[2] == b'K' {
        return VideoFormat::BIK;
    }
    // Bink 2 — "KB2" + revision
    if data[0] == b'K' && data[1] == b'B' && data[2] == b'2' {
        return VideoFormat::BK2;
    }

    // SMK — "SMK2" o "SMK4"
    if data.len() >= 4 && &data[0..3] == b"SMK" && (data[3] == b'2' || data[3] == b'4') {
        return VideoFormat::SMK;
    }

    // USM — "CRID" magic
    if data.len() >= 4 && &data[0..4] == b"CRID" {
        return VideoFormat::USM;
    }

    // ROQ — signature chunk ID 0x1084 con length 0xFFFFFFFF
    if data.len() >= 8 {
        let chunk_id = u16::from_le_bytes([data[0], data[1]]);
        let chunk_size = u32::from_le_bytes([data[2], data[3], data[4], data[5]]);
        if chunk_id == 0x1084 && chunk_size == 0xFFFFFFFF {
            return VideoFormat::ROQ;
        }
    }

    // THP — "THP\0" magic
    if data.len() >= 4 && &data[0..4] == b"THP\0" {
        return VideoFormat::THP;
    }

    // AVI — "RIFF" + "AVI "
    if data.len() >= 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"AVI " {
        return VideoFormat::AVI;
    }

    // WMV/ASF — ASF header GUID 30 26 B2 75 8E 66 CF 11
    if data.len() >= 8 && data[0] == 0x30 && data[1] == 0x26 && data[2] == 0xB2 && data[3] == 0x75 {
        return VideoFormat::WMV;
    }

    // RBT — Sierra ROBOT: magic "RBT" o check per pattern
    if data.len() >= 6 && (data[0] == 0x00 && data[1] == 0x00) {
        // RBT non ha un magic standard chiaro, viene rilevato per estensione
    }

    VideoFormat::Unknown
}

/// Rileva formato da estensione (fallback quando i magic bytes non bastano)
fn detect_format_from_extension(path: &Path) -> VideoFormat {
    match path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref() {
        Some("vmd") => VideoFormat::VMD,
        Some("bik") => VideoFormat::BIK,
        Some("bk2") => VideoFormat::BK2,
        Some("smk") => VideoFormat::SMK,
        Some("usm") => VideoFormat::USM,
        Some("roq") => VideoFormat::ROQ,
        Some("thp") => VideoFormat::THP,
        Some("rbt") => VideoFormat::RBT,
        Some("duk") => VideoFormat::DUK,
        Some("avi") => VideoFormat::AVI,
        Some("wmv") => VideoFormat::WMV,
        _ => VideoFormat::Unknown,
    }
}

// ── Header Parsers ─────────────────────────────────────────────────────

/// Parse VMD header (816 bytes) — Sierra Video format
fn parse_vmd_header(data: &[u8]) -> Result<VideoHeaderInfo, String> {
    if data.len() < 816 {
        return Err("File VMD troppo corto per contenere un header valido".to_string());
    }

    let mut offset = 0usize;
    let header_len = read_u16_le(data, &mut offset)?;
    if header_len != 0x32E && header_len != 0x330 {
        return Err(format!("Header VMD non valido: lunghezza {} (atteso 0x32E o 0x330)", header_len));
    }

    // Bytes 2-7: riservati/flags
    offset = 8;
    let width = read_u16_le(data, &mut offset)? as u32;   // bytes 8-9
    let height = read_u16_le(data, &mut offset)? as u32;   // bytes 10-11

    // Bytes 12-15: flags e frame-per-block
    offset = 12;
    let _flags = read_u16_le(data, &mut offset)?;
    let frames_per_block = read_u16_le(data, &mut offset)?;

    // Bytes 16-19: offset assoluto ai dati
    offset = 16;
    let _data_offset = read_u32_le(data, &mut offset)?;

    // Bytes 804-805: audio sample rate
    offset = 804;
    let audio_sample_rate = read_u16_le(data, &mut offset)? as u32;

    // Bytes 810-811: audio flags (bit 0x10 = IMA ADPCM)
    offset = 810;
    let audio_flags = read_u16_le(data, &mut offset)?;

    // Bytes 812-815: TOC offset
    offset = 812;
    let _toc_offset = read_u32_le(data, &mut offset)?;

    let has_audio = audio_sample_rate > 0;
    let audio_bits = if audio_flags & 0x10 != 0 { "IMA ADPCM" } else if audio_flags & 0x04 != 0 { "16-bit DPCM" } else { "8-bit PCM" };

    let mut extra_info = vec![
        ("Frames/Block".to_string(), frames_per_block.to_string()),
    ];
    if has_audio {
        extra_info.push(("Audio".to_string(), format!("{} Hz, {}", audio_sample_rate, audio_bits)));
    }

    // Check per codec video speciale (Indeo 3 — bytes 24-27 = "iv32")
    if data.len() >= 28 && &data[24..28] == b"iv32" {
        extra_info.push(("Video Codec".to_string(), "Indeo 3".to_string()));
    } else {
        extra_info.push(("Video Codec".to_string(), "Sierra LZ77+RLE".to_string()));
    }

    Ok(VideoHeaderInfo {
        format: VideoFormat::VMD,
        format_name: "VMD (Sierra)".to_string(),
        width: Some(width),
        height: Some(height),
        frame_count: None, // Richiede parsing del TOC
        audio_sample_rate: if has_audio { Some(audio_sample_rate) } else { None },
        audio_channels: if has_audio { Some(1) } else { None }, // VMD è tipicamente mono
        has_audio,
        extra_info,
    })
}

/// Parse Bink Video header
fn parse_bik_header(data: &[u8]) -> Result<VideoHeaderInfo, String> {
    if data.len() < 44 {
        return Err("File BIK troppo corto".to_string());
    }

    let revision = data[3] as char;
    let mut offset = 4;
    let file_size = read_u32_le(data, &mut offset)?;
    let frame_count = read_u32_le(data, &mut offset)?;
    offset = 20; // skip to dimensions
    let width = read_u32_le(data, &mut offset)?;
    let height = read_u32_le(data, &mut offset)?;

    // Bytes 28-31: FPS dividend, 32-35: FPS divisor
    offset = 28;
    let fps_num = read_u32_le(data, &mut offset)?;
    let fps_den = read_u32_le(data, &mut offset)?;
    let fps = if fps_den > 0 { fps_num / fps_den } else { 0 };

    Ok(VideoHeaderInfo {
        format: VideoFormat::BIK,
        format_name: format!("Bink Video (rev {})", revision),
        width: Some(width),
        height: Some(height),
        frame_count: Some(frame_count),
        audio_sample_rate: None,
        audio_channels: None,
        has_audio: true, // BIK quasi sempre ha audio
        extra_info: vec![
            ("Revisione".to_string(), revision.to_string()),
            ("FPS".to_string(), fps.to_string()),
            ("Dimensione File".to_string(), format_size(file_size as u64)),
        ],
    })
}

/// Parse Smacker header
fn parse_smk_header(data: &[u8]) -> Result<VideoHeaderInfo, String> {
    if data.len() < 56 {
        return Err("File SMK troppo corto".to_string());
    }

    let version = if &data[0..4] == b"SMK2" { "2" } else { "4" };
    let mut offset = 4;
    let width = read_u32_le(data, &mut offset)?;
    let height = read_u32_le(data, &mut offset)?;
    let frame_count = read_u32_le(data, &mut offset)?;
    let frame_rate = read_u32_le(data, &mut offset)? as i32; // può essere negativo

    let fps = if frame_rate > 0 {
        1000000 / frame_rate as u32
    } else if frame_rate < 0 {
        100000 / (-frame_rate) as u32
    } else {
        10
    };

    Ok(VideoHeaderInfo {
        format: VideoFormat::SMK,
        format_name: format!("Smacker v{}", version),
        width: Some(width),
        height: Some(height),
        frame_count: Some(frame_count),
        audio_sample_rate: None,
        audio_channels: None,
        has_audio: true,
        extra_info: vec![
            ("Versione".to_string(), version.to_string()),
            ("FPS".to_string(), fps.to_string()),
        ],
    })
}

/// Parse ROQ header (minimal — chunk-based)
fn parse_roq_header(data: &[u8]) -> Result<VideoHeaderInfo, String> {
    if data.len() < 8 {
        return Err("File ROQ troppo corto".to_string());
    }

    // ROQ ha FPS fisso a 30, audio a 22050 Hz
    // Dimensioni si leggono dal primo chunk video (0x1011 = info)
    let mut width = None;
    let mut height = None;
    let mut offset = 8usize; // skip signature chunk

    // Cerca il chunk info (0x1001)
    while offset + 8 <= data.len() {
        let chunk_id = u16::from_le_bytes([data[offset], data[offset + 1]]);
        let chunk_size = u32::from_le_bytes([data[offset + 2], data[offset + 3], data[offset + 4], data[offset + 5]]);

        if chunk_id == 0x1001 && offset + 8 + 8 <= data.len() {
            // Info chunk: u16 width, u16 height
            width = Some(u16::from_le_bytes([data[offset + 8], data[offset + 9]]) as u32);
            height = Some(u16::from_le_bytes([data[offset + 10], data[offset + 11]]) as u32);
            break;
        }

        offset += 8 + chunk_size as usize;
    }

    Ok(VideoHeaderInfo {
        format: VideoFormat::ROQ,
        format_name: "ROQ (id Software)".to_string(),
        width,
        height,
        frame_count: None,
        audio_sample_rate: Some(22050),
        audio_channels: Some(1),
        has_audio: true,
        extra_info: vec![
            ("FPS".to_string(), "30".to_string()),
        ],
    })
}

/// Parse generico basato su magic bytes + dimensioni base
fn parse_generic_header(data: &[u8], format: &VideoFormat) -> VideoHeaderInfo {
    VideoHeaderInfo {
        format: format.clone(),
        format_name: format.as_str().to_string(),
        width: None,
        height: None,
        frame_count: None,
        audio_sample_rate: None,
        audio_channels: None,
        has_audio: false,
        extra_info: vec![
            ("Dimensione".to_string(), format_size(data.len() as u64)),
        ],
    }
}

// ── Utility ────────────────────────────────────────────────────────────

fn format_size(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.1} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{} B", bytes)
    }
}

/// Costruisce il comando FFmpeg per la conversione
fn build_ffmpeg_args(input: &str, output: &str, opts: &ConversionOptions) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),           // Sovrascrivi output
        "-i".to_string(),
        input.to_string(),
    ];

    // Scala video
    if let Some(ref scale) = opts.scale {
        let filter = opts.scale_filter.as_deref().unwrap_or("lanczos");
        args.extend_from_slice(&[
            "-vf".to_string(),
            format!("scale={}:flags={}", scale, filter),
        ]);
    }

    // Codec video
    args.extend_from_slice(&["-c:v".to_string(), opts.video_codec.clone()]);

    // CRF (solo per x264/x265)
    if let Some(crf) = opts.crf {
        if opts.video_codec == "libx264" || opts.video_codec == "libx265" {
            args.extend_from_slice(&["-crf".to_string(), crf.to_string()]);
        }
    }

    // FPS
    if let Some(fps) = opts.fps {
        args.extend_from_slice(&["-r".to_string(), fps.to_string()]);
    }

    // Codec audio
    if opts.audio_codec == "none" {
        args.push("-an".to_string());
    } else {
        args.extend_from_slice(&["-c:a".to_string(), opts.audio_codec.clone()]);
    }

    // Pixel format per compatibilità massima con MP4
    if opts.output_format == "mp4" {
        args.extend_from_slice(&["-pix_fmt".to_string(), "yuv420p".to_string()]);
    }

    args.push(output.to_string());
    args
}

// ── Tauri Commands ─────────────────────────────────────────────────────

/// Scansiona una directory di gioco alla ricerca di file video
#[command]
pub async fn scan_game_video_files(game_path: String) -> Result<VideoScanResult, String> {
    log::info!("🎬 Scansione file video in: {}", game_path);

    let path = Path::new(&game_path);
    if !path.exists() {
        return Err("La cartella del gioco non esiste".to_string());
    }

    let video_extensions = [
        "vmd", "bik", "bk2", "smk", "usm", "roq", "thp", "rbt", "duk",
        "avi", "wmv",
    ];

    let mut files = Vec::new();
    let mut format_map: std::collections::HashMap<String, (usize, u64)> = std::collections::HashMap::new();

    for entry in WalkDir::new(path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
    {
        let file_path = entry.path();
        let ext = match file_path.extension().and_then(|e| e.to_str()) {
            Some(e) => e.to_lowercase(),
            None => continue,
        };

        if !video_extensions.contains(&ext.as_str()) {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = metadata.len();

        // Rileva formato: prima dai magic bytes, fallback sull'estensione
        let format = if size >= 16 {
            match fs::read(file_path) {
                Ok(data) => {
                    let magic_format = detect_format_from_magic(&data[..std::cmp::min(data.len(), 1024)]);
                    if magic_format == VideoFormat::Unknown {
                        detect_format_from_extension(file_path)
                    } else {
                        magic_format
                    }
                }
                Err(_) => detect_format_from_extension(file_path),
            }
        } else {
            detect_format_from_extension(file_path)
        };

        // Per file grandi, leggi solo l'header per le info di risoluzione
        let (width, height, frame_count) = if size >= 816 {
            match fs::read(file_path) {
                Ok(data) => {
                    let header_slice = &data[..std::cmp::min(data.len(), 2048)];
                    match &format {
                        VideoFormat::VMD => parse_vmd_header(header_slice)
                            .map(|h| (h.width, h.height, h.frame_count))
                            .unwrap_or((None, None, None)),
                        VideoFormat::BIK | VideoFormat::BK2 => parse_bik_header(header_slice)
                            .map(|h| (h.width, h.height, h.frame_count))
                            .unwrap_or((None, None, None)),
                        VideoFormat::SMK => parse_smk_header(header_slice)
                            .map(|h| (h.width, h.height, h.frame_count))
                            .unwrap_or((None, None, None)),
                        VideoFormat::ROQ => parse_roq_header(header_slice)
                            .map(|h| (h.width, h.height, h.frame_count))
                            .unwrap_or((None, None, None)),
                        _ => (None, None, None),
                    }
                }
                Err(_) => (None, None, None),
            }
        } else {
            (None, None, None)
        };

        let relative_path = file_path.strip_prefix(path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_path.to_string_lossy().to_string());

        let format_name = format.as_str().to_string();
        let ffmpeg_convertible = format.ffmpeg_supported();

        // Aggiorna conteggio formati
        let entry_stat = format_map.entry(format_name.clone()).or_insert((0, 0));
        entry_stat.0 += 1;
        entry_stat.1 += size;

        files.push(GameVideoFile {
            name: entry.file_name().to_string_lossy().to_string(),
            path: file_path.to_string_lossy().to_string(),
            relative_path,
            size_bytes: size,
            format,
            format_name,
            width,
            height,
            frame_count,
            ffmpeg_convertible,
        });
    }

    // Ordina per dimensione decrescente
    files.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

    let total_size: u64 = files.iter().map(|f| f.size_bytes).sum();
    let format_summary: Vec<FormatCount> = format_map.into_iter()
        .map(|(format, (count, total_bytes))| FormatCount { format, count, total_bytes })
        .collect();

    log::info!("✅ Trovati {} file video ({}) in {}", files.len(), format_size(total_size), game_path);

    Ok(VideoScanResult {
        game_path,
        total_files: files.len(),
        total_size_bytes: total_size,
        files,
        format_summary,
    })
}

/// Analizza l'header di un singolo file video e restituisce info dettagliate
#[command]
pub async fn analyze_video_header(file_path: String) -> Result<VideoHeaderInfo, String> {
    log::info!("🔍 Analisi header video: {}", file_path);

    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File video non trovato".to_string());
    }

    let data = fs::read(path).map_err(|e| format!("Errore lettura file: {}", e))?;
    if data.len() < 16 {
        return Err("File troppo piccolo per essere un video valido".to_string());
    }

    let format = {
        let magic = detect_format_from_magic(&data[..std::cmp::min(data.len(), 1024)]);
        if magic == VideoFormat::Unknown {
            detect_format_from_extension(path)
        } else {
            magic
        }
    };

    match format {
        VideoFormat::VMD => parse_vmd_header(&data),
        VideoFormat::BIK | VideoFormat::BK2 => parse_bik_header(&data),
        VideoFormat::SMK => parse_smk_header(&data),
        VideoFormat::ROQ => parse_roq_header(&data),
        VideoFormat::Unknown => Err("Formato video non riconosciuto".to_string()),
        _ => Ok(parse_generic_header(&data, &format)),
    }
}

/// Verifica se FFmpeg è disponibile nel sistema
#[command]
pub async fn check_ffmpeg_available() -> Result<bool, String> {
    let output = std::process::Command::new("ffmpeg")
        .arg("-version")
        .output();

    match output {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Converte un singolo file video usando FFmpeg
#[command]
pub async fn convert_video_file(
    input_path: String,
    options: ConversionOptions,
) -> Result<ConversionResult, String> {
    log::info!("🎬 Conversione video: {} → {}", input_path, options.output_format);

    let input = Path::new(&input_path);
    if !input.exists() {
        return Err("File video di input non trovato".to_string());
    }

    // Determina percorso output
    let output_dir = match &options.output_dir {
        Some(dir) => {
            let p = PathBuf::from(dir);
            if !p.exists() {
                fs::create_dir_all(&p).map_err(|e| format!("Errore creazione directory output: {}", e))?;
            }
            p
        }
        None => input.parent().unwrap_or(Path::new(".")).to_path_buf(),
    };

    let stem = input.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("video");
    let output_path = output_dir.join(format!("{}_converted.{}", stem, options.output_format));
    let output_str = output_path.to_string_lossy().to_string();

    // Costruisci ed esegui comando FFmpeg
    let ffmpeg_args = build_ffmpeg_args(&input_path, &output_str, &options);

    log::info!("FFmpeg args: {:?}", ffmpeg_args);

    let output = std::process::Command::new("ffmpeg")
        .args(&ffmpeg_args)
        .output()
        .map_err(|e| format!("Errore esecuzione FFmpeg: {}. Assicurati che FFmpeg sia installato e nel PATH.", e))?;

    if output.status.success() {
        let output_size = fs::metadata(&output_path)
            .map(|m| m.len())
            .ok();

        log::info!("✅ Video convertito: {} → {}", input_path, output_str);
        Ok(ConversionResult {
            success: true,
            input_path,
            output_path: output_str,
            error: None,
            output_size,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("❌ Errore conversione video: {}", stderr);
        Ok(ConversionResult {
            success: false,
            input_path,
            output_path: output_str,
            error: Some(stderr.to_string()),
            output_size: None,
        })
    }
}

/// Converte più file video in batch
#[command]
pub async fn convert_video_batch(
    input_paths: Vec<String>,
    options: ConversionOptions,
) -> Result<Vec<ConversionResult>, String> {
    log::info!("🎬 Conversione batch: {} file video", input_paths.len());

    let mut results = Vec::new();

    for path in &input_paths {
        let result = convert_video_file(path.clone(), ConversionOptions {
            output_format: options.output_format.clone(),
            video_codec: options.video_codec.clone(),
            crf: options.crf,
            scale: options.scale.clone(),
            scale_filter: options.scale_filter.clone(),
            fps: options.fps,
            audio_codec: options.audio_codec.clone(),
            output_dir: options.output_dir.clone(),
        }).await;

        match result {
            Ok(r) => results.push(r),
            Err(e) => results.push(ConversionResult {
                success: false,
                input_path: path.clone(),
                output_path: String::new(),
                error: Some(e),
                output_size: None,
            }),
        }
    }

    let successes = results.iter().filter(|r| r.success).count();
    log::info!("✅ Batch completato: {}/{} convertiti con successo", successes, results.len());

    Ok(results)
}

/// Estrae un frame thumbnail da un video (primo frame come PNG)
#[command]
pub async fn extract_video_thumbnail(
    file_path: String,
    output_path: Option<String>,
) -> Result<String, String> {
    let input = Path::new(&file_path);
    if !input.exists() {
        return Err("File video non trovato".to_string());
    }

    let out = match output_path {
        Some(p) => PathBuf::from(p),
        None => {
            let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("thumb");
            input.parent().unwrap_or(Path::new(".")).join(format!("{}_thumb.png", stem))
        }
    };
    let out_str = out.to_string_lossy().to_string();

    let output = std::process::Command::new("ffmpeg")
        .args([
            "-y", "-i", &file_path,
            "-vframes", "1",
            "-f", "image2",
            &out_str,
        ])
        .output()
        .map_err(|e| format!("Errore FFmpeg: {}", e))?;

    if output.status.success() {
        Ok(out_str)
    } else {
        Err(format!("FFmpeg errore: {}", String::from_utf8_lossy(&output.stderr)))
    }
}

/// Restituisce i preset di conversione consigliati per diversi scopi
#[command]
pub fn get_conversion_presets() -> Vec<(String, String, ConversionOptions)> {
    vec![
        (
            "standard".to_string(),
            "Standard (MP4 H.264) — Massima compatibilità".to_string(),
            ConversionOptions::default(),
        ),
        (
            "hq".to_string(),
            "Alta Qualità (MP4 H.264 CRF 15)".to_string(),
            ConversionOptions {
                crf: Some(15),
                ..Default::default()
            },
        ),
        (
            "upscale_2x".to_string(),
            "Upscale 2× (Lanczos) — Per video retro 320×200 → 640×400".to_string(),
            ConversionOptions {
                scale: Some("iw*2:ih*2".to_string()),
                scale_filter: Some("lanczos".to_string()),
                crf: Some(15),
                ..Default::default()
            },
        ),
        (
            "upscale_4x".to_string(),
            "Upscale 4× (Lanczos) — Per video retro 320×200 → 1280×800".to_string(),
            ConversionOptions {
                scale: Some("iw*4:ih*4".to_string()),
                scale_filter: Some("lanczos".to_string()),
                crf: Some(15),
                ..Default::default()
            },
        ),
        (
            "upscale_1080p".to_string(),
            "Upscale a 1080p — Scala al 1080p mantenendo aspect ratio".to_string(),
            ConversionOptions {
                scale: Some("-1:1080".to_string()),
                scale_filter: Some("lanczos".to_string()),
                crf: Some(16),
                ..Default::default()
            },
        ),
        (
            "upscale_4k".to_string(),
            "Upscale a 4K — Per video FMV su monitor moderni".to_string(),
            ConversionOptions {
                scale: Some("-1:2160".to_string()),
                scale_filter: Some("lanczos".to_string()),
                video_codec: "libx265".to_string(),
                crf: Some(18),
                ..Default::default()
            },
        ),
        (
            "pixel_art".to_string(),
            "Pixel Art (Nearest Neighbor) — Per sprite e grafica retro".to_string(),
            ConversionOptions {
                scale: Some("iw*4:ih*4".to_string()),
                scale_filter: Some("neighbor".to_string()),
                crf: Some(12),
                ..Default::default()
            },
        ),
        (
            "webm".to_string(),
            "WebM VP9 — Per web/streaming".to_string(),
            ConversionOptions {
                output_format: "webm".to_string(),
                video_codec: "libvpx-vp9".to_string(),
                crf: Some(30),
                audio_codec: "libopus".to_string(),
                ..Default::default()
            },
        ),
        (
            "audio_only".to_string(),
            "Solo Audio — Estrai traccia audio".to_string(),
            ConversionOptions {
                output_format: "mp3".to_string(),
                video_codec: "none".to_string(),
                audio_codec: "libmp3lame".to_string(),
                ..Default::default()
            },
        ),
    ]
}

/// Estrae un frame thumbnail e lo restituisce come base64 PNG (per preview nel frontend)
#[command]
pub async fn extract_video_thumbnail_base64(file_path: String) -> Result<String, String> {
    let input = Path::new(&file_path);
    if !input.exists() {
        return Err("File video non trovato".to_string());
    }

    // Usa una temp dir per il thumbnail
    let temp_dir = std::env::temp_dir().join("gamestringer_thumbs");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Errore temp dir: {}", e))?;

    let hash = format!("{:x}", md5::compute(file_path.as_bytes()));
    let thumb_path = temp_dir.join(format!("{}.png", hash));

    // Se il thumbnail è già in cache, restituiscilo
    if thumb_path.exists() {
        let data = fs::read(&thumb_path).map_err(|e| format!("Errore lettura thumbnail: {}", e))?;
        use base64::{Engine as _, engine::general_purpose};
        return Ok(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(&data)));
    }

    let thumb_str = thumb_path.to_string_lossy().to_string();
    let output = std::process::Command::new("ffmpeg")
        .args(["-y", "-i", &file_path, "-vframes", "1", "-vf", "scale=160:-1", "-f", "image2", &thumb_str])
        .output()
        .map_err(|e| format!("Errore FFmpeg: {}", e))?;

    if !output.status.success() {
        return Err("FFmpeg non è riuscito a estrarre il thumbnail".to_string());
    }

    let data = fs::read(&thumb_path).map_err(|e| format!("Errore lettura thumbnail: {}", e))?;
    use base64::{Engine as _, engine::general_purpose};
    Ok(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(&data)))
}

/// Verifica se Real-ESRGAN è disponibile nel sistema
#[command]
pub async fn check_realesrgan_available() -> Result<bool, String> {
    // Prova diversi nomi dell'eseguibile
    for name in &["realesrgan-ncnn-vulkan", "realesrgan-ncnn-vulkan.exe", "realesrgan"] {
        if std::process::Command::new(name).arg("-h").output().is_ok() {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Upscale un video usando Real-ESRGAN (frame-by-frame) + FFmpeg per riassemblare
#[command]
pub async fn upscale_video_realesrgan(
    input_path: String,
    scale: u32,          // 2 o 4
    model: String,       // "realesrgan-x4plus", "realesrgan-x4plus-anime", "realesr-animevideov3"
    output_dir: Option<String>,
) -> Result<ConversionResult, String> {
    log::info!("🎨 AI Upscale: {} ({}x, modello: {})", input_path, scale, model);

    let input = Path::new(&input_path);
    if !input.exists() {
        return Err("File video non trovato".to_string());
    }

    let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("video");
    let work_dir = std::env::temp_dir().join(format!("gs_upscale_{}", stem));
    let frames_dir = work_dir.join("frames");
    let upscaled_dir = work_dir.join("upscaled");
    fs::create_dir_all(&frames_dir).map_err(|e| format!("Errore creazione dir: {}", e))?;
    fs::create_dir_all(&upscaled_dir).map_err(|e| format!("Errore creazione dir: {}", e))?;

    let out_dir = match &output_dir {
        Some(d) => { let p = PathBuf::from(d); fs::create_dir_all(&p).ok(); p },
        None => input.parent().unwrap_or(Path::new(".")).to_path_buf(),
    };
    let output_path = out_dir.join(format!("{}_upscaled_{}x.mp4", stem, scale));
    let output_str = output_path.to_string_lossy().to_string();

    // Step 1: Estrai frame con FFmpeg
    log::info!("  Step 1/3: Estrazione frame...");
    let extract = std::process::Command::new("ffmpeg")
        .args(["-y", "-i", &input_path, "-qscale:v", "2", &frames_dir.join("frame_%06d.png").to_string_lossy()])
        .output()
        .map_err(|e| format!("FFmpeg errore estrazione frame: {}", e))?;

    if !extract.status.success() {
        let _ = fs::remove_dir_all(&work_dir);
        return Ok(ConversionResult {
            success: false, input_path, output_path: output_str,
            error: Some(format!("Estrazione frame fallita: {}", String::from_utf8_lossy(&extract.stderr))),
            output_size: None,
        });
    }

    // Step 2: Upscale frame con Real-ESRGAN
    log::info!("  Step 2/3: AI Upscaling con Real-ESRGAN...");
    let esrgan_name = if cfg!(windows) { "realesrgan-ncnn-vulkan.exe" } else { "realesrgan-ncnn-vulkan" };
    let upscale = std::process::Command::new(esrgan_name)
        .args([
            "-i", &frames_dir.to_string_lossy(),
            "-o", &upscaled_dir.to_string_lossy(),
            "-n", &model,
            "-s", &scale.to_string(),
            "-f", "png",
        ])
        .output()
        .map_err(|e| format!("Real-ESRGAN errore: {}", e))?;

    if !upscale.status.success() {
        let _ = fs::remove_dir_all(&work_dir);
        return Ok(ConversionResult {
            success: false, input_path, output_path: output_str,
            error: Some(format!("Real-ESRGAN fallito: {}", String::from_utf8_lossy(&upscale.stderr))),
            output_size: None,
        });
    }

    // Step 3: Riassembla in video con FFmpeg (copia audio dall'originale)
    log::info!("  Step 3/3: Riassemblaggio video...");
    let reassemble = std::process::Command::new("ffmpeg")
        .args([
            "-y",
            "-framerate", "15",  // FMV tipicamente 15fps
            "-i", &upscaled_dir.join("frame_%06d.png").to_string_lossy(),
            "-i", &input_path,
            "-map", "0:v", "-map", "1:a?",
            "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-shortest",
            &output_str,
        ])
        .output()
        .map_err(|e| format!("FFmpeg errore riassemblaggio: {}", e))?;

    // Cleanup temp
    let _ = fs::remove_dir_all(&work_dir);

    if reassemble.status.success() {
        let output_size = fs::metadata(&output_path).map(|m| m.len()).ok();
        log::info!("✅ AI Upscale completato: {}", output_str);
        Ok(ConversionResult {
            success: true, input_path, output_path: output_str, error: None, output_size,
        })
    } else {
        Ok(ConversionResult {
            success: false, input_path, output_path: output_str,
            error: Some(format!("Riassemblaggio fallito: {}", String::from_utf8_lossy(&reassemble.stderr))),
            output_size: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_dir_with_files(files: &[(&str, &[u8])]) -> TempDir {
        let dir = TempDir::new().unwrap();
        for (name, content) in files {
            let p = dir.path().join(name);
            if let Some(parent) = p.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&p, content).unwrap();
        }
        dir
    }

    // ── Format Detection ───────────────────────────────────────────────

    #[test]
    fn detect_bik_magic() {
        let data = b"BIKi\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        assert_eq!(detect_format_from_magic(data), VideoFormat::BIK);
    }

    #[test]
    fn detect_smk_magic() {
        let data = b"SMK2\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        assert_eq!(detect_format_from_magic(data), VideoFormat::SMK);
    }

    #[test]
    fn detect_smk4_magic() {
        let data = b"SMK4\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        assert_eq!(detect_format_from_magic(data), VideoFormat::SMK);
    }

    #[test]
    fn detect_usm_magic() {
        let data = b"CRID\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        assert_eq!(detect_format_from_magic(data), VideoFormat::USM);
    }

    #[test]
    fn detect_avi_magic() {
        let data = b"RIFF\x00\x00\x00\x00AVI \x00\x00\x00\x00";
        assert_eq!(detect_format_from_magic(data), VideoFormat::AVI);
    }

    #[test]
    fn detect_bk2_magic() {
        let data = b"KB2g\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        assert_eq!(detect_format_from_magic(data), VideoFormat::BK2);
    }

    #[test]
    fn detect_unknown_magic() {
        let data = b"ZZZZ\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        assert_eq!(detect_format_from_magic(data), VideoFormat::Unknown);
    }

    #[test]
    fn detect_format_by_extension() {
        assert_eq!(detect_format_from_extension(Path::new("video.vmd")), VideoFormat::VMD);
        assert_eq!(detect_format_from_extension(Path::new("intro.bik")), VideoFormat::BIK);
        assert_eq!(detect_format_from_extension(Path::new("cutscene.smk")), VideoFormat::SMK);
        assert_eq!(detect_format_from_extension(Path::new("movie.usm")), VideoFormat::USM);
        assert_eq!(detect_format_from_extension(Path::new("test.roq")), VideoFormat::ROQ);
        assert_eq!(detect_format_from_extension(Path::new("game.thp")), VideoFormat::THP);
        assert_eq!(detect_format_from_extension(Path::new("scene.rbt")), VideoFormat::RBT);
        assert_eq!(detect_format_from_extension(Path::new("scene.duk")), VideoFormat::DUK);
        assert_eq!(detect_format_from_extension(Path::new("readme.txt")), VideoFormat::Unknown);
    }

    // ── BIK Header Parsing ─────────────────────────────────────────────

    #[test]
    fn parse_bik_header_valid() {
        let mut data = vec![0u8; 44];
        data[0..4].copy_from_slice(b"BIKi");
        // file size
        data[4..8].copy_from_slice(&100000u32.to_le_bytes());
        // frame count
        data[8..12].copy_from_slice(&120u32.to_le_bytes());
        // width at offset 20
        data[20..24].copy_from_slice(&640u32.to_le_bytes());
        // height at offset 24
        data[24..28].copy_from_slice(&480u32.to_le_bytes());
        // fps num
        data[28..32].copy_from_slice(&30u32.to_le_bytes());
        // fps den
        data[32..36].copy_from_slice(&1u32.to_le_bytes());

        let info = parse_bik_header(&data).unwrap();
        assert_eq!(info.width, Some(640));
        assert_eq!(info.height, Some(480));
        assert_eq!(info.frame_count, Some(120));
    }

    // ── SMK Header Parsing ─────────────────────────────────────────────

    #[test]
    fn parse_smk_header_valid() {
        let mut data = vec![0u8; 56];
        data[0..4].copy_from_slice(b"SMK2");
        data[4..8].copy_from_slice(&320u32.to_le_bytes());
        data[8..12].copy_from_slice(&200u32.to_le_bytes());
        data[12..16].copy_from_slice(&100u32.to_le_bytes());
        data[16..20].copy_from_slice(&33333u32.to_le_bytes()); // ~30fps

        let info = parse_smk_header(&data).unwrap();
        assert_eq!(info.width, Some(320));
        assert_eq!(info.height, Some(200));
        assert_eq!(info.frame_count, Some(100));
    }

    // ── Scan ───────────────────────────────────────────────────────────

    #[tokio::test]
    async fn scan_finds_video_files() {
        let dir = setup_dir_with_files(&[
            ("intro.bik", b"BIKi0000000000000000000000000000000000000000"),
            ("cutscene.smk", b"SMK200000000000000000000000000000000000000000000000000000000"),
            ("readme.txt", b"hello"),
        ]);
        let result = scan_game_video_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.total_files, 2);
    }

    #[tokio::test]
    async fn scan_empty_dir() {
        let dir = TempDir::new().unwrap();
        let result = scan_game_video_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert!(result.files.is_empty());
    }

    #[tokio::test]
    async fn scan_nonexistent_returns_error() {
        let result = scan_game_video_files("/nonexistent/xyz".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn scan_recurses_subdirs() {
        let dir = setup_dir_with_files(&[
            ("root.bik", b"BIKi0000000000000000000000000000000000000000"),
            ("movies/intro.smk", b"SMK200000000000000000000000000000000000000000000000000000000"),
            ("movies/sub/ending.bik", b"BIKi0000000000000000000000000000000000000000"),
        ]);
        let result = scan_game_video_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.total_files, 3);
    }

    // ── Presets ────────────────────────────────────────────────────────

    #[test]
    fn get_presets_returns_non_empty() {
        let presets = get_conversion_presets();
        assert!(!presets.is_empty());
        assert!(presets.iter().any(|(id, _, _)| id == "standard"));
        assert!(presets.iter().any(|(id, _, _)| id == "upscale_2x"));
        assert!(presets.iter().any(|(id, _, _)| id == "upscale_1080p"));
    }

    // ── FFmpeg Args ───────────────────────────────────────────────────

    #[test]
    fn ffmpeg_args_basic() {
        let opts = ConversionOptions::default();
        let args = build_ffmpeg_args("input.vmd", "output.mp4", &opts);
        assert!(args.contains(&"-y".to_string()));
        assert!(args.contains(&"input.vmd".to_string()));
        assert!(args.contains(&"output.mp4".to_string()));
        assert!(args.contains(&"libx264".to_string()));
        assert!(args.contains(&"yuv420p".to_string()));
    }

    #[test]
    fn ffmpeg_args_with_scale() {
        let opts = ConversionOptions {
            scale: Some("iw*2:ih*2".to_string()),
            scale_filter: Some("lanczos".to_string()),
            ..Default::default()
        };
        let args = build_ffmpeg_args("input.vmd", "output.mp4", &opts);
        assert!(args.iter().any(|a| a.contains("scale=iw*2:ih*2")));
    }

    #[test]
    fn ffmpeg_args_no_audio() {
        let opts = ConversionOptions {
            audio_codec: "none".to_string(),
            ..Default::default()
        };
        let args = build_ffmpeg_args("input.vmd", "output.mp4", &opts);
        assert!(args.contains(&"-an".to_string()));
    }
}
