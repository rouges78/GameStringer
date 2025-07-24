use std::path::{Path, PathBuf};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH, Duration};
use anyhow::{Result, Context};
use tokio::time::interval;
use serde::{Serialize, Deserialize};

/// Configurazione per il cleanup automatico
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupConfig {
    /// Intervallo di cleanup in secondi
    pub cleanup_interval_seconds: u64,
    /// Età massima per file temporanei in secondi
    pub temp_file_max_age_seconds: u64,
    /// Età massima per file di log in secondi
    pub log_file_max_age_seconds: u64,
    /// Età massima per backup in secondi
    pub backup_max_age_seconds: u64,
    /// Dimensione massima cache in bytes
    pub max_cache_size_bytes: u64,
    /// Numero massimo di backup da mantenere
    pub max_backup_count: usize,
    /// Abilita cleanup automatico
    pub enable_auto_cleanup: bool,
}

impl Default for CleanupConfig {
    fn default() -> Self {
        Self {
            cleanup_interval_seconds: 3600, // 1 ora
            temp_file_max_age_seconds: 86400, // 1 giorno
            log_file_max_age_seconds: 604800, // 1 settimana
            backup_max_age_seconds: 2592000, // 30 giorni
            max_cache_size_bytes: 100 * 1024 * 1024, // 100MB
            max_backup_count: 10,
            enable_auto_cleanup: true,
        }
    }
}

/// Statistiche del cleanup
#[derive(Debug, Serialize, Deserialize)]
pub struct CleanupStats {
    pub files_deleted: usize,
    pub bytes_freed: u64,
    pub directories_cleaned: usize,
    pub errors_encountered: usize,
    pub cleanup_duration_ms: u64,
    pub last_cleanup: u64,
}

/// Gestore per il cleanup automatico
pub struct ProfileCleanupManager {
    config: CleanupConfig,
    profiles_dir: PathBuf,
    temp_dir: PathBuf,
    cache_dir: PathBuf,
    logs_dir: PathBuf,
    backups_dir: PathBuf,
}

impl ProfileCleanupManager {
    pub fn new(
        config: CleanupConfig,
        profiles_dir: PathBuf,
        temp_dir: PathBuf,
        cache_dir: PathBuf,
        logs_dir: PathBuf,
        backups_dir: PathBuf,
    ) -> Self {
        Self {
            config,
            profiles_dir,
            temp_dir,
            cache_dir,
            logs_dir,
            backups_dir,
        }
    }

    /// Avvia il cleanup automatico
    pub async fn start_auto_cleanup(&self) -> Result<()> {
        if !self.config.enable_auto_cleanup {
            log::info!("Auto cleanup is disabled");
            return Ok(());
        }

        let mut interval = interval(Duration::from_secs(self.config.cleanup_interval_seconds));
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.run_cleanup().await {
                log::error!("Error during auto cleanup: {}", e);
            }
        }
    }

    /// Esegue un ciclo di cleanup completo
    pub async fn run_cleanup(&self) -> Result<CleanupStats> {
        let start_time = SystemTime::now();
        let mut stats = CleanupStats {
            files_deleted: 0,
            bytes_freed: 0,
            directories_cleaned: 0,
            errors_encountered: 0,
            cleanup_duration_ms: 0,
            last_cleanup: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };

        log::info!("Starting profile cleanup");

        // Cleanup file temporanei
        if let Err(e) = self.cleanup_temp_files(&mut stats).await {
            log::error!("Error cleaning temp files: {}", e);
            stats.errors_encountered += 1;
        }

        // Cleanup log files
        if let Err(e) = self.cleanup_log_files(&mut stats).await {
            log::error!("Error cleaning log files: {}", e);
            stats.errors_encountered += 1;
        }

        // Cleanup backup files
        if let Err(e) = self.cleanup_backup_files(&mut stats).await {
            log::error!("Error cleaning backup files: {}", e);
            stats.errors_encountered += 1;
        }

        // Cleanup cache
        if let Err(e) = self.cleanup_cache(&mut stats).await {
            log::error!("Error cleaning cache: {}", e);
            stats.errors_encountered += 1;
        }

        // Cleanup directory vuote
        if let Err(e) = self.cleanup_empty_directories(&mut stats).await {
            log::error!("Error cleaning empty directories: {}", e);
            stats.errors_encountered += 1;
        }

        stats.cleanup_duration_ms = start_time
            .elapsed()
            .unwrap_or_default()
            .as_millis() as u64;

        log::info!(
            "Cleanup completed: {} files deleted, {} bytes freed, {} ms",
            stats.files_deleted,
            stats.bytes_freed,
            stats.cleanup_duration_ms
        );

        Ok(stats)
    }

    /// Cleanup file temporanei
    async fn cleanup_temp_files(&self, stats: &mut CleanupStats) -> Result<()> {
        if !self.temp_dir.exists() {
            return Ok(());
        }

        let max_age = Duration::from_secs(self.config.temp_file_max_age_seconds);
        self.cleanup_files_by_age_sync(&self.temp_dir, max_age, stats)
    }

    /// Cleanup file di log
    async fn cleanup_log_files(&self, stats: &mut CleanupStats) -> Result<()> {
        if !self.logs_dir.exists() {
            return Ok(());
        }

        let max_age = Duration::from_secs(self.config.log_file_max_age_seconds);
        self.cleanup_files_by_age_sync(&self.logs_dir, max_age, stats)
    }

    /// Cleanup file di backup
    async fn cleanup_backup_files(&self, stats: &mut CleanupStats) -> Result<()> {
        if !self.backups_dir.exists() {
            return Ok(());
        }

        // Cleanup per età
        let max_age = Duration::from_secs(self.config.backup_max_age_seconds);
        self.cleanup_files_by_age_sync(&self.backups_dir, max_age, stats)?;

        // Cleanup per numero massimo
        self.cleanup_backups_by_count(stats).await
    }

    /// Cleanup cache per dimensione
    async fn cleanup_cache(&self, stats: &mut CleanupStats) -> Result<()> {
        if !self.cache_dir.exists() {
            return Ok(());
        }

        let mut files_with_size = Vec::new();
        self.collect_files_with_size(&self.cache_dir, &mut files_with_size)?;

        // Ordina per data di accesso (più vecchi prima)
        files_with_size.sort_by_key(|(path, _, accessed)| *accessed);

        let mut total_size = files_with_size.iter().map(|(_, size, _)| size).sum::<u64>();

        for (path, size, _) in files_with_size {
            if total_size <= self.config.max_cache_size_bytes {
                break;
            }

            if let Err(e) = fs::remove_file(&path) {
                log::warn!("Failed to remove cache file {:?}: {}", path, e);
                stats.errors_encountered += 1;
            } else {
                stats.files_deleted += 1;
                stats.bytes_freed += size;
                total_size -= size;
                log::debug!("Removed cache file: {:?}", path);
            }
        }

        Ok(())
    }

    /// Cleanup directory vuote
    async fn cleanup_empty_directories(&self, stats: &mut CleanupStats) -> Result<()> {
        let directories = [
            &self.temp_dir,
            &self.cache_dir,
            &self.logs_dir,
        ];

        for dir in directories {
            if let Err(e) = self.remove_empty_directories(dir, stats) {
                log::warn!("Error removing empty directories in {:?}: {}", dir, e);
                stats.errors_encountered += 1;
            }
        }

        Ok(())
    }

    /// Cleanup file per età
    fn cleanup_files_by_age_sync(
        &self,
        dir: &Path,
        max_age: Duration,
        stats: &mut CleanupStats,
    ) -> Result<()> {
        let entries = fs::read_dir(dir)
            .with_context(|| format!("Failed to read directory: {:?}", dir))?;

        let now = SystemTime::now();

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                let metadata = entry.metadata()?;
                let modified = metadata.modified()?;

                if let Ok(age) = now.duration_since(modified) {
                    if age > max_age {
                        let size = metadata.len();
                        
                        if let Err(e) = fs::remove_file(&path) {
                            log::warn!("Failed to remove old file {:?}: {}", path, e);
                            stats.errors_encountered += 1;
                        } else {
                            stats.files_deleted += 1;
                            stats.bytes_freed += size;
                            log::debug!("Removed old file: {:?} (age: {:?})", path, age);
                        }
                    }
                }
            } else if path.is_dir() {
                // Ricorsione per sottodirectory
                if let Err(e) = self.cleanup_files_by_age_sync(&path, max_age, stats) {
                    log::warn!("Error cleaning subdirectory {:?}: {}", path, e);
                    stats.errors_encountered += 1;
                }
            }
        }

        Ok(())
    }

    /// Cleanup backup per numero massimo
    async fn cleanup_backups_by_count(&self, stats: &mut CleanupStats) -> Result<()> {
        let mut backups = Vec::new();
        
        let entries = fs::read_dir(&self.backups_dir)?;
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                let metadata = entry.metadata()?;
                let modified = metadata.modified()?;
                backups.push((path, metadata.len(), modified));
            }
        }

        // Ordina per data (più recenti prima)
        backups.sort_by_key(|(_, _, modified)| std::cmp::Reverse(*modified));

        // Rimuovi backup in eccesso
        for (path, size, _) in backups.into_iter().skip(self.config.max_backup_count) {
            if let Err(e) = fs::remove_file(&path) {
                log::warn!("Failed to remove excess backup {:?}: {}", path, e);
                stats.errors_encountered += 1;
            } else {
                stats.files_deleted += 1;
                stats.bytes_freed += size;
                log::debug!("Removed excess backup: {:?}", path);
            }
        }

        Ok(())
    }

    /// Raccoglie file con dimensioni e data di accesso
    fn collect_files_with_size(
        &self,
        dir: &Path,
        files: &mut Vec<(PathBuf, u64, SystemTime)>,
    ) -> Result<()> {
        let entries = fs::read_dir(dir)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                let metadata = entry.metadata()?;
                let size = metadata.len();
                let accessed = metadata.accessed().unwrap_or_else(|_| {
                    metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH)
                });
                
                files.push((path, size, accessed));
            } else if path.is_dir() {
                self.collect_files_with_size(&path, files)?;
            }
        }

        Ok(())
    }

    /// Rimuove directory vuote ricorsivamente
    fn remove_empty_directories(&self, dir: &Path, stats: &mut CleanupStats) -> Result<()> {
        if !dir.exists() || !dir.is_dir() {
            return Ok(());
        }

        let entries = fs::read_dir(dir)?;
        let mut has_files = false;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                // Ricorsione per sottodirectory
                self.remove_empty_directories(&path, stats)?;
                
                // Controlla se la directory è ora vuota
                if fs::read_dir(&path)?.next().is_none() {
                    if let Err(e) = fs::remove_dir(&path) {
                        log::warn!("Failed to remove empty directory {:?}: {}", path, e);
                        stats.errors_encountered += 1;
                    } else {
                        stats.directories_cleaned += 1;
                        log::debug!("Removed empty directory: {:?}", path);
                    }
                } else {
                    has_files = true;
                }
            } else {
                has_files = true;
            }
        }

        Ok(())
    }

    /// Forza cleanup immediato
    pub async fn force_cleanup(&self) -> Result<CleanupStats> {
        log::info!("Force cleanup requested");
        self.run_cleanup().await
    }

    /// Ottieni statistiche directory
    pub fn get_directory_stats(&self) -> Result<DirectoryStats> {
        let mut stats = DirectoryStats::default();

        if let Ok(temp_stats) = self.get_dir_stats(&self.temp_dir) {
            stats.temp_files = temp_stats.file_count;
            stats.temp_size = temp_stats.total_size;
        }

        if let Ok(cache_stats) = self.get_dir_stats(&self.cache_dir) {
            stats.cache_files = cache_stats.file_count;
            stats.cache_size = cache_stats.total_size;
        }

        if let Ok(log_stats) = self.get_dir_stats(&self.logs_dir) {
            stats.log_files = log_stats.file_count;
            stats.log_size = log_stats.total_size;
        }

        if let Ok(backup_stats) = self.get_dir_stats(&self.backups_dir) {
            stats.backup_files = backup_stats.file_count;
            stats.backup_size = backup_stats.total_size;
        }

        Ok(stats)
    }

    fn get_dir_stats(&self, dir: &Path) -> Result<DirStats> {
        let mut stats = DirStats::default();
        
        if !dir.exists() {
            return Ok(stats);
        }

        self.collect_dir_stats(dir, &mut stats)?;
        Ok(stats)
    }

    fn collect_dir_stats(&self, dir: &Path, stats: &mut DirStats) -> Result<()> {
        let entries = fs::read_dir(dir)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                let metadata = entry.metadata()?;
                stats.file_count += 1;
                stats.total_size += metadata.len();
            } else if path.is_dir() {
                self.collect_dir_stats(&path, stats)?;
            }
        }

        Ok(())
    }
}

#[derive(Debug, Default)]
struct DirStats {
    file_count: usize,
    total_size: u64,
}

/// Statistiche delle directory
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct DirectoryStats {
    pub temp_files: usize,
    pub temp_size: u64,
    pub cache_files: usize,
    pub cache_size: u64,
    pub log_files: usize,
    pub log_size: u64,
    pub backup_files: usize,
    pub backup_size: u64,
}

impl DirectoryStats {
    pub fn total_files(&self) -> usize {
        self.temp_files + self.cache_files + self.log_files + self.backup_files
    }

    pub fn total_size(&self) -> u64 {
        self.temp_size + self.cache_size + self.log_size + self.backup_size
    }
}