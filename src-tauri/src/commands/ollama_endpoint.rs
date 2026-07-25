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
}
