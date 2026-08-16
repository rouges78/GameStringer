//! Protezione dei codici di controllo GameMaker durante la traduzione.
//!
//! ## Perché esiste
//!
//! Il 15/08/2026, dopo la prima run completa su Deltarune (6.116 stringhe), il
//! confronto chiave-per-chiave EN/IT ha trovato **891 stringhe con i codici di
//! controllo alterati** e 179 soft-lock potenziali. Il gioco si è fermato a
//! «LO ACCETTI?» davanti all'utente. La classifica dei codici persi:
//!
//! | codice | persi | significato               |
//! |--------|------:|---------------------------|
//! | `/`    |   473 | attesa input              |
//! | `&`    |   442 | a capo                    |
//! | `^1`   |   383 | pausa                     |
//! | `/%`   |   169 | chiusura dialogo          |
//!
//! La causa è che il fast path GameMaker (`prediction_tool.rs`) manda le
//! stringhe grezze al modello, e il modello **traduce i codici come se fossero
//! parole**: `&` diventa «E», `^1` sparisce, `%` viene riposizionato.
//!
//! ## Perché in Rust e non nel guard TypeScript che esiste già
//!
//! `lib/ai/placeholder-guard.ts` è completo e ben fatto, ma i suoi quattro
//! importatori sono tutti TypeScript: il fast path GameMaker è Rust e non lo
//! raggiunge. Peggio — verificato il 16/08 — anche cablandolo **non
//! proteggerebbe Deltarune**: `PLACEHOLDER_PATTERN` non riconosce `&`, `^6`,
//! `%` finale, e su `\M0` cattura solo `\M` lasciando fuori lo `0`. Cioè
//! proprio i quattro codici più persi. Cablarlo così com'era avrebbe prodotto
//! un guard verde che non protegge niente.
//!
//! ⚠️ Nota per chi mantiene: questo modulo e `placeholder-guard.ts` sono due
//! implementazioni separate per due percorsi separati. Non condividono codice.
//! Chi aggiunge un codice qui valuti se serve anche là.
//!
//! ## La strategia: mascherare, non correggere a posteriori
//!
//! Riparare dopo significa indovinare dove andava un codice. Mascherare prima
//! toglie al modello la possibilità di sbagliare: i codici escono dal testo,
//! il modello traduce solo parole, i codici rientrano al loro posto.
//!
//! ## Il principio nei casi ambigui
//!
//! `&`, `/` e `%` sono anche caratteri normali («Tom & Jerry», «and/or»,
//! «100%»). Qui si preferisce sempre il **falso negativo** al falso positivo:
//! un codice non riconosciuto lascia il difetto che c'è già, un carattere
//! normale scambiato per codice **corrompe testo buono**. Per questo `/` e `%`
//! valgono come codice solo in posizione finale o in coppia `/%`.
//!
//! Fonte della grammatica: `docs/maintenance/2026-07-26-deltarune-analisi.md`,
//! che documenta il formato sul gioco vero:
//! `" ARE YOU^6& THERE^6?\M1 ^6 %"` — `^6` pausa, `&` a capo, `\M1`
//! espressione del volto, `%` fine messaggio.

/// Delimitatori del segnaposto. ASCII di proposito: i modelli piccoli
/// gestiscono male l'unicode raro, e `[[N]]` è la stessa forma che il guard
/// TypeScript già riconosce come label protetta (Unreal `[[T0]]`).
const MASK_OPEN: &str = "[[";
const MASK_CLOSE: &str = "]]";

/// Un codice trovato nel testo, con la posizione in byte in cui iniziava.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GmCode {
    pub code: String,
    pub start: usize,
}

/// Estrae i codici di controllo GameMaker nell'ordine in cui appaiono.
///
/// L'ordine di riconoscimento conta: le forme più lunghe vanno provate prima
/// di quelle che iniziano con lo stesso carattere (`/%` prima di `/` e `%`).
pub fn extract_gm_codes(text: &str) -> Vec<GmCode> {
    let b = text.as_bytes();
    let mut out = Vec::new();
    let mut i = 0usize;

    while i < b.len() {
        let c = b[i];

        // `/%` — chiusura dialogo. Prima di `/` e di `%`, sempre.
        if c == b'/' && i + 1 < b.len() && b[i + 1] == b'%' {
            out.push(GmCode { code: "/%".into(), start: i });
            i += 2;
            continue;
        }

        // `\M0`, `\M1`, `\cY`, `\E2` — barra + lettera + alfanumerico.
        // Il guard TS qui cattura solo `\M` e lascia lo `0` nel testo: è il
        // difetto che rende `\M0` uno dei codici rotti.
        if c == b'\\' && i + 2 < b.len() && b[i + 1].is_ascii_alphabetic() && b[i + 2].is_ascii_alphanumeric() {
            out.push(GmCode { code: text[i..i + 3].to_string(), start: i });
            i += 3;
            continue;
        }

        // `^1`, `^6` — pausa. Il `^` nel testo di gioco non compare mai da solo.
        if c == b'^' && i + 1 < b.len() && b[i + 1].is_ascii_digit() {
            out.push(GmCode { code: text[i..i + 2].to_string(), start: i });
            i += 2;
            continue;
        }

        // `&` — a capo. In GameMaker/Undertale-like il testo scrive «and»,
        // non «&»: il rischio di falso positivo è basso e il codice è il
        // secondo più perso (442 occorrenze).
        if c == b'&' {
            out.push(GmCode { code: "&".into(), start: i });
            i += 1;
            continue;
        }

        // `/` e `%` da soli: codice SOLO se in coda alla stringa (a parte
        // spazi). A metà frase restano testo — «and/or» e «100%» non si
        // toccano. Falso negativo per scelta.
        if (c == b'/' || c == b'%') && is_trailing(b, i + 1) {
            out.push(GmCode { code: (c as char).to_string(), start: i });
            i += 1;
            continue;
        }

        i += 1;
    }
    out
}

/// True se da `from` in poi ci sono solo spazi, codici o fine stringa.
fn is_trailing(b: &[u8], from: usize) -> bool {
    let mut i = from;
    while i < b.len() {
        match b[i] {
            b' ' | b'\t' | b'\r' | b'\n' | b'/' | b'%' | b'&' => i += 1,
            b'^' if i + 1 < b.len() && b[i + 1].is_ascii_digit() => i += 2,
            b'\\' if i + 2 < b.len() && b[i + 1].is_ascii_alphabetic() => i += 3,
            _ => return false,
        }
    }
    true
}

/// Sostituisce i codici con segnaposto opachi `[[0]]`, `[[1]]`, …
///
/// Restituisce il testo mascherato e i codici nell'ordine dei segnaposto.
pub fn mask_gm_codes(text: &str) -> (String, Vec<String>) {
    let codes = extract_gm_codes(text);
    if codes.is_empty() {
        return (text.to_string(), Vec::new());
    }

    let mut masked = String::with_capacity(text.len() + codes.len() * 4);
    let mut last = 0usize;
    let mut list = Vec::with_capacity(codes.len());

    for (n, gc) in codes.iter().enumerate() {
        masked.push_str(&text[last..gc.start]);
        masked.push_str(MASK_OPEN);
        masked.push_str(&n.to_string());
        masked.push_str(MASK_CLOSE);
        last = gc.start + gc.code.len();
        list.push(gc.code.clone());
    }
    masked.push_str(&text[last..]);
    (masked, list)
}

/// Rimette i codici al posto dei segnaposto.
///
/// Tollerante di proposito sulla forma del segnaposto: i modelli piccoli
/// inseriscono spazi (`[[ 0 ]]`) o cambiano le parentesi. Un segnaposto che
/// non si riconosce fa perdere il codice, ed è esattamente il difetto che
/// questo modulo esiste per chiudere — quindi si accetta il più possibile.
pub fn unmask_gm_codes(text: &str, codes: &[String]) -> String {
    if codes.is_empty() {
        return text.to_string();
    }
    let mut out = text.to_string();
    for (n, code) in codes.iter().enumerate() {
        for form in [
            format!("[[{}]]", n),
            format!("[[ {} ]]", n),
            format!("[ [{}] ]", n),
            format!("[[{}] ]", n),
            format!("【{}】", n),
            format!("[{}]", n),
        ] {
            if out.contains(&form) {
                out = out.replace(&form, code);
                break;
            }
        }
    }
    out
}

/// I codici sopravvissuti sono gli stessi dell'originale (stesso multiinsieme)?
///
/// Confronta i codici ORDINATI: la posizione può cambiare legittimamente,
/// perché la sintassi italiana muove le parole. Ciò che non può cambiare è
/// QUALI e QUANTI codici ci sono.
pub fn codes_preserved(source: &str, translation: &str) -> bool {
    let mut a: Vec<String> = extract_gm_codes(source).into_iter().map(|c| c.code).collect();
    let mut b: Vec<String> = extract_gm_codes(translation).into_iter().map(|c| c.code).collect();
    a.sort();
    b.sort();
    a == b
}

#[cfg(test)]
mod tests {
    use super::*;

    /// La stringa vera documentata sul gioco, non una inventata per il test.
    const VERA: &str = " ARE YOU^6& THERE^6?\\M1 ^6 %";

    #[test]
    fn estrae_i_codici_della_stringa_vera() {
        let c: Vec<String> = extract_gm_codes(VERA).into_iter().map(|x| x.code).collect();
        assert_eq!(c, vec!["^6", "&", "^6", "\\M1", "^6", "%"]);
    }

    #[test]
    fn il_giro_completo_non_perde_niente() {
        let (masked, codes) = mask_gm_codes(VERA);
        assert!(!masked.contains('^'), "il modello non deve vedere i codici: {}", masked);
        assert!(!masked.contains('&'));
        assert_eq!(unmask_gm_codes(&masked, &codes), VERA);
    }

    #[test]
    fn il_testo_resta_traducibile_dopo_il_mascheramento() {
        let (masked, _) = mask_gm_codes(VERA);
        assert!(masked.contains("ARE YOU"), "le parole devono restare: {}", masked);
        assert!(masked.contains("THERE"));
    }

    /// Il difetto vero, riprodotto: il modello traduce `&` come «E».
    #[test]
    fn ripara_il_caso_che_ha_rotto_deltarune() {
        let src = "YOU^6& ACCEPT IT?/%";
        let (masked, codes) = mask_gm_codes(src);
        // il modello traduce le parole e conserva i segnaposto
        let tradotto = masked.replace("YOU", "LO").replace("ACCEPT IT?", "ACCETTI?");
        let finale = unmask_gm_codes(&tradotto, &codes);
        assert!(codes_preserved(src, &finale), "codici persi: {}", finale);
        assert!(finale.ends_with("/%"), "chiusura dialogo persa: {}", finale);
    }

    #[test]
    fn tollera_i_segnaposto_sporcati_dal_modello() {
        let (_, codes) = mask_gm_codes("A&B");
        assert_eq!(unmask_gm_codes("A[[ 0 ]]B", &codes), "A&B");
        assert_eq!(unmask_gm_codes("A[0]B", &codes), "A&B");
    }

    // ── I falsi positivi: il testo normale NON si tocca ──────────────────

    #[test]
    fn non_tocca_la_percentuale_dentro_la_frase() {
        assert!(extract_gm_codes("100% COMPLETE").is_empty());
    }

    #[test]
    fn non_tocca_la_barra_dentro_la_frase() {
        assert!(extract_gm_codes("YES/NO CHOICE").is_empty());
    }

    #[test]
    fn il_testo_senza_codici_passa_intatto() {
        let s = "Just a normal sentence.";
        let (m, c) = mask_gm_codes(s);
        assert_eq!(m, s);
        assert!(c.is_empty());
        assert_eq!(unmask_gm_codes(&m, &c), s);
    }

    // ── Controllo positivo: la verifica deve saper dire di NO ────────────

    #[test]
    fn codes_preserved_diventa_falso_quando_un_codice_si_perde() {
        // È la seconda metà del lavoro, quella che si salta: provare che il
        // controllo FALLISCE quando deve.
        assert!(!codes_preserved("YOU^6& ACCEPT?", "LO ACCETTI?"), "un guard che non sa dire di no è cieco");
        assert!(!codes_preserved("A&B", "A E B"), "il caso & → «E» deve essere rilevato");
        assert!(codes_preserved("A&B", "C&D"));
    }

    /// Lo slicing per indice di byte va in panic se cade dentro un carattere
    /// multibyte. Qui è sicuro perché ogni codice riconosciuto è fatto solo di
    /// byte ASCII, quindi i confini sono sempre validi — ma è il genere di cosa
    /// che si scopre in produzione su un gioco giapponese, non a mente.
    #[test]
    fn non_va_in_panic_sul_testo_non_ascii() {
        for s in [
            "こんにちは^6& さようなら%",       // giapponese, il caso di Deltarune
            "Però^6& perché...\\M1 %",           // accenti italiani
            "Привет& мир/%",                     // cirillico
            "絵文字 🎮 と^6 コード&",             // emoji fuori dal BMP
        ] {
            let (m, c) = mask_gm_codes(s);
            assert_eq!(unmask_gm_codes(&m, &c), s, "giro non fedele su: {}", s);
            assert!(codes_preserved(s, &unmask_gm_codes(&m, &c)));
        }
    }

    #[test]
    fn m0_non_perde_la_cifra() {
        // Il guard TS qui cattura solo `\M` e lascia lo `0` nel testo tradotto.
        let c: Vec<String> = extract_gm_codes("HI\\M0 THERE").into_iter().map(|x| x.code).collect();
        assert_eq!(c, vec!["\\M0"]);
    }
}
