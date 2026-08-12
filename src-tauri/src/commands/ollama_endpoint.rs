//! Risoluzione dell'indirizzo del server Ollama — punto UNICO di verità.
//!
//! Prima l'indirizzo era cablato in nove punti diversi, metà come
//! `localhost:11434` e metà come `127.0.0.1:11434`, senza alcun modo di
//! cambiarlo. Conseguenze reali segnalate dagli utenti (6 in un mese):
//!
//! - chi esegue Ollama su un'altra porta, in WSL, in Docker o su un'altra
//!   macchina non poteva farlo sapere all'app: «ho provato porte e URL diversi,
//!   zero effetto» — perché il backend li ignorava;
//! - `localhost` su Windows risolve spesso PRIMA su IPv6 (`::1`), mentre Ollama
//!   di default ascolta su IPv4 (`127.0.0.1`): la connessione TCP riusciva e la
//!   chiamata HTTP no, quindi l'app diceva "in esecuzione" ma senza modelli.
//!
//! Ordine di precedenza:
//!   1. override esplicito passato dal frontend (impostazione utente);
//!   2. variabile d'ambiente `OLLAMA_HOST` — è lo standard di Ollama stesso,
//!      quindi chi l'ha già impostata per il proprio setup funziona senza
//!      toccare nulla;
//!   3. `http://127.0.0.1:11434` (IPv4 esplicito, non `localhost`).

/// Endpoint di default: IPv4 esplicito per non incappare nella risoluzione IPv6.
pub const DEFAULT_OLLAMA_URL: &str = "http://127.0.0.1:11434";

/// Normalizza un indirizzo in una base URL utilizzabile.
///
/// Accetta le forme che gli utenti scrivono davvero:
/// `11434`, `1.2.3.4:11434`, `localhost:11434`, `http://host:11434`,
/// `http://host:11434/` (barra finale rimossa).
pub fn normalize_ollama_url(raw: &str) -> Option<String> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    // Solo la porta ("11434") → host di default
    if s.chars().all(|c| c.is_ascii_digit()) {
        return Some(format!("http://127.0.0.1:{}", s));
    }
    let with_scheme = if s.starts_with("http://") || s.starts_with("https://") {
        s.to_string()
    } else {
        format!("http://{}", s)
    };
    // `localhost` → `127.0.0.1`: su Windows la risoluzione IPv6-first fa fallire
    // le richieste verso un Ollama che ascolta solo su IPv4.
    let with_scheme = with_scheme
        .replace("://localhost:", "://127.0.0.1:")
        .replace("://localhost/", "://127.0.0.1/");
    let with_scheme = if with_scheme.ends_with("://localhost") {
        with_scheme.replace("://localhost", "://127.0.0.1")
    } else {
        with_scheme
    };
    Some(with_scheme.trim_end_matches('/').to_string())
}

/// Base URL da usare per ogni chiamata a Ollama.
/// `override_url` è l'eventuale impostazione dell'utente (dal frontend).
pub fn ollama_base_url(override_url: Option<&str>) -> String {
    if let Some(u) = override_url.and_then(normalize_ollama_url) {
        return u;
    }
    if let Ok(env) = std::env::var("OLLAMA_HOST") {
        if let Some(u) = normalize_ollama_url(&env) {
            return u;
        }
    }
    DEFAULT_OLLAMA_URL.to_string()
}

/// Ultimo indirizzo passato dal frontend, memorizzato per chi NON può riceverlo
/// come parametro.
///
/// ⚠️ Il caso concreto è la spia «🟢 Ollama: Online» del menu tray
/// (`main.rs`): gira in un task di background avviato al setup dell'app, non è
/// un comando invocato dal frontend, quindi non ha nessun `base_url` da cui
/// partire. Fino al 12/08/2026 aveva `http://localhost:11434` cablato e diceva
/// «Offline» a chiunque avesse Ollama altrove — il contrario esatto del difetto
/// di `xunity_bridge`, ma la stessa causa.
///
/// L'impostazione utente vive nel `localStorage` del frontend
/// (`gameStringerSettings.translation.ollamaUrl`) e il Rust non la legge: non
/// c'è modo di andarla a prendere. Quindi la si **ricorda al passaggio**, dai
/// comandi che già la ricevono. Nessun comando nuovo da inventare e nessun
/// cablaggio in più nel frontend che qualcuno possa dimenticare di fare — che è
/// il modo in cui in questo progetto nascono i pezzi completi e mai chiamati.
static LAST_USER_OVERRIDE: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

/// Memorizza l'indirizzo scelto dall'utente. Va chiamata dai comandi che lo
/// ricevono dal frontend; `None` non cancella quello già noto (una chiamata
/// senza override non significa «l'utente ha tolto l'impostazione», significa
/// solo che quel chiamante non l'ha passata).
pub fn remember_user_override(override_url: Option<&str>) {
    if let Some(u) = override_url.and_then(normalize_ollama_url) {
        if let Ok(mut slot) = LAST_USER_OVERRIDE.lock() {
            *slot = Some(u);
        }
    }
}

/// Base URL per chi non ha un `base_url` da passare (task di background).
/// Precedenza: ultimo override ricordato → `OLLAMA_HOST` → default IPv4.
pub fn ollama_base_url_remembered() -> String {
    if let Ok(slot) = LAST_USER_OVERRIDE.lock() {
        if let Some(u) = slot.as_ref() {
            return u.clone();
        }
    }
    ollama_base_url(None)
}

/// Coppia host/porta per il probe TCP, ricavata dalla base URL.
pub fn ollama_host_port(base_url: &str) -> (String, u16) {
    let no_scheme = base_url
        .trim_start_matches("http://")
        .trim_start_matches("https://");
    let hostport = no_scheme.split('/').next().unwrap_or(no_scheme);
    match hostport.rsplit_once(':') {
        Some((h, p)) => (h.to_string(), p.parse().unwrap_or(11434)),
        None => (hostport.to_string(), 11434),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_ipv4_not_localhost() {
        // `localhost` su Windows può risolvere su ::1, dove Ollama non ascolta.
        assert_eq!(DEFAULT_OLLAMA_URL, "http://127.0.0.1:11434");
        assert!(!DEFAULT_OLLAMA_URL.contains("localhost"));
    }

    #[test]
    fn normalizes_bare_port() {
        assert_eq!(normalize_ollama_url("11434").unwrap(), "http://127.0.0.1:11434");
    }

    #[test]
    fn adds_missing_scheme() {
        assert_eq!(normalize_ollama_url("192.168.1.5:11434").unwrap(), "http://192.168.1.5:11434");
    }

    #[test]
    fn rewrites_localhost_to_ipv4() {
        assert_eq!(normalize_ollama_url("http://localhost:11434").unwrap(), "http://127.0.0.1:11434");
        assert_eq!(normalize_ollama_url("localhost:11434").unwrap(), "http://127.0.0.1:11434");
    }

    #[test]
    fn strips_trailing_slash() {
        assert_eq!(normalize_ollama_url("http://host:1234/").unwrap(), "http://host:1234");
    }

    #[test]
    fn keeps_https_and_custom_host() {
        assert_eq!(normalize_ollama_url("https://ollama.lan:443").unwrap(), "https://ollama.lan:443");
    }

    #[test]
    fn empty_input_is_none() {
        assert!(normalize_ollama_url("").is_none());
        assert!(normalize_ollama_url("   ").is_none());
    }

    #[test]
    fn override_wins_over_everything() {
        assert_eq!(ollama_base_url(Some("9999")), "http://127.0.0.1:9999");
    }

    #[test]
    fn falls_back_to_default_without_override() {
        // NB: non tocchiamo OLLAMA_HOST qui per non interferire con altri test;
        // il caso "env impostata" è coperto dalla logica di normalize_*.
        if std::env::var("OLLAMA_HOST").is_err() {
            assert_eq!(ollama_base_url(None), DEFAULT_OLLAMA_URL);
        }
    }

    #[test]
    fn host_port_splits_correctly() {
        assert_eq!(ollama_host_port("http://127.0.0.1:11434"), ("127.0.0.1".to_string(), 11434));
        assert_eq!(ollama_host_port("http://192.168.1.5:1234"), ("192.168.1.5".to_string(), 1234));
    }

    #[test]
    fn host_port_defaults_when_missing() {
        assert_eq!(ollama_host_port("http://myhost"), ("myhost".to_string(), 11434));
    }

    #[test]
    fn remembered_override_wins_and_survives_a_none() {
        remember_user_override(Some("http://192.168.1.9:12345"));
        assert_eq!(ollama_base_url_remembered(), "http://192.168.1.9:12345");

        // Un chiamante che non passa l'indirizzo NON deve cancellare quello noto:
        // «non l'ho passato» non è «l'utente l'ha tolto».
        remember_user_override(None);
        assert_eq!(ollama_base_url_remembered(), "http://192.168.1.9:12345");

        // Ripristino per non condizionare gli altri test dello stesso processo.
        if let Ok(mut slot) = LAST_USER_OVERRIDE.lock() {
            *slot = None;
        }
    }

    /// ⚠️ GATE, non un test di comportamento: cerca gli indirizzi di Ollama
    /// CABLATI nel resto del backend.
    ///
    /// Perché esiste: `11434` è stato cablato in nove punti, corretto in tre
    /// riprese diverse (10/08, 11/08, 12/08) e ogni volta si era dichiarato
    /// chiuso mentre altri call-site erano ancora lì — la spia risolveva
    /// l'indirizzo, il motore no. Un difetto che ricompare tre volte non si
    /// chiude con l'attenzione: si chiude con qualcosa che lo conta.
    ///
    /// Il gate legge i sorgenti dal disco. Se un giorno la struttura delle
    /// cartelle cambia e i file non si trovano, il test FALLISCE invece di
    /// passare a vuoto: un gate che non trova niente da controllare e dice
    /// «verde» è la trappola di [gate-che-diventano-ciechi].
    #[test]
    fn no_hardcoded_ollama_address_outside_this_module() {
        use std::path::Path;

        // Questo file è l'unico posto legittimo: qui `11434` è il default e i
        // casi di prova. Gli altri sono elencati con la ragione.
        // Un solo file ammesso, di proposito. `ollama_manager.rs` era in questa
        // lista per un messaggio d'errore che diceva «non risponde sulla porta
        // 11434» a chiunque: l'ho corretto perché nominasse l'indirizzo vero,
        // invece di allargare l'eccezione. Un'eccezione in un gate è un posto
        // dove il difetto può tornare a nascondersi.
        const AMMESSI: &[&str] = &["ollama_endpoint.rs"];

        let base = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
        assert!(base.is_dir(), "cartella src non trovata: il gate non ha controllato NULLA");

        let mut colpevoli: Vec<String> = Vec::new();
        let mut file_visti = 0usize;

        fn scandisci(
            dir: &Path,
            ammessi: &[&str],
            colpevoli: &mut Vec<String>,
            file_visti: &mut usize,
        ) {
            let Ok(entries) = std::fs::read_dir(dir) else { return };
            for e in entries.flatten() {
                let p = e.path();
                if p.is_dir() {
                    scandisci(&p, ammessi, colpevoli, file_visti);
                    continue;
                }
                if p.extension().and_then(|x| x.to_str()) != Some("rs") {
                    continue;
                }
                let nome = p.file_name().and_then(|x| x.to_str()).unwrap_or("");
                if ammessi.contains(&nome) {
                    continue;
                }
                let Ok(testo) = std::fs::read_to_string(&p) else { continue };
                *file_visti += 1;
                for (i, riga) in testo.lines().enumerate() {
                    let t = riga.trim_start();
                    // I commenti raccontano la storia del difetto: non sono il difetto.
                    if t.starts_with("//") {
                        continue;
                    }
                    if riga.contains("11434") {
                        colpevoli.push(format!("{}:{}: {}", nome, i + 1, riga.trim()));
                    }
                }
            }
        }

        scandisci(&base, AMMESSI, &mut colpevoli, &mut file_visti);

        // Controllo positivo: se non ho letto nessun file, il verde non vale.
        assert!(
            file_visti > 20,
            "il gate ha letto solo {} file: non sta controllando davvero",
            file_visti
        );

        assert!(
            colpevoli.is_empty(),
            "indirizzo Ollama CABLATO in {} punto/i — deve passare da ollama_base_url():\n{}",
            colpevoli.len(),
            colpevoli.join("\n")
        );
    }
}
