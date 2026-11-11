//! Stringhe dentro gli oggetti dei file serializzati Unity (scene comprese).
//!
//! Molti giochi non leggono il testo da un file di localizzazione: lo tengono
//! incorporato negli oggetti delle scene (Lost Host Demo in `level0`, Fran Bow
//! in `resources.assets`; vedi docs/METODI-DI-TRADUZIONE.md). Nei giochi
//! pubblicati quegli oggetti non hanno l'albero dei tipi, quindi i campi non si
//! possono nominare. Si sa però come Unity scrive una stringa: lunghezza in
//! 4 byte, testo UTF-8, riempimento a zero fino al multiplo di 4. E dentro un
//! oggetto non ci sono puntatori ad altre posizioni dell'oggetto: i campi sono
//! in fila. Quindi una stringa si può sostituire con una più lunga o più corta
//! spostando semplicemente quello che segue.
//!
//! La sicurezza sta in una regola: **non si sostituisce una stringa perché
//! «sembra testo», ma solo se è esattamente uguale a un testo che si è chiesto
//! di tradurre.** Trovare candidati è un'euristica; scegliere quali toccare no.

use std::collections::HashMap;

/// Oltre questa lunghezza non è una battuta di gioco.
const MAX_STRING: usize = 64 * 1024;

/// Una stringa trovata nel corpo di un oggetto.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundString {
    /// Posizione del campo lunghezza, dall'inizio del corpo.
    pub offset: usize,
    /// Byte occupati in tutto: lunghezza + testo + riempimento.
    pub span: usize,
    pub text: String,
}

fn align4(n: usize) -> usize {
    (n + 3) & !3
}

/// Il testo a `offset` è una stringa Unity plausibile? Restituisce testo e
/// byte occupati.
fn string_at(body: &[u8], offset: usize) -> Option<(&str, usize)> {
    let len = u32::from_le_bytes(body.get(offset..offset + 4)?.try_into().ok()?) as usize;
    if len == 0 || len > MAX_STRING {
        return None;
    }
    let end = offset + 4 + len;
    let padded = offset + 4 + align4(len);
    if padded > body.len() {
        return None;
    }
    // il riempimento dopo il testo è sempre a zero
    if body[end..padded].iter().any(|&b| b != 0) {
        return None;
    }
    let text = std::str::from_utf8(&body[offset + 4..end]).ok()?;
    // niente caratteri di controllo tranne a capo e tabulazione
    if text.chars().any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t')) {
        return None;
    }
    Some((text, 4 + align4(len)))
}

/// Tutte le stringhe plausibili nel corpo di un oggetto, in ordine. I campi
/// sono allineati a 4, quindi si guarda solo a quelle posizioni; una stringa
/// trovata si salta per intero, così il suo testo non genera altri candidati.
pub fn find_strings(body: &[u8]) -> Vec<FoundString> {
    let mut found = Vec::new();
    let mut offset = 0;
    while offset + 4 <= body.len() {
        match string_at(body, offset) {
            Some((text, span)) => {
                found.push(FoundString { offset, span, text: text.to_string() });
                offset += span;
            }
            None => offset += 4,
        }
    }
    found
}

/// Sostituisce nel corpo di un oggetto le stringhe ESATTAMENTE uguali a una
/// chiave di `translations`. Restituisce il corpo nuovo e quante ne ha
/// sostituite; `None` se non c'era nulla da cambiare.
pub fn replace_strings(body: &[u8], translations: &HashMap<String, String>) -> Option<(Vec<u8>, usize)> {
    let mut out = Vec::with_capacity(body.len());
    let (mut copied, mut replaced) = (0usize, 0usize);
    for found in find_strings(body) {
        let Some(new_text) = translations.get(&found.text) else { continue };
        if new_text == &found.text || new_text.is_empty() || new_text.len() > MAX_STRING {
            continue;
        }
        out.extend_from_slice(&body[copied..found.offset]);
        out.extend_from_slice(&(new_text.len() as u32).to_le_bytes());
        out.extend_from_slice(new_text.as_bytes());
        out.resize(align4(out.len()), 0);
        copied = found.offset + found.span;
        replaced += 1;
    }
    if replaced == 0 {
        return None;
    }
    out.extend_from_slice(&body[copied..]);
    Some((out, replaced))
}

/// Costruisce la mappa «testo da sostituire → testo nuovo» da due tabelle
/// `chiave → testo` (lingua che c'è nel gioco, lingua voluta).
///
/// Regola di sicurezza: **un testo che è anche una chiave non si traduce
/// mai.** Le tabelle incorporate nelle scene tengono chiavi e testi come
/// stringhe una accanto all'altra (misurato su Lost Host Demo): se in una
/// lingua «OK» si dice «OK», sostituire quel testo cambierebbe anche la chiave
/// «OK» e il gioco non troverebbe più la voce.
pub fn translation_map(from: &HashMap<String, String>, to: &HashMap<String, String>) -> HashMap<String, String> {
    let mut map: HashMap<String, String> = HashMap::new();
    let mut ambiguous: Vec<String> = Vec::new();
    for (key, old_text) in from {
        let Some(new_text) = to.get(key) else { continue };
        if old_text.is_empty() || new_text.is_empty() || old_text == new_text || from.contains_key(old_text) {
            continue;
        }
        // lo stesso testo vecchio con due traduzioni diverse: non si può
        // sapere quale voce si sta guardando, quindi non si tocca
        match map.get(old_text) {
            Some(existing) if existing != new_text => ambiguous.push(old_text.clone()),
            _ => {
                map.insert(old_text.clone(), new_text.clone());
            }
        }
    }
    for text in ambiguous {
        map.remove(&text);
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Scrive una stringa come fa Unity.
    fn unity_string(text: &str) -> Vec<u8> {
        let mut out = (text.len() as u32).to_le_bytes().to_vec();
        out.extend_from_slice(text.as_bytes());
        out.resize(align4(out.len()), 0);
        out
    }

    /// Un oggetto finto: campi numerici, un elenco di stringhe, altri numeri.
    fn object(texts: &[&str]) -> Vec<u8> {
        let mut body = Vec::new();
        body.extend(7i32.to_le_bytes());
        body.extend(1.5f32.to_le_bytes());
        body.extend((texts.len() as u32).to_le_bytes()); // numero di elementi
        for t in texts {
            body.extend(unity_string(t));
        }
        body.extend(0xdead_beefu32.to_le_bytes());
        body.extend(42i32.to_le_bytes());
        body
    }

    fn map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect()
    }

    fn texts(body: &[u8]) -> Vec<String> {
        find_strings(body).into_iter().map(|f| f.text).collect()
    }

    #[test]
    fn finds_the_strings_of_an_object_in_order() {
        let body = object(&["Play", "Settings", "Žaisti", "設定"]);
        assert_eq!(texts(&body), ["Play", "Settings", "Žaisti", "設定"]);
    }

    #[test]
    fn numbers_and_binary_are_not_strings() {
        let mut body = Vec::new();
        for n in [0u32, 1, 7, 300, 0xffff_ffff, 0x3f80_0000] {
            body.extend(n.to_le_bytes());
        }
        // lunghezza 3 seguita da byte che non sono UTF-8
        body.extend(3u32.to_le_bytes());
        body.extend([0xff, 0xfe, 0x80, 0x00]);
        // lunghezza 2 con riempimento non a zero: non è una stringa Unity
        body.extend(2u32.to_le_bytes());
        body.extend([b'o', b'k', 0x01, 0x00]);
        assert_eq!(find_strings(&body), []);
    }

    #[test]
    fn replaces_only_exact_matches() {
        let body = object(&["Play", "Play now", "Settings"]);
        let (out, replaced) = replace_strings(&body, &map(&[("Play", "Gioca")])).unwrap();
        assert_eq!(replaced, 1);
        // «Play now» contiene «Play» ma non è uguale: non si tocca
        assert_eq!(texts(&out), ["Gioca", "Play now", "Settings"]);
    }

    #[test]
    fn longer_and_shorter_translations_keep_everything_else_in_place() {
        let body = object(&["Yes", "Settings", "No"]);
        let (out, replaced) = replace_strings(&body, &map(&[("Yes", "Sì, certamente"), ("Settings", "Op"), ("No", "No")])).unwrap();
        assert_eq!(replaced, 2, "una traduzione uguale all'originale non conta");
        assert_eq!(texts(&out), ["Sì, certamente", "Op", "No"]);
        assert_eq!(out.len() % 4, 0);
        // i campi prima e dopo le stringhe sono gli stessi byte
        assert_eq!(out[..12], body[..12]);
        assert_eq!(out[out.len() - 8..], body[body.len() - 8..]);
    }

    #[test]
    fn every_occurrence_of_a_text_is_replaced() {
        let body = object(&["Exit", "Play", "Exit"]);
        let (out, replaced) = replace_strings(&body, &map(&[("Exit", "Esci")])).unwrap();
        assert_eq!(replaced, 2);
        assert_eq!(texts(&out), ["Esci", "Play", "Esci"]);
    }

    #[test]
    fn the_map_pairs_texts_by_key() {
        let from = map(&[("Play", "Žaisti"), ("Exit", "Išeiti"), ("OnlyHere", "x")]);
        let to = map(&[("Play", "Gioca"), ("Exit", "Esci"), ("OnlyThere", "y")]);
        assert_eq!(translation_map(&from, &to), map(&[("Žaisti", "Gioca"), ("Išeiti", "Esci")]));
    }

    #[test]
    fn a_text_that_is_also_a_key_is_never_translated() {
        // in lituano «OK» resta «OK», ed è anche una chiave della tabella
        let from = map(&[("OK", "OK"), ("Confirm", "OK"), ("Audio", "Garsas")]);
        let to = map(&[("OK", "Va bene"), ("Confirm", "Conferma"), ("Audio", "Audio")]);
        let m = translation_map(&from, &to);
        assert_eq!(m, map(&[("Garsas", "Audio")]));

        // e con quella mappa la chiave «OK» nell'oggetto resta intatta
        let body = object(&["OK", "OK", "Audio", "Garsas"]);
        let (out, _) = replace_strings(&body, &m).unwrap();
        assert_eq!(texts(&out), ["OK", "OK", "Audio", "Audio"]);
    }

    #[test]
    fn one_text_with_two_different_translations_is_left_alone() {
        // «Atgal» vale sia «Back» sia «Return», che in italiano sono diversi
        let from = map(&[("Back", "Atgal"), ("Return", "Atgal"), ("Play", "Žaisti")]);
        let to = map(&[("Back", "Indietro"), ("Return", "Ritorna"), ("Play", "Gioca")]);
        assert_eq!(translation_map(&from, &to), map(&[("Žaisti", "Gioca")]));
        // due chiavi con lo stesso testo e la stessa traduzione vanno bene
        let to_same = map(&[("Back", "Indietro"), ("Return", "Indietro"), ("Play", "Gioca")]);
        assert_eq!(translation_map(&from, &to_same).get("Atgal").map(String::as_str), Some("Indietro"));
    }

    #[test]
    fn nothing_to_translate_returns_none() {
        let body = object(&["Play"]);
        assert!(replace_strings(&body, &map(&[("Quit", "Esci")])).is_none());
        assert!(replace_strings(&body, &map(&[("Play", "")])).is_none());
        assert!(replace_strings(&[], &map(&[("Play", "Gioca")])).is_none());
    }

    #[test]
    fn a_truncated_string_at_the_end_is_ignored() {
        let mut body = object(&["Play"]);
        body.extend(40u32.to_le_bytes()); // dichiara 40 byte ma il corpo finisce
        body.extend(b"corto");
        assert_eq!(texts(&body), ["Play"]);
    }
}

/// Misura su un gioco VERO, in sola lettura: in quali oggetti di un file
/// interno compare un testo, e quali stringhe gli stanno intorno.
///
/// ```bash
/// cd src-tauri && GS_UNITY_BUNDLE="E:/…/data.unity3d" GS_UNITY_NODE="level0" GS_UNITY_GREP="Nustatymai" \
///   cargo test --bin gamestringer -- commands::unity_strings::real_scene_strings::real_scene_strings --ignored --nocapture --exact
/// ```
#[cfg(test)]
mod real_scene_strings {
    use super::*;
    use crate::commands::unity_fs::{Bundle, ReadAt};
    use crate::commands::unity_serialized::list_objects;

    #[test]
    #[ignore]
    fn real_scene_strings() {
        let var = |name: &str| std::env::var(name).unwrap_or_else(|_| panic!("{name} non impostata"));
        let (path, node_path, needle) = (var("GS_UNITY_BUNDLE"), var("GS_UNITY_NODE"), var("GS_UNITY_GREP"));
        let mut bundle = Bundle::open(std::path::Path::new(&path)).unwrap();
        let index = bundle.nodes.iter().position(|n| n.path == node_path).expect("file interno non trovato");
        let size = bundle.nodes[index].size as usize;
        let data = bundle.node(index).read_at(0, size).unwrap();
        let objects = list_objects(&data).unwrap();
        println!("{node_path} | {} oggetti | {} KB", objects.len(), size / 1024);

        for obj in &objects {
            let body = &data[obj.start..obj.start + obj.size];
            let strings = find_strings(body);
            let hits: Vec<usize> = strings.iter().enumerate().filter(|(_, s)| s.text.contains(&needle)).map(|(i, _)| i).collect();
            if hits.is_empty() {
                continue;
            }
            println!("oggetto path_id={} class_id={} | {} byte | {} stringhe | {} con il testo cercato", obj.path_id, obj.class_id, obj.size, strings.len(), hits.len());
            let first = hits[0];
            for (i, s) in strings.iter().enumerate().skip(first.saturating_sub(18)).take(40) {
                let short: String = s.text.chars().take(48).map(|c| if c.is_control() { ' ' } else { c }).collect();
                println!("    {}{i:>5} | @{} | {short}", if hits.contains(&i) { ">" } else { " " }, s.offset);
            }
        }
    }
}

/// Traduzione di una scena VERA, tutta in memoria: non scrive nulla. Prende
/// due TextAsset `chiave,testo` (lingua incorporata, lingua voluta), sostituisce
/// i testi negli oggetti di un file interno e controlla il risultato.
///
/// ```bash
/// cd src-tauri && GS_UNITY_BUNDLE="E:/…/data.unity3d" GS_UNITY_NODE="level0" GS_UNITY_TABLES="sharedassets0.assets" \
///   GS_UNITY_FROM="LOST_HOST - Lithuanian" GS_UNITY_TO="LOST_HOST - Italian" \
///   cargo test --bin gamestringer -- commands::unity_strings::real_scene_translate::real_scene_translate --ignored --nocapture --exact
/// ```
#[cfg(test)]
mod real_scene_translate {
    use super::*;
    use crate::commands::unity_fs::{Bundle, ReadAt};
    use crate::commands::unity_loc_tables::split_row;
    use crate::commands::unity_serialized::{extract_text_assets, list_objects, rewrite_objects};

    pub(super) fn node_bytes(bundle: &mut Bundle, path: &str) -> Vec<u8> {
        let index = bundle.nodes.iter().position(|n| n.path == path).unwrap_or_else(|| panic!("{path} non è nel bundle"));
        let size = bundle.nodes[index].size as usize;
        bundle.node(index).read_at(0, size).unwrap()
    }

    /// `chiave,testo` per riga → mappa.
    pub(super) fn table(content: &str) -> HashMap<String, String> {
        content
            .lines()
            .filter_map(|line| {
                let cells = split_row(line.trim_end_matches('\r'), ',');
                (cells.len() >= 2).then(|| (cells[0].clone(), cells[1].clone()))
            })
            .collect()
    }

    #[test]
    #[ignore]
    fn real_scene_translate() {
        let var = |name: &str| std::env::var(name).unwrap_or_else(|_| panic!("{name} non impostata"));
        let mut bundle = Bundle::open(std::path::Path::new(&var("GS_UNITY_BUNDLE"))).unwrap();
        let assets = extract_text_assets(&node_bytes(&mut bundle, &var("GS_UNITY_TABLES"))).unwrap();
        let asset = |name: &str| table(&assets.iter().find(|a| a.name == name).unwrap_or_else(|| panic!("{name} non trovato")).content);
        let (from, to) = (asset(&var("GS_UNITY_FROM")), asset(&var("GS_UNITY_TO")));
        let map = translation_map(&from, &to);
        println!("tabelle | da {} voci | a {} voci | coppie traducibili {}", from.len(), to.len(), map.len());

        let data = node_bytes(&mut bundle, &var("GS_UNITY_NODE"));
        let objects = list_objects(&data).unwrap();
        let mut bodies = HashMap::new();
        let mut replaced_total = 0;
        for obj in &objects {
            if let Some((body, replaced)) = replace_strings(&data[obj.start..obj.start + obj.size], &map) {
                println!("    oggetto path_id={} class_id={} | {} → {} byte | {replaced} stringhe sostituite", obj.path_id, obj.class_id, obj.size, body.len());
                replaced_total += replaced;
                bodies.insert(obj.path_id, body);
            }
        }
        let out = rewrite_objects(&data, &bodies).unwrap();
        let after = list_objects(&out).unwrap();
        println!("scena | {} oggetti | {} toccati | {replaced_total} stringhe sostituite | {} → {} byte", objects.len(), bodies.len(), data.len(), out.len());

        // controlli
        assert_eq!(after.len(), objects.len());
        let untouched_same = objects.iter().zip(&after).filter(|(o, _)| !bodies.contains_key(&o.path_id)).all(|(o, a)| data[o.start..o.start + o.size] == out[a.start..a.start + a.size]);
        // Controllo esatto, stringa per stringa: l'ordine e il numero non
        // cambiano, quindi la i-esima stringa di prima corrisponde alla i-esima
        // di dopo. Deve essere il testo nuovo se era in mappa, identica
        // altrimenti (chiavi comprese).
        let (mut translated, mut kept, mut wrong) = (0usize, 0usize, Vec::new());
        for (o, a) in objects.iter().zip(&after) {
            let before = find_strings(&data[o.start..o.start + o.size]);
            let now = find_strings(&out[a.start..a.start + a.size]);
            if before.len() != now.len() {
                wrong.push(format!("path_id {}: {} stringhe prima, {} dopo", o.path_id, before.len(), now.len()));
                continue;
            }
            for (b, n) in before.iter().zip(&now) {
                match map.get(&b.text) {
                    Some(expected) if &n.text == expected => translated += 1,
                    None if n.text == b.text => kept += 1,
                    _ => wrong.push(format!("path_id {}: {:?} → {:?}", o.path_id, b.text, n.text)),
                }
            }
        }
        println!("controlli | oggetti non toccati identici: {untouched_same} | stringhe tradotte {translated} | invariate {kept} | sbagliate {}", wrong.len());
        for w in wrong.iter().take(10) {
            println!("    SBAGLIATA {w}");
        }
        assert!(wrong.is_empty());
        assert_eq!(translated, replaced_total);
        assert!(untouched_same);
    }
}
