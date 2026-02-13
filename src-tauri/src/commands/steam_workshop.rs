use serde::{Deserialize, Serialize};

/// Risultato di un item del Workshop Steam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkshopItem {
    pub publishedfileid: String,
    pub title: String,
    pub description: String,
    pub creator: String,
    pub creator_appid: u64,
    pub consumer_appid: u64,
    pub filename: String,
    pub file_size: u64,
    pub preview_url: String,
    pub url: String,
    pub subscriptions: u64,
    pub favorited: u64,
    pub views: u64,
    pub score: f64,
    pub time_created: u64,
    pub time_updated: u64,
    pub tags: Vec<String>,
}

/// Risposta della ricerca Workshop
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkshopSearchResult {
    pub items: Vec<WorkshopItem>,
    pub total: u32,
}

/// Cerca item nel Workshop Steam usando IPublishedFileService/QueryFiles
#[tauri::command]
pub async fn search_steam_workshop(
    api_key: String,
    search_text: Option<String>,
    appid: Option<u64>,
    page: Option<u32>,
    numperpage: Option<u32>,
    query_type: Option<u32>,
    sort_by: Option<String>,
) -> Result<WorkshopSearchResult, String> {
    if api_key.is_empty() {
        return Err("Steam API Key non configurata. Vai su https://steamcommunity.com/dev/apikey per ottenerne una.".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("GameStringer")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Errore creazione client HTTP: {}", e))?;

    // query_type: 1 = RankedByVote, 3 = RankedByPublicationDate, 9 = RankedByTotalUniqueSubscriptions, 12 = RankedByTextSearch
    let qt = if search_text.as_ref().map_or(false, |s| !s.is_empty()) {
        query_type.unwrap_or(12) // RankedByTextSearch quando c'è testo
    } else {
        // Mappa il sort_by del frontend
        match sort_by.as_deref() {
            Some("recent") => 3,   // RankedByPublicationDate
            Some("rating") => 1,   // RankedByVote
            _ => 9,                // RankedByTotalUniqueSubscriptions (popular)
        }
    };

    let page_num = page.unwrap_or(1);
    let per_page = numperpage.unwrap_or(20);

    let mut url = format!(
        "https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?key={}&query_type={}&page={}&numperpage={}&return_tags=true&return_vote_data=true&return_details=true&return_previews=true&strip_description_bbcode=true",
        api_key, qt, page_num, per_page
    );

    if let Some(ref text) = search_text {
        if !text.is_empty() {
            url.push_str(&format!("&search_text={}", urlencoding::encode(text)));
        }
    }

    if let Some(app) = appid {
        if app > 0 {
            url.push_str(&format!("&appid={}", app));
        }
    }

    // Filetype 0 = Community items, 2 = Guides, etc.
    // Non specifichiamo per ottenere tutti i tipi
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Errore connessione Steam API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Steam API errore {}: {}", status, body));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Errore parsing risposta Steam: {}", e))?;

    let response_obj = &body["response"];
    let total = response_obj["total"]
        .as_u64()
        .unwrap_or(0) as u32;

    let published_files = response_obj["publishedfiledetails"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let items: Vec<WorkshopItem> = published_files
        .iter()
        .filter_map(|item| {
            let title = item["title"].as_str().unwrap_or("").to_string();
            if title.is_empty() {
                return None;
            }

            let tags: Vec<String> = item["tags"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|t| t["tag"].as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let publishedfileid = item["publishedfileid"]
                .as_str()
                .unwrap_or("0")
                .to_string();

            let preview_url = item["preview_url"]
                .as_str()
                .unwrap_or("")
                .to_string();

            let workshop_url = format!(
                "https://steamcommunity.com/sharedfiles/filedetails/?id={}",
                publishedfileid
            );

            Some(WorkshopItem {
                publishedfileid,
                title,
                description: item["short_description"]
                    .as_str()
                    .or_else(|| item["file_description"].as_str())
                    .unwrap_or("")
                    .chars()
                    .take(300)
                    .collect(),
                creator: item["creator"]
                    .as_str()
                    .unwrap_or("Unknown")
                    .to_string(),
                creator_appid: item["creator_appid"]
                    .as_u64()
                    .unwrap_or(0),
                consumer_appid: item["consumer_appid"]
                    .as_u64()
                    .unwrap_or(0),
                filename: item["filename"]
                    .as_str()
                    .unwrap_or("")
                    .to_string(),
                file_size: item["file_size"]
                    .as_str()
                    .and_then(|s| s.parse::<u64>().ok())
                    .or_else(|| item["file_size"].as_u64())
                    .unwrap_or(0),
                preview_url,
                url: workshop_url,
                subscriptions: item["subscriptions"]
                    .as_u64()
                    .unwrap_or(0),
                favorited: item["favorited"]
                    .as_u64()
                    .unwrap_or(0),
                views: item["views"]
                    .as_u64()
                    .unwrap_or(0),
                score: item["vote_data"]["score"]
                    .as_f64()
                    .unwrap_or(0.0),
                time_created: item["time_created"]
                    .as_u64()
                    .unwrap_or(0),
                time_updated: item["time_updated"]
                    .as_u64()
                    .unwrap_or(0),
                tags,
            })
        })
        .collect();

    Ok(WorkshopSearchResult { items, total })
}

/// Ottieni dettagli di un singolo item del Workshop
#[tauri::command]
pub async fn get_workshop_item_details(
    api_key: String,
    publishedfileid: String,
) -> Result<WorkshopItem, String> {
    if api_key.is_empty() {
        return Err("Steam API Key non configurata.".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("GameStringer")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Errore creazione client HTTP: {}", e))?;

    let url = format!(
        "https://api.steampowered.com/IPublishedFileService/GetDetails/v1/?key={}&publishedfileids[0]={}&includetags=true&includevotes=true",
        api_key, publishedfileid
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Errore connessione Steam API: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Steam API errore: {}", response.status()));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Errore parsing: {}", e))?;

    let item = &body["response"]["publishedfiledetails"][0];

    let title = item["title"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    let publishedfileid_str = item["publishedfileid"]
        .as_str()
        .unwrap_or(&publishedfileid)
        .to_string();

    let tags: Vec<String> = item["tags"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|t| t["tag"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Ok(WorkshopItem {
        publishedfileid: publishedfileid_str.clone(),
        title,
        description: item["file_description"]
            .as_str()
            .unwrap_or("")
            .chars()
            .take(500)
            .collect(),
        creator: item["creator"]
            .as_str()
            .unwrap_or("Unknown")
            .to_string(),
        creator_appid: item["creator_appid"].as_u64().unwrap_or(0),
        consumer_appid: item["consumer_appid"].as_u64().unwrap_or(0),
        filename: item["filename"].as_str().unwrap_or("").to_string(),
        file_size: item["file_size"]
            .as_str()
            .and_then(|s| s.parse::<u64>().ok())
            .or_else(|| item["file_size"].as_u64())
            .unwrap_or(0),
        preview_url: item["preview_url"].as_str().unwrap_or("").to_string(),
        url: format!(
            "https://steamcommunity.com/sharedfiles/filedetails/?id={}",
            publishedfileid_str
        ),
        subscriptions: item["subscriptions"].as_u64().unwrap_or(0),
        favorited: item["favorited"].as_u64().unwrap_or(0),
        views: item["views"].as_u64().unwrap_or(0),
        score: item["vote_data"]["score"].as_f64().unwrap_or(0.0),
        time_created: item["time_created"].as_u64().unwrap_or(0),
        time_updated: item["time_updated"].as_u64().unwrap_or(0),
        tags,
    })
}
