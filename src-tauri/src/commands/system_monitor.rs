use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct SystemStats {
    pub cpu_usage_percent: f64,
    pub ram_total_mb: u64,
    pub ram_used_mb: u64,
    pub ram_usage_percent: f64,
    pub gpu_name: String,
    pub vram_total_mb: u64,
    pub vram_used_mb: u64,
    pub vram_free_mb: u64,
    pub vram_usage_percent: f64,
    pub gpu_temp_celsius: Option<f64>,
    pub gpu_available: bool,
    pub warning: Option<String>,
}

/// Ottieni statistiche GPU via nvidia-smi (NVIDIA) o fallback
fn get_gpu_stats() -> (String, u64, u64, u64, f64, Option<f64>, bool) {
    // Prova nvidia-smi
    if let Ok(output) = Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let line = text.trim();
            let parts: Vec<&str> = line.split(", ").collect();
            if parts.len() >= 6 {
                let name = parts[0].trim().to_string();
                let total = parts[1].trim().parse::<u64>().unwrap_or(0);
                let used = parts[2].trim().parse::<u64>().unwrap_or(0);
                let free = parts[3].trim().parse::<u64>().unwrap_or(0);
                let _gpu_util = parts[4].trim().parse::<f64>().unwrap_or(0.0);
                let temp = parts[5].trim().parse::<f64>().ok();
                let usage = if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 };
                return (name, total, used, free, usage, temp, true);
            }
        }
    }

    // Fallback: nessuna GPU rilevata
    ("No GPU detected".to_string(), 0, 0, 0, 0.0, None, false)
}

/// Ottieni statistiche RAM del sistema
fn get_ram_stats() -> (u64, u64) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("wmic")
            .args(["OS", "get", "TotalVisibleMemorySize,FreePhysicalMemory", "/format:csv"])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines().skip(1) {
                    let parts: Vec<&str> = line.split(',').collect();
                    if parts.len() >= 3 {
                        let free_kb = parts[1].trim().parse::<u64>().unwrap_or(0);
                        let total_kb = parts[2].trim().parse::<u64>().unwrap_or(0);
                        let total_mb = total_kb / 1024;
                        let used_mb = total_mb.saturating_sub(free_kb / 1024);
                        return (total_mb, used_mb);
                    }
                }
            }
        }
        // Fallback PowerShell
        if let Ok(output) = Command::new("powershell")
            .args(["-NoProfile", "-Command", "(Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json)"])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    let total_kb = json["TotalVisibleMemorySize"].as_u64().unwrap_or(0);
                    let free_kb = json["FreePhysicalMemory"].as_u64().unwrap_or(0);
                    let total_mb = total_kb / 1024;
                    let used_mb = total_mb.saturating_sub(free_kb / 1024);
                    return (total_mb, used_mb);
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
            let mut total_kb = 0u64;
            let mut available_kb = 0u64;
            for line in content.lines() {
                if line.starts_with("MemTotal:") {
                    total_kb = line.split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
                } else if line.starts_with("MemAvailable:") {
                    available_kb = line.split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
                }
            }
            let total_mb = total_kb / 1024;
            let used_mb = total_mb.saturating_sub(available_kb / 1024);
            return (total_mb, used_mb);
        }
    }

    (0, 0)
}

// ═══════════════════════════════════════════════════════════════════
// COMANDI TAURI
// ═══════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_system_stats() -> Result<SystemStats, String> {
    let (gpu_name, vram_total, vram_used, vram_free, vram_usage, gpu_temp, gpu_available) = get_gpu_stats();
    let (ram_total, ram_used) = get_ram_stats();
    let ram_usage = if ram_total > 0 { (ram_used as f64 / ram_total as f64) * 100.0 } else { 0.0 };

    // Genera warning se VRAM alta
    let warning = if gpu_available && vram_usage > 90.0 {
        Some("VRAM critica (>90%)! I modelli AI locali potrebbero crashare. Usa provider cloud.".to_string())
    } else if gpu_available && vram_usage > 75.0 {
        Some("VRAM alta (>75%). Considera modelli più leggeri (2B/4B) o provider cloud.".to_string())
    } else if ram_usage > 90.0 {
        Some("RAM quasi piena (>90%). Chiudi applicazioni non necessarie.".to_string())
    } else {
        None
    };

    Ok(SystemStats {
        cpu_usage_percent: 0.0, // CPU usage richiede campionamento multi-punto, non incluso
        ram_total_mb: ram_total,
        ram_used_mb: ram_used,
        ram_usage_percent: ram_usage,
        gpu_name,
        vram_total_mb: vram_total,
        vram_used_mb: vram_used,
        vram_free_mb: vram_free,
        vram_usage_percent: vram_usage,
        gpu_temp_celsius: gpu_temp,
        gpu_available,
        warning,
    })
}
