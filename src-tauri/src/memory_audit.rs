use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};
use log::{debug, info, warn};
use chrono::{DateTime, Utc};

/// Informazioni su allocazione di memoria
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryAllocation {
    pub id: String,
    pub size_bytes: usize,
    pub allocated_at: DateTime<Utc>,
    pub location: String,
    pub allocation_type: AllocationType,
    pub is_active: bool,
}

/// Tipi di allocazioni da monitorare
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AllocationType {
    Cache,
    HttpClient,
    JsonParsing,
    FileBuffer,
    StringBuffer,
    VectorBuffer,
    HashMapBuffer,
    ApiResponse,
    GameData,
    ImageData,
    ConfigData,
    TempBuffer,
    Unknown,
}

impl std::fmt::Display for AllocationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AllocationType::Cache => write!(f, "Cache"),
            AllocationType::HttpClient => write!(f, "HttpClient"),
            AllocationType::JsonParsing => write!(f, "JsonParsing"),
            AllocationType::FileBuffer => write!(f, "FileBuffer"),
            AllocationType::StringBuffer => write!(f, "StringBuffer"),
            AllocationType::VectorBuffer => write!(f, "VectorBuffer"),
            AllocationType::HashMapBuffer => write!(f, "HashMapBuffer"),
            AllocationType::ApiResponse => write!(f, "ApiResponse"),
            AllocationType::GameData => write!(f, "GameData"),
            AllocationType::ImageData => write!(f, "ImageData"),
            AllocationType::ConfigData => write!(f, "ConfigData"),
            AllocationType::TempBuffer => write!(f, "TempBuffer"),
            AllocationType::Unknown => write!(f, "Unknown"),
        }
    }
}

/// Statistiche di memoria
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct MemoryStats {
    pub total_allocated: usize,
    pub total_deallocated: usize,
    pub current_usage: usize,
    pub peak_usage: usize,
    pub active_allocations: usize,
    pub allocations_by_type: HashMap<AllocationType, usize>,
    pub potential_leaks: Vec<MemoryAllocation>,
    pub memory_pressure: MemoryPressure,
}

/// Livello di pressione della memoria
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum MemoryPressure {
    Low,      // < 100MB
    Medium,   // 100MB - 500MB
    High,     // 500MB - 1GB
    Critical, // > 1GB
}

impl Default for MemoryPressure {
    fn default() -> Self {
        MemoryPressure::Low
    }
}

/// Configurazione per audit memoria
#[derive(Clone, Debug)]
pub struct MemoryAuditConfig {
    pub leak_detection_threshold_seconds: u64,
    pub max_tracked_allocations: usize,
    pub memory_pressure_check_interval: Duration,
    pub auto_cleanup_enabled: bool,
    pub detailed_tracking: bool,
}

impl Default for MemoryAuditConfig {
    fn default() -> Self {
        Self {
            leak_detection_threshold_seconds: 300, // 5 minuti
            max_tracked_allocations: 10000,
            memory_pressure_check_interval: Duration::from_secs(30),
            auto_cleanup_enabled: true,
            detailed_tracking: true,
        }
    }
}

/// Manager per audit della memoria
pub struct MemoryAuditManager {
    config: MemoryAuditConfig,
    stats: Arc<RwLock<MemoryStats>>,
    allocations: Arc<RwLock<HashMap<String, MemoryAllocation>>>,
    last_cleanup: Arc<RwLock<DateTime<Utc>>>,
}

impl MemoryAuditManager {
    /// Crea un nuovo manager per audit memoria
    pub fn new() -> Self {
        Self {
            config: MemoryAuditConfig::default(),
            stats: Arc::new(RwLock::new(MemoryStats::default())),
            allocations: Arc::new(RwLock::new(HashMap::new())),
            last_cleanup: Arc::new(RwLock::new(Utc::now())),
        }
    }

    /// Registra una nuova allocazione di memoria
    pub async fn track_allocation(
        &self,
        id: String,
        size_bytes: usize,
        location: String,
        allocation_type: AllocationType,
    ) {
        if !self.config.detailed_tracking {
            return;
        }

        let allocation = MemoryAllocation {
            id: id.clone(),
            size_bytes,
            allocated_at: Utc::now(),
            location,
            allocation_type: allocation_type.clone(),
            is_active: true,
        };

        // Aggiorna allocazioni
        {
            let mut allocations = self.allocations.write().await;
            allocations.insert(id, allocation);

            // Limita il numero di allocazioni tracciate
            if allocations.len() > self.config.max_tracked_allocations {
                let oldest_key = allocations
                    .iter()
                    .min_by_key(|(_, alloc)| alloc.allocated_at)
                    .map(|(k, _)| k.clone());

                if let Some(key) = oldest_key {
                    allocations.remove(&key);
                }
            }
        }

        // Aggiorna statistiche
        {
            let mut stats = self.stats.write().await;
            stats.total_allocated += size_bytes;
            stats.current_usage += size_bytes;
            stats.active_allocations += 1;

            if stats.current_usage > stats.peak_usage {
                stats.peak_usage = stats.current_usage;
            }

            *stats.allocations_by_type.entry(allocation_type.clone()).or_insert(0) += size_bytes;
            stats.memory_pressure = self.calculate_memory_pressure(stats.current_usage);
        }

        debug!("[Memory] Tracked allocation: {} bytes ({})", size_bytes, allocation_type);
    }

    /// Registra la deallocazione di memoria
    pub async fn track_deallocation(&self, id: &str) {
        if !self.config.detailed_tracking {
            return;
        }

        let size_bytes = {
            let mut allocations = self.allocations.write().await;
            if let Some(mut allocation) = allocations.remove(id) {
                allocation.is_active = false;
                allocation.size_bytes
            } else {
                warn!("[Memory] Tentativo di deallocare ID sconosciuto: {}", id);
                return;
            }
        };

        // Aggiorna statistiche
        {
            let mut stats = self.stats.write().await;
            stats.total_deallocated += size_bytes;
            stats.current_usage = stats.current_usage.saturating_sub(size_bytes);
            stats.active_allocations = stats.active_allocations.saturating_sub(1);
            stats.memory_pressure = self.calculate_memory_pressure(stats.current_usage);
        }

        debug!("[Memory] Tracked deallocation: {} bytes", size_bytes);
    }

    /// Calcola il livello di pressione della memoria
    fn calculate_memory_pressure(&self, current_usage: usize) -> MemoryPressure {
        const MB: usize = 1024 * 1024;
        const GB: usize = 1024 * MB;

        match current_usage {
            0..=100_000_000 => MemoryPressure::Low,      // < 100MB
            100_000_001..=500_000_000 => MemoryPressure::Medium,  // 100MB - 500MB
            500_000_001..=1_000_000_000 => MemoryPressure::High,   // 500MB - 1GB
            _ => MemoryPressure::Critical,                // > 1GB
        }
    }

    /// Rileva potenziali memory leak
    pub async fn detect_memory_leaks(&self) -> Vec<MemoryAllocation> {
        let allocations = self.allocations.read().await;
        let threshold = chrono::Duration::seconds(self.config.leak_detection_threshold_seconds as i64);
        let now = Utc::now();

        let potential_leaks: Vec<MemoryAllocation> = allocations
            .values()
            .filter(|alloc| {
                alloc.is_active && (now - alloc.allocated_at) > threshold
            })
            .cloned()
            .collect();

        if !potential_leaks.is_empty() {
            warn!("[Memory] Rilevati {} potenziali memory leak", potential_leaks.len());
            for leak in &potential_leaks {
                warn!("[Memory] Leak potenziale: {} bytes da {} ({})", 
                      leak.size_bytes, leak.location, leak.allocation_type);
            }
        }

        // Aggiorna statistiche
        {
            let mut stats = self.stats.write().await;
            stats.potential_leaks = potential_leaks.clone();
        }

        potential_leaks
    }

    /// Esegue pulizia automatica della memoria
    pub async fn auto_cleanup(&self) -> Result<usize, String> {
        if !self.config.auto_cleanup_enabled {
            return Ok(0);
        }

        let mut last_cleanup = self.last_cleanup.write().await;
        let elapsed_duration = Utc::now() - *last_cleanup;
        let check_interval = chrono::Duration::from_std(self.config.memory_pressure_check_interval).unwrap_or(chrono::Duration::seconds(60));
        if elapsed_duration < check_interval {
            return Ok(0);
        }

        *last_cleanup = Utc::now();
        drop(last_cleanup);

        let stats = self.stats.read().await;
        let cleanup_needed = matches!(stats.memory_pressure, MemoryPressure::High | MemoryPressure::Critical);
        drop(stats);

        if !cleanup_needed {
            return Ok(0);
        }

        info!("[Memory] Avvio pulizia automatica memoria...");

        let mut cleaned_count = 0;

        // Pulisci allocazioni vecchie
        {
            let mut allocations = self.allocations.write().await;
            let threshold = chrono::Duration::seconds(self.config.leak_detection_threshold_seconds as i64);
            let now = Utc::now();

            let keys_to_remove: Vec<String> = allocations
                .iter()
                .filter(|(_, alloc)| {
                    !alloc.is_active || (now - alloc.allocated_at) > threshold
                })
                .map(|(k, _)| k.clone())
                .collect();

            for key in keys_to_remove {
                if let Some(allocation) = allocations.remove(&key) {
                    cleaned_count += 1;
                    
                    // Aggiorna statistiche
                    let mut stats = self.stats.write().await;
                    stats.current_usage = stats.current_usage.saturating_sub(allocation.size_bytes);
                    stats.active_allocations = stats.active_allocations.saturating_sub(1);
                }
            }
        }

        // Forza garbage collection se disponibile
        #[cfg(feature = "gc")]
        {
            std::gc::collect();
        }

        // Aggiorna pressione memoria
        {
            let mut stats = self.stats.write().await;
            stats.memory_pressure = self.calculate_memory_pressure(stats.current_usage);
        }

        info!("[Memory] Pulizia completata: {} allocazioni rimosse", cleaned_count);
        Ok(cleaned_count)
    }

    /// Ottiene statistiche complete della memoria
    pub async fn get_memory_stats(&self) -> MemoryStats {
        let mut stats = self.stats.read().await.clone();
        
        // Aggiorna informazioni sui leak
        stats.potential_leaks = self.detect_memory_leaks().await;
        
        stats
    }

    /// Ottiene informazioni dettagliate su allocazioni attive
    pub async fn get_active_allocations(&self) -> Vec<MemoryAllocation> {
        let allocations = self.allocations.read().await;
        allocations
            .values()
            .filter(|alloc| alloc.is_active)
            .cloned()
            .collect()
    }

    /// Ottiene allocazioni per tipo
    pub async fn get_allocations_by_type(&self, allocation_type: AllocationType) -> Vec<MemoryAllocation> {
        let allocations = self.allocations.read().await;
        allocations
            .values()
            .filter(|alloc| alloc.is_active && alloc.allocation_type == allocation_type)
            .cloned()
            .collect()
    }

    /// Reset delle statistiche
    pub async fn reset_stats(&self) {
        let mut stats = self.stats.write().await;
        *stats = MemoryStats::default();
        
        let mut allocations = self.allocations.write().await;
        allocations.clear();
        
        info!("[Memory] Statistiche memoria resettate");
    }

    /// Genera report dettagliato della memoria
    pub async fn generate_memory_report(&self) -> String {
        let stats = self.get_memory_stats().await;
        let active_allocations = self.get_active_allocations().await;
        
        let mut report = Vec::new();
        
        report.push("=== REPORT AUDIT MEMORIA GAMESTRINGER ===".to_string());
        report.push(format!("Timestamp: {}", Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));
        report.push("".to_string());
        
        report.push("📊 STATISTICHE GENERALI:".to_string());
        report.push(format!("  Memoria totale allocata: {:.2} MB", stats.total_allocated as f64 / 1024.0 / 1024.0));
        report.push(format!("  Memoria totale deallocata: {:.2} MB", stats.total_deallocated as f64 / 1024.0 / 1024.0));
        report.push(format!("  Uso corrente: {:.2} MB", stats.current_usage as f64 / 1024.0 / 1024.0));
        report.push(format!("  Picco di utilizzo: {:.2} MB", stats.peak_usage as f64 / 1024.0 / 1024.0));
        report.push(format!("  Allocazioni attive: {}", stats.active_allocations));
        report.push(format!("  Pressione memoria: {:?}", stats.memory_pressure));
        report.push("".to_string());
        
        report.push("📈 ALLOCAZIONI PER TIPO:".to_string());
        for (alloc_type, size) in &stats.allocations_by_type {
            report.push(format!("  {:?}: {:.2} MB", alloc_type, *size as f64 / 1024.0 / 1024.0));
        }
        report.push("".to_string());
        
        if !stats.potential_leaks.is_empty() {
            report.push("🚨 POTENZIALI MEMORY LEAK:".to_string());
            for leak in &stats.potential_leaks {
                let age = Utc::now() - leak.allocated_at;
                report.push(format!("  {} - {:.2} MB - {} - Età: {:.1}s", 
                                  leak.location, 
                                  leak.size_bytes as f64 / 1024.0 / 1024.0,
                                  leak.allocation_type,
                                  age.num_seconds() as f64));
            }
            report.push("".to_string());
        }
        
        report.push("🔍 TOP 10 ALLOCAZIONI ATTIVE:".to_string());
        let mut sorted_allocations = active_allocations;
        sorted_allocations.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        
        for (i, alloc) in sorted_allocations.iter().take(10).enumerate() {
            let age = Utc::now() - alloc.allocated_at;
            report.push(format!("  {}. {} - {:.2} MB - {} - Età: {:.1}s", 
                              i + 1,
                              alloc.location, 
                              alloc.size_bytes as f64 / 1024.0 / 1024.0,
                              alloc.allocation_type,
                              age.num_seconds() as f64));
        }
        
        report.join("\n")
    }
}

/// Istanza globale del manager audit memoria
use once_cell::sync::Lazy;
pub static MEMORY_AUDIT: Lazy<MemoryAuditManager> = Lazy::new(|| {
    MemoryAuditManager::new()
});

/// Macro per tracciare allocazioni automaticamente
#[macro_export]
macro_rules! track_memory {
    ($id:expr, $size:expr, $type:expr) => {
        $crate::memory_audit::MEMORY_AUDIT.track_allocation(
            $id.to_string(),
            $size,
            format!("{}:{}", file!(), line!()),
            $type
        ).await;
    };
}

#[macro_export]
macro_rules! untrack_memory {
    ($id:expr) => {
        $crate::memory_audit::MEMORY_AUDIT.track_deallocation($id).await;
    };
}

/// Comandi Tauri per audit memoria
#[tauri::command]
pub async fn get_memory_statistics() -> Result<MemoryStats, String> {
    Ok(MEMORY_AUDIT.get_memory_stats().await)
}

#[tauri::command]
pub async fn detect_memory_leaks() -> Result<Vec<MemoryAllocation>, String> {
    Ok(MEMORY_AUDIT.detect_memory_leaks().await)
}

#[tauri::command]
pub async fn cleanup_memory() -> Result<usize, String> {
    MEMORY_AUDIT.auto_cleanup().await
}

#[tauri::command]
pub async fn generate_memory_report() -> Result<String, String> {
    Ok(MEMORY_AUDIT.generate_memory_report().await)
}

#[tauri::command]
pub async fn reset_memory_stats() -> Result<String, String> {
    MEMORY_AUDIT.reset_stats().await;
    Ok("Statistiche memoria resettate con successo".to_string())
}

#[tauri::command]
pub async fn get_allocations_by_type(allocation_type: String) -> Result<Vec<MemoryAllocation>, String> {
    let alloc_type = match allocation_type.as_str() {
        "Cache" => AllocationType::Cache,
        "HttpClient" => AllocationType::HttpClient,
        "JsonParsing" => AllocationType::JsonParsing,
        "FileBuffer" => AllocationType::FileBuffer,
        "GameData" => AllocationType::GameData,
        "ApiResponse" => AllocationType::ApiResponse,
        _ => AllocationType::Unknown,
    };
    
    Ok(MEMORY_AUDIT.get_allocations_by_type(alloc_type).await)
}

/// Helper per monitoraggio automatico delle operazioni
pub struct MemoryGuard {
    id: String,
    size: usize,
}

impl MemoryGuard {
    pub async fn new(id: String, size: usize, allocation_type: AllocationType) -> Self {
        MEMORY_AUDIT.track_allocation(
            id.clone(),
            size,
            format!("MemoryGuard::{}", id),
            allocation_type
        ).await;
        
        Self { id, size }
    }
}

impl Drop for MemoryGuard {
    fn drop(&mut self) {
        // Nota: non possiamo usare async in Drop, quindi logghiamo solo
        debug!("[Memory] MemoryGuard dropped: {} ({} bytes)", self.id, self.size);
        
        // In un'implementazione reale, potresti voler usare un canale
        // per comunicare la deallocazione al manager
    }
}
