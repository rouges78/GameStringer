use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// Mouth shape cue from Rhubarb output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MouthCue {
    pub start: f64,
    pub end: f64,
    pub value: String,
}

/// Lip sync result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LipSyncResult {
    pub sound_file: String,
    pub duration: f64,
    pub mouth_cues: Vec<MouthCue>,
}

/// Rhubarb JSON output format
#[derive(Debug, Deserialize)]
struct RhubarbOutput {
    metadata: RhubarbMetadata,
    #[serde(rename = "mouthCues")]
    mouth_cues: Vec<RhubarbCue>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RhubarbMetadata {
    sound_file: String,
    duration: f64,
}

#[derive(Debug, Deserialize)]
struct RhubarbCue {
    start: f64,
    end: f64,
    value: String,
}

/// Check if Rhubarb Lip Sync is available in the system PATH
#[command]
pub async fn check_rhubarb_available() -> Result<bool, String> {
    let output = Command::new("rhubarb").arg("--version").output();

    match output {
        Ok(o) => Ok(o.status.success()),
        Err(_) => Ok(false),
    }
}

/// Generate lip sync data from an audio file using Rhubarb
#[command]
pub async fn generate_lip_sync(
    audio_path: String,
    dialog_text: Option<String>,
    recognizer: Option<String>,
) -> Result<LipSyncResult, String> {
    // Verify audio file exists
    if !std::path::Path::new(&audio_path).exists() {
        return Err(format!("File audio non trovato: {}", audio_path));
    }

    let mut cmd = Command::new("rhubarb");
    cmd.arg(&audio_path);
    cmd.arg("-f").arg("json"); // JSON output

    // Set recognizer
    if let Some(ref rec) = recognizer {
        cmd.arg("-r").arg(rec);
    }

    // Provide dialog text for better accuracy
    if let Some(ref text) = dialog_text {
        // Write dialog text to temp file
        let temp_dir = std::env::temp_dir();
        let dialog_path = temp_dir.join("gs_lipsync_dialog.txt");
        std::fs::write(&dialog_path, text)
            .map_err(|e| format!("Errore scrittura file dialog: {}", e))?;
        cmd.arg("-d").arg(&dialog_path);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Errore esecuzione Rhubarb: {}. Assicurati che Rhubarb sia installato e nel PATH.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Rhubarb errore: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse JSON output
    let rhubarb_out: RhubarbOutput = serde_json::from_str(&stdout)
        .map_err(|e| format!("Errore parsing output Rhubarb: {}", e))?;

    Ok(LipSyncResult {
        sound_file: rhubarb_out.metadata.sound_file,
        duration: rhubarb_out.metadata.duration,
        mouth_cues: rhubarb_out
            .mouth_cues
            .into_iter()
            .map(|c| MouthCue {
                start: c.start,
                end: c.end,
                value: c.value,
            })
            .collect(),
    })
}

/// Export lip sync data to a file (via Rhubarb CLI directly)
#[command]
pub async fn export_lip_sync_file(
    audio_path: String,
    output_path: String,
    format: Option<String>,
    dialog_text: Option<String>,
    recognizer: Option<String>,
) -> Result<String, String> {
    if !std::path::Path::new(&audio_path).exists() {
        return Err(format!("File audio non trovato: {}", audio_path));
    }

    let fmt = format.unwrap_or_else(|| "json".to_string());

    let mut cmd = Command::new("rhubarb");
    cmd.arg(&audio_path);
    cmd.arg("-f").arg(&fmt);
    cmd.arg("-o").arg(&output_path);

    if let Some(ref rec) = recognizer {
        cmd.arg("-r").arg(rec);
    }

    if let Some(ref text) = dialog_text {
        let temp_dir = std::env::temp_dir();
        let dialog_path = temp_dir.join("gs_lipsync_dialog.txt");
        std::fs::write(&dialog_path, text)
            .map_err(|e| format!("Errore scrittura file dialog: {}", e))?;
        cmd.arg("-d").arg(&dialog_path);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Errore esecuzione Rhubarb: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Rhubarb errore: {}", stderr));
    }

    Ok(output_path)
}
