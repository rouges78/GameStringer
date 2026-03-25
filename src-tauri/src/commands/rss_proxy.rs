//! RSS Proxy — fetch feed RSS dal backend Rust per evitare CORS nel browser.
//!
//! Il frontend non può fare fetch cross-origin su siti che non mandano
//! Access-Control-Allow-Origin. Questo modulo fa da proxy: il frontend
//! chiama `fetch_rss_feed(url)` e il backend fa la richiesta HTTP senza
//! restrizioni CORS.

use reqwest::Client;
use std::time::Duration;

/// Scarica il contenuto di un URL RSS/Atom e lo restituisce come stringa XML.
#[tauri::command]
pub async fn fetch_rss_feed(url: String) -> Result<String, String> {
    if url.is_empty() {
        return Err("URL vuoto".into());
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::limited(5))
        .user_agent("GameStringer/1.5 RSS Reader")
        .build()
        .map_err(|e| format!("Client HTTP: {}", e))?;

    let resp = client
        .get(&url)
        .header("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*")
        .send()
        .await
        .map_err(|e| format!("Fetch {}: {}", url, e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {} per {}", resp.status().as_u16(), url));
    }

    let text = resp
        .text()
        .await
        .map_err(|e| format!("Lettura body: {}", e))?;

    Ok(text)
}
