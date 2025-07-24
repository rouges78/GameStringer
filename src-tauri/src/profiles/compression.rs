use flate2::Compression;
use flate2::read::{GzDecoder, GzEncoder};
use flate2::write::{GzEncoder as GzEncoderWrite, GzDecoder as GzDecoderWrite};
use serde::{Serialize, Deserialize};
use std::io::{Read, Write};
use anyhow::{Result, Context};

/// Configurazione per la compressione
#[derive(Debug, Clone)]
pub struct CompressionConfig {
    pub level: u32,
    pub min_size_for_compression: usize,
    pub enable_compression: bool,
}

impl Default for CompressionConfig {
    fn default() -> Self {
        Self {
            level: 6, // Bilanciamento tra velocità e compressione
            min_size_for_compression: 1024, // 1KB minimo per comprimere
            enable_compression: true,
        }
    }
}

/// Metadati per dati compressi
#[derive(Debug, Serialize, Deserialize)]
pub struct CompressedData {
    pub compressed: bool,
    pub original_size: usize,
    pub compressed_size: usize,
    pub data: Vec<u8>,
    pub checksum: u32,
}

/// Gestore compressione per dati profilo
pub struct ProfileCompressor {
    config: CompressionConfig,
}

impl ProfileCompressor {
    pub fn new(config: CompressionConfig) -> Self {
        Self { config }
    }

    pub fn with_default_config() -> Self {
        Self::new(CompressionConfig::default())
    }

    /// Comprime i dati se conveniente
    pub fn compress_data(&self, data: &[u8]) -> Result<CompressedData> {
        let original_size = data.len();
        let checksum = self.calculate_checksum(data);

        // Non comprimere se disabilitato o dati troppo piccoli
        if !self.config.enable_compression || original_size < self.config.min_size_for_compression {
            return Ok(CompressedData {
                compressed: false,
                original_size,
                compressed_size: original_size,
                data: data.to_vec(),
                checksum,
            });
        }

        // Comprimi i dati
        let mut encoder = GzEncoderWrite::new(Vec::new(), Compression::new(self.config.level));
        encoder.write_all(data)
            .context("Failed to write data to compressor")?;
        
        let compressed_data = encoder.finish()
            .context("Failed to finish compression")?;

        let compressed_size = compressed_data.len();

        // Usa compressione solo se effettivamente riduce la dimensione
        if compressed_size < original_size {
            Ok(CompressedData {
                compressed: true,
                original_size,
                compressed_size,
                data: compressed_data,
                checksum,
            })
        } else {
            // Compressione non conveniente, usa dati originali
            Ok(CompressedData {
                compressed: false,
                original_size,
                compressed_size: original_size,
                data: data.to_vec(),
                checksum,
            })
        }
    }

    /// Decomprime i dati
    pub fn decompress_data(&self, compressed: &CompressedData) -> Result<Vec<u8>> {
        let data = if compressed.compressed {
            // Decomprimi
            let mut decoder = GzDecoderWrite::new(Vec::new());
            decoder.write_all(&compressed.data)
                .context("Failed to write compressed data to decoder")?;
            
            decoder.finish()
                .context("Failed to finish decompression")?
        } else {
            // Dati non compressi
            compressed.data.clone()
        };

        // Verifica checksum
        let calculated_checksum = self.calculate_checksum(&data);
        if calculated_checksum != compressed.checksum {
            return Err(anyhow::anyhow!("Checksum mismatch: expected {}, got {}", 
                compressed.checksum, calculated_checksum));
        }

        // Verifica dimensione
        if data.len() != compressed.original_size {
            return Err(anyhow::anyhow!("Size mismatch: expected {}, got {}", 
                compressed.original_size, data.len()));
        }

        Ok(data)
    }

    /// Comprime e serializza un oggetto
    pub fn compress_serialize<T: Serialize>(&self, obj: &T) -> Result<CompressedData> {
        let json_data = serde_json::to_vec(obj)
            .context("Failed to serialize object to JSON")?;
        
        self.compress_data(&json_data)
    }

    /// Decomprime e deserializza un oggetto
    pub fn decompress_deserialize<T: for<'de> Deserialize<'de>>(&self, compressed: &CompressedData) -> Result<T> {
        let data = self.decompress_data(compressed)?;
        
        serde_json::from_slice(&data)
            .context("Failed to deserialize JSON data")
    }

    /// Calcola checksum CRC32
    fn calculate_checksum(&self, data: &[u8]) -> u32 {
        crc32fast::hash(data)
    }

    /// Ottieni statistiche di compressione
    pub fn get_compression_stats(&self, compressed: &CompressedData) -> CompressionStats {
        CompressionStats {
            original_size: compressed.original_size,
            compressed_size: compressed.compressed_size,
            compression_ratio: if compressed.original_size > 0 {
                compressed.compressed_size as f64 / compressed.original_size as f64
            } else {
                1.0
            },
            space_saved: compressed.original_size.saturating_sub(compressed.compressed_size),
            is_compressed: compressed.compressed,
        }
    }
}

/// Statistiche di compressione
#[derive(Debug)]
pub struct CompressionStats {
    pub original_size: usize,
    pub compressed_size: usize,
    pub compression_ratio: f64,
    pub space_saved: usize,
    pub is_compressed: bool,
}

impl CompressionStats {
    pub fn compression_percentage(&self) -> f64 {
        if self.original_size > 0 {
            (1.0 - self.compression_ratio) * 100.0
        } else {
            0.0
        }
    }
}

/// Utility per compressione batch di più file
pub struct BatchCompressor {
    compressor: ProfileCompressor,
}

impl BatchCompressor {
    pub fn new(config: CompressionConfig) -> Self {
        Self {
            compressor: ProfileCompressor::new(config),
        }
    }

    /// Comprimi multipli oggetti
    pub fn compress_batch<T: Serialize>(&self, objects: &[T]) -> Result<Vec<CompressedData>> {
        objects.iter()
            .map(|obj| self.compressor.compress_serialize(obj))
            .collect()
    }

    /// Decomprimi multipli oggetti
    pub fn decompress_batch<T: for<'de> Deserialize<'de>>(&self, compressed_data: &[CompressedData]) -> Result<Vec<T>> {
        compressed_data.iter()
            .map(|data| self.compressor.decompress_deserialize(data))
            .collect()
    }

    /// Ottieni statistiche aggregate
    pub fn get_batch_stats(&self, compressed_data: &[CompressedData]) -> BatchCompressionStats {
        let stats: Vec<CompressionStats> = compressed_data.iter()
            .map(|data| self.compressor.get_compression_stats(data))
            .collect();

        let total_original = stats.iter().map(|s| s.original_size).sum();
        let total_compressed = stats.iter().map(|s| s.compressed_size).sum();
        let compressed_count = stats.iter().filter(|s| s.is_compressed).count();

        BatchCompressionStats {
            total_files: stats.len(),
            compressed_files: compressed_count,
            total_original_size: total_original,
            total_compressed_size: total_compressed,
            total_space_saved: total_original.saturating_sub(total_compressed),
            average_compression_ratio: if total_original > 0 {
                total_compressed as f64 / total_original as f64
            } else {
                1.0
            },
        }
    }
}

/// Statistiche di compressione batch
#[derive(Debug)]
pub struct BatchCompressionStats {
    pub total_files: usize,
    pub compressed_files: usize,
    pub total_original_size: usize,
    pub total_compressed_size: usize,
    pub total_space_saved: usize,
    pub average_compression_ratio: f64,
}

impl BatchCompressionStats {
    pub fn average_compression_percentage(&self) -> f64 {
        (1.0 - self.average_compression_ratio) * 100.0
    }

    pub fn compression_efficiency(&self) -> f64 {
        if self.total_files > 0 {
            self.compressed_files as f64 / self.total_files as f64 * 100.0
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_compression_small_data() {
        let compressor = ProfileCompressor::with_default_config();
        let small_data = b"hello";
        
        let compressed = compressor.compress_data(small_data).unwrap();
        assert!(!compressed.compressed); // Troppo piccolo per essere compresso
        
        let decompressed = compressor.decompress_data(&compressed).unwrap();
        assert_eq!(decompressed, small_data);
    }

    #[test]
    fn test_compression_large_data() {
        let compressor = ProfileCompressor::with_default_config();
        let large_data = "x".repeat(2000).into_bytes();
        
        let compressed = compressor.compress_data(&large_data).unwrap();
        assert!(compressed.compressed); // Dovrebbe essere compresso
        assert!(compressed.compressed_size < compressed.original_size);
        
        let decompressed = compressor.decompress_data(&compressed).unwrap();
        assert_eq!(decompressed, large_data);
    }

    #[test]
    fn test_serialize_compression() {
        let compressor = ProfileCompressor::with_default_config();
        let data = json!({
            "name": "test_profile",
            "settings": {
                "theme": "dark",
                "language": "en",
                "notifications": true
            },
            "credentials": vec!["cred1", "cred2", "cred3"],
            "large_field": "x".repeat(1000)
        });
        
        let compressed = compressor.compress_serialize(&data).unwrap();
        let decompressed: serde_json::Value = compressor.decompress_deserialize(&compressed).unwrap();
        
        assert_eq!(data, decompressed);
    }

    #[test]
    fn test_batch_compression() {
        let batch_compressor = BatchCompressor::new(CompressionConfig::default());
        let objects = vec![
            json!({"data": "x".repeat(1000)}),
            json!({"data": "y".repeat(1500)}),
            json!({"data": "z".repeat(800)}),
        ];
        
        let compressed = batch_compressor.compress_batch(&objects).unwrap();
        let decompressed: Vec<serde_json::Value> = batch_compressor.decompress_batch(&compressed).unwrap();
        
        assert_eq!(objects, decompressed);
        
        let stats = batch_compressor.get_batch_stats(&compressed);
        assert_eq!(stats.total_files, 3);
        assert!(stats.total_space_saved > 0);
    }
}