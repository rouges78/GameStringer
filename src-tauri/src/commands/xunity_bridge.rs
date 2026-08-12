//! Bridge HTTP locale Ollama ↔ XUnity.AutoTranslator.
//!
//! XUnity, con `Endpoint=CustomTranslate`, chiama:
//!   GET http://127.0.0.1:<porta>/translate?from=en&to=ru&text=<url-encoded>
//! e si aspetta il testo tradotto nel body (HTTP 200).
//!
//! Qui avviamo un piccolo server (tokio, nessuna dipendenza extra) che traduce
//! ogni stringa con Ollama e la mette in cache. XUnity mantiene la propria cache
//! su file, quindi ogni stringa arriva una sola volta anche tra sessioni.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

static RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
pub struct BridgeInfo {
    pub url: String,
    pub port: u16,
}

/// Avvia il bridge di traduzione locale per XUnity. Idempotente: se già attivo
/// restituisce l'URL esistente.
///
/// ⚠️ `base_url` è l'indirizzo di Ollama scelto dall'utente (Impostazioni →
/// Indirizzo server Ollama). Fino al 12/08/2026 non c'era: `translate_with_ollama`
/// aveva `http://127.0.0.1:11434` CABLATO, quindi chi esegue Ollama su un'altra
/// porta, in WSL, in Docker o su un'altra macchina vedeva l'app dichiarare
/// «Attivo · N modelli» — perché lo STATO passa da `ollama_base_url` — e poi il
/// gioco restare in inglese, perché la TRADUZIONE no. La spia guardava un posto,
/// il motore un altro. Cfr. issue #49/#52.
///
/// L'endpoint si risolve UNA VOLTA all'avvio del bridge e viaggia con le
/// connessioni: il server vive finché vive l'app, e rileggere l'impostazione a
/// ogni richiesta significherebbe cambiarla sotto i piedi a una sessione di
/// gioco in corso.
#[tauri::command]
pub async fn start_xunity_bridge(
    port: Option<u16>,
    model: String,
    base_url: Option<String>,
) -> Result<BridgeInfo, String> {
    let port = port.unwrap_or(48920);
    let url = format!("http://127.0.0.1:{}/translate", port);

    if RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(BridgeInfo { url, port });
    }

    let ollama_base = super::ollama_endpoint::ollama_base_url(base_url.as_deref());

    let listener = match TcpListener::bind(("127.0.0.1", port)).await {
        Ok(l) => l,
        Err(e) => {
            RUNNING.store(false, Ordering::SeqCst);
            return Err(format!("Porta {} non disponibile: {}", port, e));
        }
    };

    // L'endpoint risolto va nel log: se le traduzioni non arrivano, questa riga
    // dice subito CON CHI stavamo parlando, invece di lasciarlo dedurre.
    log::info!(
        "[xunity-bridge] in ascolto su {} (model={}, ollama={})",
        url, model, ollama_base
    );

    tokio::spawn(async move {
        let cache: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
        // Contatore di fallimenti consecutivi: vedi `handle_conn`.
        let falliti: Arc<AtomicUsize> = Arc::new(AtomicUsize::new(0));
        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    let cache = cache.clone();
                    let model = model.clone();
                    let ollama_base = ollama_base.clone();
                    let falliti = falliti.clone();
                    tokio::spawn(async move {
                        if let Err(e) = handle_conn(stream, cache, model, ollama_base, falliti).await {
                            log::debug!("[xunity-bridge] conn error: {}", e);
                        }
                    });
                }
                Err(e) => log::warn!("[xunity-bridge] accept error: {}", e),
            }
        }
    });

    Ok(BridgeInfo { url, port })
}

async fn handle_conn(
    mut stream: TcpStream,
    cache: Arc<Mutex<HashMap<String, String>>>,
    model: String,
    ollama_base: String,
    falliti: Arc<AtomicUsize>,
) -> Result<(), String> {
    // Per una GET la request-line è nei primi byte; 64KB coprono URL lunghi.
    let mut buf = vec![0u8; 65536];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    let head = String::from_utf8_lossy(&buf[..n]);
    let request_line = head.lines().next().unwrap_or("");
    let path = request_line.split_whitespace().nth(1).unwrap_or("");

    let (from, to, text) = parse_query(path);

    let body = if text.trim().is_empty() {
        String::new()
    } else {
        let key = format!("{}|{}|{}", from, to, text);
        // NB: lock rilasciato prima dell'await (nessun guard attraverso .await)
        let cached = { cache.lock().unwrap().get(&key).cloned() };
        match cached {
            Some(hit) => hit,
            None => match translate_with_ollama(&text, &from, &to, &model, &ollama_base).await {
                Ok(tr) if !tr.is_empty() && tr != text => {
                    falliti.store(0, Ordering::Relaxed);
                    cache.lock().unwrap().insert(key, tr.clone());
                    tr
                }
                // Fallback: si restituisce l'originale. Mai un messaggio d'errore,
                // perché XUnity lo scriverebbe nella sua cache su file e il gioco
                // resterebbe con quella stringa per sempre.
                //
                // ⚠️ MA IL FALLBACK È MUTO PER COSTRUZIONE: l'utente vede il gioco
                // in inglese e nessun errore da nessuna parte — è il difetto #1 di
                // questo progetto. Non potendo rispondere con l'errore, lo si
                // scrive nel LOG, una volta ogni 20 fallimenti consecutivi (non a
                // ogni stringa: un gioco ne manda migliaia e il log diventerebbe
                // illeggibile proprio quando serve). La riga dice l'ENDPOINT, che è
                // l'informazione che mancava quando le traduzioni sparivano.
                esito => {
                    let n = falliti.fetch_add(1, Ordering::Relaxed) + 1;
                    if n == 1 || n % 20 == 0 {
                        let motivo = match esito {
                            Err(e) => e,
                            Ok(_) => "risposta vuota o identica all'originale".to_string(),
                        };
                        log::warn!(
                            "[xunity-bridge] {} traduzioni consecutive NON riuscite con ollama={} (model={}): {} \
                             — il gioco resta nella lingua originale. Se Ollama è su un'altra porta, \
                             impostala in Impostazioni → Indirizzo server Ollama.",
                            n, ollama_base, model, motivo
                        );
                    }
                    text.clone()
                }
            },
        }
    };

    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.as_bytes().len(),
        body
    );
    stream.write_all(resp.as_bytes()).await.map_err(|e| e.to_string())?;
    stream.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_query(path: &str) -> (String, String, String) {
    let q = path.splitn(2, '?').nth(1).unwrap_or("");
    let mut from = String::from("en");
    let mut to = String::from("ru");
    let mut text = String::new();
    for pair in q.split('&') {
        let mut it = pair.splitn(2, '=');
        let k = it.next().unwrap_or("");
        let v = it.next().unwrap_or("");
        let decoded = url_decode(v);
        match k {
            "from" => from = decoded,
            "to" => to = decoded,
            "text" => text = decoded,
            _ => {}
        }
    }
    (from, to, text)
}

/// Percent-decoding minimale (%XX + '+' come spazio), sufficiente per XUnity.
fn url_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                if let (Some(h), Some(l)) = (hi, lo) {
                    out.push((h * 16 + l) as u8);
                    i += 3;
                } else {
                    out.push(bytes[i]);
                    i += 1;
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// ⚠️ `ollama_base` arriva risolto da `start_xunity_bridge`. Non rimettere qui
/// un indirizzo cablato: era il difetto che faceva fallire la traduzione Unity
/// mentre la spia dell'app diceva «Attivo».
async fn translate_with_ollama(
    text: &str,
    from: &str,
    to: &str,
    model: &str,
    ollama_base: &str,
) -> Result<String, String> {
    let prompt = format!(
        "Translate from {} to {}. Return ONLY the translation, no notes, no quotes.\n\n{}",
        from, to, text
    );
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/generate", ollama_base))
        .json(&serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": false,
            "options": { "temperature": 0.1 }
        }))
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(v["response"].as_str().unwrap_or("").trim().to_string())
}

/// Ripunta il Config.ini di XUnity sul bridge locale (Endpoint=CustomTranslate + [Custom] Url).
/// Aggiorna tutti i file di config noti che esistono sotto la cartella del gioco.
#[tauri::command]
pub async fn set_xunity_custom_endpoint(game_path: String, url: String) -> Result<String, String> {
    let base = std::path::Path::new(&game_path);
    let candidates = [
        base.join("BepInEx/config/AutoTranslatorConfig.ini"),
        base.join("BepInEx/plugins/XUnity.AutoTranslator/Config.ini"),
        base.join("AutoTranslator/Config.ini"),
    ];

    let mut patched = 0;
    for path in candidates.iter() {
        if !path.exists() {
            continue;
        }
        let content = tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())?;
        let new_content = patch_ini_custom_endpoint(&content, &url);
        tokio::fs::write(path, new_content).await.map_err(|e| e.to_string())?;
        patched += 1;
    }

    if patched == 0 {
        return Err("Nessun Config.ini di XUnity trovato (installa prima la patch)".to_string());
    }
    Ok(format!("Endpoint XUnity impostato sul bridge locale ({} file)", patched))
}

/// Trasforma un Config.ini XUnity: Endpoint=CustomTranslate e [Custom] Url=<url>.
fn patch_ini_custom_endpoint(content: &str, url: &str) -> String {
    let mut out = String::new();
    let mut in_custom = false;
    let mut endpoint_done = false;
    let mut url_done = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            // uscendo dalla sezione [Custom] senza aver scritto Url, aggiungilo
            if in_custom && !url_done {
                out.push_str(&format!("Url={}\n", url));
                url_done = true;
            }
            in_custom = trimmed.eq_ignore_ascii_case("[Custom]");
            out.push_str(line);
            out.push('\n');
            continue;
        }
        if trimmed.starts_with("Endpoint=") && !endpoint_done {
            out.push_str("Endpoint=CustomTranslate\n");
            endpoint_done = true;
            continue;
        }
        if in_custom && trimmed.starts_with("Url=") {
            out.push_str(&format!("Url={}\n", url));
            url_done = true;
            continue;
        }
        out.push_str(line);
        out.push('\n');
    }

    if in_custom && !url_done {
        out.push_str(&format!("Url={}\n", url));
        url_done = true;
    }
    if !url_done {
        out.push_str(&format!("\n[Custom]\nUrl={}\n", url));
    }
    if !endpoint_done {
        out.push_str("\n[Service]\nEndpoint=CustomTranslate\n");
    }
    out
}
