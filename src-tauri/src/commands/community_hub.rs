use serde::{Deserialize, Serialize};
use log::info;
use std::fs;
use std::path::PathBuf;

/// 📦 Community Package metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityPackage {
    pub id: String,
    pub name: String,
    pub game_id: String,
    pub game_name: String,
    pub source_language: String,
    pub target_language: String,
    pub entry_count: u32,
    pub author: String,
    pub author_id: String,
    pub description: String,
    pub version: String,
    pub downloads: u32,
    pub rating: f32,
    pub rating_count: u32,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub verified: bool,
    pub size: u64,
}

/// 📝 Translation entry in a package
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationEntry {
    pub source: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    #[serde(default)]
    pub verified: bool,
}

/// 📊 Community statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityStats {
    pub total_packages: u32,
    pub total_downloads: u64,
    pub total_entries: u64,
    pub top_languages: Vec<LanguageCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageCount {
    pub lang: String,
    pub count: u32,
}

/// Get community data directory
fn get_community_dir() -> Result<PathBuf, String> {
    let data_dir = dirs::data_local_dir()
        .ok_or("Cannot find local data directory")?;
    let community_dir = data_dir.join("GameStringer").join("community");
    fs::create_dir_all(&community_dir)
        .map_err(|e| format!("Cannot create community dir: {}", e))?;
    Ok(community_dir)
}

/// Get packages index file path
fn get_packages_index_path() -> Result<PathBuf, String> {
    Ok(get_community_dir()?.join("packages_index.json"))
}

/// 📦 Get all community packages (local cache)
#[tauri::command]
pub async fn community_get_packages(
    game_id: Option<String>,
    target_language: Option<String>,
    search: Option<String>,
    sort_by: Option<String>,
) -> Result<Vec<CommunityPackage>, String> {
    info!("📦 Loading community packages...");
    
    let index_path = get_packages_index_path()?;
    
    let mut packages: Vec<CommunityPackage> = if index_path.exists() {
        let json = fs::read_to_string(&index_path)
            .map_err(|e| format!("Read failed: {}", e))?;
        serde_json::from_str(&json)
            .map_err(|e| format!("Parse failed: {}", e))?
    } else {
        // Return sample packages if no local cache
        get_sample_packages()
    };
    
    // Apply filters
    if let Some(gid) = game_id {
        packages.retain(|p| p.game_id == gid);
    }
    
    if let Some(lang) = target_language {
        packages.retain(|p| p.target_language == lang);
    }
    
    if let Some(q) = search {
        let q_lower = q.to_lowercase();
        packages.retain(|p| {
            p.name.to_lowercase().contains(&q_lower) ||
            p.game_name.to_lowercase().contains(&q_lower) ||
            p.description.to_lowercase().contains(&q_lower) ||
            p.tags.iter().any(|t| t.to_lowercase().contains(&q_lower))
        });
    }
    
    // Sort
    match sort_by.as_deref() {
        Some("downloads") => packages.sort_by(|a, b| b.downloads.cmp(&a.downloads)),
        Some("rating") => packages.sort_by(|a, b| b.rating.partial_cmp(&a.rating).unwrap_or(std::cmp::Ordering::Equal)),
        _ => packages.sort_by(|a, b| b.updated_at.cmp(&a.updated_at)),
    }
    
    info!("✅ Loaded {} packages", packages.len());
    Ok(packages)
}

/// 📦 Get a single package by ID
#[tauri::command]
pub async fn community_get_package(package_id: String) -> Result<Option<CommunityPackage>, String> {
    let packages = community_get_packages(None, None, None, None).await?;
    Ok(packages.into_iter().find(|p| p.id == package_id))
}

/// 📥 Download package entries
#[tauri::command]
pub async fn community_download_entries(package_id: String) -> Result<Vec<TranslationEntry>, String> {
    info!("📥 Downloading entries for package: {}", package_id);
    
    let community_dir = get_community_dir()?;
    let entries_file = community_dir.join(format!("entries_{}.json", package_id));
    
    if entries_file.exists() {
        let json = fs::read_to_string(&entries_file)
            .map_err(|e| format!("Read failed: {}", e))?;
        let entries: Vec<TranslationEntry> = serde_json::from_str(&json)
            .map_err(|e| format!("Parse failed: {}", e))?;
        
        // Increment download count
        increment_download_count(&package_id).await.ok();
        
        info!("✅ Loaded {} entries from cache", entries.len());
        return Ok(entries);
    }
    
    // Return sample entries for demo
    let entries = get_sample_entries(&package_id);
    info!("✅ Returning {} sample entries", entries.len());
    Ok(entries)
}

/// 📤 Upload a new package
#[tauri::command]
pub async fn community_upload_package(
    name: String,
    game_id: String,
    game_name: String,
    source_language: String,
    target_language: String,
    description: String,
    tags: Vec<String>,
    entries: Vec<TranslationEntry>,
    author_id: String,
    author_name: String,
) -> Result<CommunityPackage, String> {
    info!("📤 Uploading new package: {} by {}", name, author_name);
    
    let now = chrono::Utc::now().to_rfc3339();
    let pkg_id = format!("pkg_{}_{}", chrono::Utc::now().timestamp_millis(), 
                         uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("xxx"));
    
    let package = CommunityPackage {
        id: pkg_id.clone(),
        name,
        game_id,
        game_name,
        source_language,
        target_language,
        entry_count: entries.len() as u32,
        author: author_name,
        author_id,
        description,
        version: "1.0.0".to_string(),
        downloads: 0,
        rating: 0.0,
        rating_count: 0,
        tags,
        created_at: now.clone(),
        updated_at: now,
        verified: false,
        size: serde_json::to_string(&entries).unwrap_or_default().len() as u64,
    };
    
    // Save entries
    let community_dir = get_community_dir()?;
    let entries_file = community_dir.join(format!("entries_{}.json", pkg_id));
    fs::write(&entries_file, serde_json::to_string_pretty(&entries).unwrap())
        .map_err(|e| format!("Cannot save entries: {}", e))?;
    
    // Update packages index
    let mut packages = community_get_packages(None, None, None, None).await.unwrap_or_default();
    packages.push(package.clone());
    
    let index_path = get_packages_index_path()?;
    fs::write(&index_path, serde_json::to_string_pretty(&packages).unwrap())
        .map_err(|e| format!("Cannot save index: {}", e))?;
    
    info!("✅ Package uploaded: {}", pkg_id);
    Ok(package)
}

/// ⭐ Rate a package
#[tauri::command]
pub async fn community_rate_package(package_id: String, rating: f32) -> Result<(), String> {
    info!("⭐ Rating package {} with {}", package_id, rating);
    
    let mut packages = community_get_packages(None, None, None, None).await?;
    
    let mut new_rating = 0.0f32;
    if let Some(pkg) = packages.iter_mut().find(|p| p.id == package_id) {
        let new_total = pkg.rating * pkg.rating_count as f32 + rating;
        pkg.rating_count += 1;
        pkg.rating = (new_total / pkg.rating_count as f32 * 10.0).round() / 10.0;
        new_rating = pkg.rating;
    }
    
    if new_rating > 0.0 {
        let index_path = get_packages_index_path()?;
        fs::write(&index_path, serde_json::to_string_pretty(&packages).unwrap())
            .map_err(|e| format!("Cannot save: {}", e))?;
        info!("✅ Package rated: {} stars", new_rating);
    }
    
    Ok(())
}

/// 📊 Get community statistics
#[tauri::command]
pub async fn community_get_stats() -> Result<CommunityStats, String> {
    let packages = community_get_packages(None, None, None, None).await?;
    
    let total_packages = packages.len() as u32;
    let total_downloads: u64 = packages.iter().map(|p| p.downloads as u64).sum();
    let total_entries: u64 = packages.iter().map(|p| p.entry_count as u64).sum();
    
    // Count by language
    let mut lang_counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for pkg in &packages {
        *lang_counts.entry(pkg.target_language.clone()).or_insert(0) += 1;
    }
    
    let mut top_languages: Vec<LanguageCount> = lang_counts
        .into_iter()
        .map(|(lang, count)| LanguageCount { lang, count })
        .collect();
    top_languages.sort_by(|a, b| b.count.cmp(&a.count));
    top_languages.truncate(5);
    
    Ok(CommunityStats {
        total_packages,
        total_downloads,
        total_entries,
        top_languages,
    })
}

/// 🗑️ Delete a package (only by owner)
#[tauri::command]
pub async fn community_delete_package(package_id: String, author_id: String) -> Result<(), String> {
    info!("🗑️ Deleting package: {}", package_id);
    
    let mut packages = community_get_packages(None, None, None, None).await?;
    
    // Find and verify ownership
    if let Some(pos) = packages.iter().position(|p| p.id == package_id && p.author_id == author_id) {
        packages.remove(pos);
        
        // Save updated index
        let index_path = get_packages_index_path()?;
        fs::write(&index_path, serde_json::to_string_pretty(&packages).unwrap())
            .map_err(|e| format!("Cannot save: {}", e))?;
        
        // Delete entries file
        let community_dir = get_community_dir()?;
        let entries_file = community_dir.join(format!("entries_{}.json", package_id));
        if entries_file.exists() {
            fs::remove_file(&entries_file).ok();
        }
        
        info!("✅ Package deleted");
        Ok(())
    } else {
        Err("Package not found or not owned by user".to_string())
    }
}

/// Helper: Increment download count
async fn increment_download_count(package_id: &str) -> Result<(), String> {
    let mut packages = community_get_packages(None, None, None, None).await?;
    
    if let Some(pkg) = packages.iter_mut().find(|p| p.id == package_id) {
        pkg.downloads += 1;
        
        let index_path = get_packages_index_path()?;
        fs::write(&index_path, serde_json::to_string_pretty(&packages).unwrap())
            .map_err(|e| format!("Cannot save: {}", e))?;
    }
    
    Ok(())
}

/// Sample packages for demo
fn get_sample_packages() -> Vec<CommunityPackage> {
    vec![
        CommunityPackage {
            id: "sample_1".to_string(),
            name: "Hollow Knight - Traduzione Completa".to_string(),
            game_id: "steam_367520".to_string(),
            game_name: "Hollow Knight".to_string(),
            source_language: "en".to_string(),
            target_language: "it".to_string(),
            entry_count: 4500,
            author: "TranslatorPro".to_string(),
            author_id: "user_1".to_string(),
            description: "Traduzione italiana completa di Hollow Knight, inclusi tutti i DLC.".to_string(),
            version: "2.1.0".to_string(),
            downloads: 15420,
            rating: 4.8,
            rating_count: 234,
            tags: vec!["metroidvania".to_string(), "completo".to_string(), "dlc".to_string()],
            created_at: "2024-06-15T10:00:00Z".to_string(),
            updated_at: "2025-01-10T14:30:00Z".to_string(),
            verified: true,
            size: 450000,
        },
        CommunityPackage {
            id: "sample_2".to_string(),
            name: "Stardew Valley - Mod Italiano".to_string(),
            game_id: "steam_413150".to_string(),
            game_name: "Stardew Valley".to_string(),
            source_language: "en".to_string(),
            target_language: "it".to_string(),
            entry_count: 8200,
            author: "FarmTranslations".to_string(),
            author_id: "user_2".to_string(),
            description: "Traduzione italiana per Stardew Valley 1.6+.".to_string(),
            version: "1.6.2".to_string(),
            downloads: 28750,
            rating: 4.9,
            rating_count: 512,
            tags: vec!["simulazione".to_string(), "farming".to_string(), "1.6".to_string()],
            created_at: "2024-03-20T08:00:00Z".to_string(),
            updated_at: "2025-01-15T09:00:00Z".to_string(),
            verified: true,
            size: 820000,
        },
        CommunityPackage {
            id: "sample_3".to_string(),
            name: "Celeste - UI e Dialoghi".to_string(),
            game_id: "steam_504230".to_string(),
            game_name: "Celeste".to_string(),
            source_language: "en".to_string(),
            target_language: "it".to_string(),
            entry_count: 1200,
            author: "PixelWords".to_string(),
            author_id: "user_3".to_string(),
            description: "Traduzione completa dell'UI e tutti i dialoghi di Celeste.".to_string(),
            version: "1.0.0".to_string(),
            downloads: 5680,
            rating: 4.6,
            rating_count: 89,
            tags: vec!["platformer".to_string(), "indie".to_string()],
            created_at: "2024-09-01T12:00:00Z".to_string(),
            updated_at: "2024-12-20T16:00:00Z".to_string(),
            verified: false,
            size: 120000,
        },
        CommunityPackage {
            id: "sample_4".to_string(),
            name: "Undertale - Traduzione Fan".to_string(),
            game_id: "steam_391540".to_string(),
            game_name: "Undertale".to_string(),
            source_language: "en".to_string(),
            target_language: "it".to_string(),
            entry_count: 3800,
            author: "DeterminedTeam".to_string(),
            author_id: "user_4".to_string(),
            description: "Traduzione italiana di Undertale realizzata con amore dalla community.".to_string(),
            version: "3.0.0".to_string(),
            downloads: 42000,
            rating: 4.7,
            rating_count: 876,
            tags: vec!["rpg".to_string(), "indie".to_string(), "cult".to_string()],
            created_at: "2023-11-10T10:00:00Z".to_string(),
            updated_at: "2024-08-15T11:00:00Z".to_string(),
            verified: true,
            size: 380000,
        },
        CommunityPackage {
            id: "sample_5".to_string(),
            name: "Hades - Glossario Gaming".to_string(),
            game_id: "steam_1145360".to_string(),
            game_name: "Hades".to_string(),
            source_language: "en".to_string(),
            target_language: "it".to_string(),
            entry_count: 6500,
            author: "OlympusTranslators".to_string(),
            author_id: "user_5".to_string(),
            description: "Traduzione di Hades con terminologia gaming italiana accurata.".to_string(),
            version: "1.2.0".to_string(),
            downloads: 18900,
            rating: 4.5,
            rating_count: 203,
            tags: vec!["roguelike".to_string(), "action".to_string()],
            created_at: "2024-01-25T14:00:00Z".to_string(),
            updated_at: "2024-11-30T10:00:00Z".to_string(),
            verified: false,
            size: 650000,
        },
    ]
}

/// Sample entries for demo packages
fn get_sample_entries(package_id: &str) -> Vec<TranslationEntry> {
    match package_id {
        "sample_1" => vec![
            TranslationEntry { source: "Hollow Knight".to_string(), target: "Cavaliere Vuoto".to_string(), context: Some("title".to_string()), verified: true },
            TranslationEntry { source: "Soul".to_string(), target: "Anima".to_string(), context: Some("resource".to_string()), verified: true },
            TranslationEntry { source: "Geo".to_string(), target: "Geo".to_string(), context: Some("currency".to_string()), verified: true },
            TranslationEntry { source: "Bench".to_string(), target: "Panchina".to_string(), context: Some("save_point".to_string()), verified: true },
            TranslationEntry { source: "Nail".to_string(), target: "Chiodo".to_string(), context: Some("weapon".to_string()), verified: true },
        ],
        "sample_2" => vec![
            TranslationEntry { source: "Farm".to_string(), target: "Fattoria".to_string(), context: Some("location".to_string()), verified: true },
            TranslationEntry { source: "Seeds".to_string(), target: "Semi".to_string(), context: Some("item".to_string()), verified: true },
            TranslationEntry { source: "Harvest".to_string(), target: "Raccolto".to_string(), context: Some("action".to_string()), verified: true },
            TranslationEntry { source: "Friendship".to_string(), target: "Amicizia".to_string(), context: Some("mechanic".to_string()), verified: true },
        ],
        _ => vec![
            TranslationEntry { source: "Example".to_string(), target: "Esempio".to_string(), context: Some("demo".to_string()), verified: false },
        ],
    }
}
