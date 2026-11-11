//! Traduzione statica di un gioco Unity che tiene i testi incorporati nelle
//! scene: il metodo `unity-loc-tables` di String it.
//!
//! Mette insieme i motori di `unity_fs`, `unity_serialized`, `unity_strings` e
//! `unity_loc_tables`. Vale per i giochi fatti come Lost Host Demo (misurato e
//! provato in gioco l'11/11/2026, vedi docs/METODI-DI-TRADUZIONE.md):
//!
//! - la localizzazione è una famiglia di TextAsset `chiave,testo`, uno per
//!   lingua;
//! - i testi di quelle lingue sono ANCHE incorporati negli script delle scene,
//!   ed è da lì che il gioco li mostra (su Lost Host Demo tutte e 14).
//!
//! Per dare al gioco una lingua che non ha, si sostituiscono nelle scene i
//! testi di UNA lingua esistente con quelli nuovi, appaiandoli per chiave. In
//! gioco si sceglie poi quella lingua: il nome nel menu resta quello vecchio.
//! La lingua da sacrificare si sceglie con lo stesso alfabeto di quella
//! voluta (il gioco le ha già assegnato un font con quelle lettere), mai
//! l'inglese, e fra le possibili la meno diffusa.
//!
//! Se il gioco non è fatto così `probe` risponde con un errore che dice
//! perché, e String it passa al metodo successivo del piano.
//!
//! LIMITI: solo giochi con `data.unity3d` (i file `.assets` sciolti non sono
//! ancora scritti da qui); solo tabelle CSV/TSV a due colonne.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use super::unity_fs::{backup_path, original_bundle, replace_nodes_in_place, restore_original, Bundle, ReadAt, RewriteStats};
use super::unity_loc_tables::{data_dir, name_language, split_row};
use super::unity_serialized::{extract_text_assets, list_objects, rewrite_objects};
use super::unity_strings::{find_strings, replace_strings, translation_map};

/// MonoBehaviour: gli script del gioco, dove stanno i testi incorporati.
const CLASS_ID_MONO_BEHAVIOUR: i32 = 114;
/// Sotto questo numero di testi ritrovati nelle scene non si parla di lingua
/// incorporata: sarebbero coincidenze.
const MIN_BAKED_TEXTS: usize = 5;

/// Una voce da tradurre o tradotta: chiave della tabella e testo.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Entry {
    pub key: String,
    pub text: String,
}

/// La tabella di una lingua.
#[derive(Debug, Clone)]
struct LangTable {
    code: &'static str,
    /// Nome come lo scrive il gioco ("Lithuanian").
    name: String,
    entries: Vec<(String, String)>,
}

/// Cosa String it può fare su questo gioco.
#[derive(Debug, Clone, Serialize)]
pub struct StaticProbe {
    /// Nome comune dei file lingua ("LOST_HOST").
    pub family: String,
    /// Lingue che il gioco ha già, come codici.
    pub languages: Vec<String>,
    /// Lingue i cui testi sono incorporati nelle scene.
    pub baked_languages: Vec<String>,
    /// La lingua che verrà sostituita, e come la chiama il gioco.
    pub replace_language: String,
    pub replace_language_name: String,
    /// Quanti suoi testi sono stati ritrovati negli script delle scene.
    pub baked_texts_found: usize,
    /// Lingua dei testi in `entries`: l'inglese se c'è, altrimenti quella sostituita.
    pub source_language: String,
    /// I testi da tradurre.
    pub entries: Vec<Entry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApplyReport {
    pub strings_replaced: usize,
    /// Voci della tabella effettivamente tradotte.
    pub entries_translated: usize,
    /// Voci lasciate com'erano per le regole di sicurezza o perché senza traduzione.
    pub entries_skipped: usize,
    pub files_changed: Vec<String>,
    /// La lingua da scegliere in gioco per vedere la traduzione.
    pub select_language: String,
    pub backup_path: String,
    pub stats: RewriteStats,
}

fn bundle_path(game_dir: &Path) -> Result<PathBuf, String> {
    let data = data_dir(game_dir).ok_or("cartella _Data non trovata: non è un gioco Unity")?;
    let path = data.join("data.unity3d");
    if !original_bundle(&path).exists() {
        return Err("il gioco non ha data.unity3d: i file .assets sciolti non sono ancora supportati da questo metodo".to_string());
    }
    Ok(path)
}

/// I file interni che possono contenere oggetti: non texture, audio o luce.
fn serialized_nodes(bundle: &Bundle) -> Vec<usize> {
    (0..bundle.nodes.len())
        .filter(|&i| {
            let path = &bundle.nodes[i].path;
            !(path.ends_with(".resS") || path.ends_with(".resource") || path.starts_with("GI/"))
        })
        .collect()
}

fn node_bytes(bundle: &mut Bundle, index: usize) -> Result<Vec<u8>, String> {
    let size = bundle.nodes[index].size as usize;
    bundle.node(index).read_at(0, size)
}

/// `chiave,testo` per riga. Il separatore è la tabulazione se la prima riga ne
/// contiene una, altrimenti la virgola.
fn parse_table(content: &str) -> Vec<(String, String)> {
    let content = content.trim_start_matches('\u{feff}');
    let delimiter = if content.lines().next().is_some_and(|l| l.contains('\t')) { '\t' } else { ',' };
    content
        .lines()
        .filter_map(|line| {
            let cells = split_row(line.trim_end_matches('\r'), delimiter);
            (cells.len() >= 2 && !cells[0].is_empty()).then(|| (cells[0].clone(), cells[1].clone()))
        })
        .collect()
}

/// La famiglia di file lingua più ricca del gioco: nome e tabelle.
fn load_family(bundle: &mut Bundle) -> Result<(String, Vec<LangTable>), String> {
    let mut families: HashMap<String, Vec<LangTable>> = HashMap::new();
    for index in serialized_nodes(bundle) {
        let Ok(data) = node_bytes(bundle, index) else { continue };
        let Ok(assets) = extract_text_assets(&data) else { continue };
        for asset in assets {
            let Some((stem, code)) = name_language(&asset.name) else { continue };
            let entries = parse_table(&asset.content);
            if entries.is_empty() {
                continue;
            }
            let name = asset.name[stem.len()..].trim_start_matches(|c: char| !c.is_alphanumeric()).to_string();
            let tables = families.entry(stem).or_default();
            if !tables.iter().any(|t| t.code == code) {
                tables.push(LangTable { code, name, entries });
            }
        }
    }
    families
        .into_iter()
        .filter(|(_, tables)| tables.len() >= 2)
        .max_by_key(|(_, tables)| tables.len())
        .ok_or_else(|| "nessuna famiglia di file lingua trovata nel gioco".to_string())
}

/// Tutte le stringhe dentro gli script delle scene.
fn scene_strings(bundle: &mut Bundle) -> HashSet<String> {
    let mut found = HashSet::new();
    for index in serialized_nodes(bundle) {
        let Ok(data) = node_bytes(bundle, index) else { continue };
        let Ok(objects) = list_objects(&data) else { continue };
        for obj in objects.iter().filter(|o| o.class_id == CLASS_ID_MONO_BEHAVIOUR) {
            found.extend(find_strings(&data[obj.start..obj.start + obj.size]).into_iter().map(|s| s.text));
        }
    }
    found
}

/// Alfabeto di una lingua. Due lingue con lo stesso alfabeto possono usare lo
/// stesso font del gioco.
fn script(code: &str) -> &'static str {
    match code {
        "ru" | "uk" => "cirillico",
        "ja" => "giapponese",
        "zh" => "cinese",
        "ko" => "coreano",
        "ar" => "arabo",
        "el" => "greco",
        "th" => "thai",
        _ => "latino",
    }
}

/// Quanto è diffusa una lingua fra i giocatori: più è alto, più conviene
/// tenerla. Le non elencate valgono zero e si sacrificano per prime.
fn popularity(code: &str) -> usize {
    ["lt", "hu", "cs", "sv", "nl", "vi", "tr", "uk", "pl", "it", "pt", "ru", "de", "fr", "es", "zh", "ja", "ko"]
        .iter()
        .position(|c| *c == code)
        .map(|p| p + 1)
        .unwrap_or(0)
}

/// Le lingue incorporate nelle scene, con quanti testi ritrovati.
///
/// Si contano solo i testi che non sono anche chiavi: le chiavi sono nelle
/// scene per forza, e in molti giochi coincidono con l'inglese. Una lingua è
/// incorporata se almeno un terzo dei suoi testi sta nelle scene.
fn baked_languages<'a>(tables: &'a [LangTable], strings: &HashSet<String>) -> Vec<(&'a LangTable, usize)> {
    language_scores(tables, strings)
        .into_iter()
        .filter(|(_, found, total)| *found >= MIN_BAKED_TEXTS && found * 3 >= *total)
        .map(|(table, found, _)| (table, found))
        .collect()
}

/// Quale lingua sostituire per ottenere `target`.
///
/// `wanted` è la scelta esplicita dell'utente, se c'è. Altrimenti: stessa
/// scrittura di `target`, mai l'inglese, la meno diffusa.
fn choose_replaced<'a>(baked: &[(&'a LangTable, usize)], target: &str, wanted: Option<&str>) -> Result<(&'a LangTable, usize), String> {
    if let Some(code) = wanted {
        return baked
            .iter()
            .find(|(t, _)| t.code == code)
            .copied()
            .ok_or_else(|| format!("la lingua «{code}» non è fra quelle incorporate nelle scene"));
    }
    baked
        .iter()
        .filter(|(t, _)| t.code != "en" && t.code != target && script(t.code) == script(target))
        .min_by_key(|(t, _)| popularity(t.code))
        .copied()
        .ok_or_else(|| format!("nessuna lingua del gioco usa lo stesso alfabeto ({}) della lingua voluta: sostituirne una mostrerebbe caratteri mancanti", script(target)))
}

/// Per ogni lingua: quanti suoi testi (non chiavi) sono nelle scene, su quanti.
/// Ordinate dalla più presente.
fn language_scores<'a>(tables: &'a [LangTable], strings: &HashSet<String>) -> Vec<(&'a LangTable, usize, usize)> {
    let keys: HashSet<&str> = tables.iter().flat_map(|t| t.entries.iter().map(|(k, _)| k.as_str())).collect();
    let mut scores: Vec<(&LangTable, usize, usize)> = tables
        .iter()
        .map(|table| {
            let texts: HashSet<&str> = table.entries.iter().map(|(_, t)| t.as_str()).filter(|t| !t.is_empty() && !keys.contains(t)).collect();
            let found = texts.iter().filter(|t| strings.contains(**t)).count();
            (table, found, texts.len())
        })
        .collect();
    scores.sort_by_key(|(_, found, _)| std::cmp::Reverse(*found));
    scores
}

/// Tutto ciò che serve sia a `probe` sia ad `apply`, letto dall'ORIGINALE.
struct Loaded {
    family: String,
    tables: Vec<LangTable>,
    baked: Vec<String>,
    /// Indice in `tables` della lingua da sostituire.
    replaced: usize,
    baked_texts_found: usize,
}

fn load(bundle: &mut Bundle, target: &str, wanted: Option<&str>) -> Result<Loaded, String> {
    let (family, tables) = load_family(bundle)?;
    if tables.iter().any(|t| t.code == target) {
        return Err(format!("il gioco ha già la lingua «{target}»"));
    }
    let strings = scene_strings(bundle);
    let baked = baked_languages(&tables, &strings);
    if baked.is_empty() {
        return Err("nessuna lingua del gioco risulta incorporata nelle scene: il gioco legge i testi dai file lingua".to_string());
    }
    let (replaced_table, baked_texts_found) = choose_replaced(&baked, target, wanted)?;
    let replaced = tables.iter().position(|t| t.code == replaced_table.code).unwrap();
    let baked = baked.iter().map(|(t, _)| t.code.to_string()).collect();
    Ok(Loaded { family, tables, baked, replaced, baked_texts_found })
}

/// Il metodo si applica a questo gioco per la lingua `target`? Se sì, cosa
/// c'è da tradurre e quale lingua verrebbe sostituita (`replace` la impone).
pub fn probe(game_dir: &Path, target: &str, replace: Option<&str>) -> Result<StaticProbe, String> {
    let path = bundle_path(game_dir)?;
    let mut bundle = Bundle::open(&original_bundle(&path))?;
    let loaded = load(&mut bundle, target, replace)?;
    let replaced = &loaded.tables[loaded.replaced];
    let source = loaded.tables.iter().find(|t| t.code == "en").unwrap_or(replaced);
    Ok(StaticProbe {
        family: loaded.family.clone(),
        languages: loaded.tables.iter().map(|t| t.code.to_string()).collect(),
        baked_languages: loaded.baked.clone(),
        replace_language: replaced.code.to_string(),
        replace_language_name: replaced.name.clone(),
        baked_texts_found: loaded.baked_texts_found,
        source_language: source.code.to_string(),
        entries: source.entries.iter().map(|(key, text)| Entry { key: key.clone(), text: text.clone() }).collect(),
    })
}

/// Scrive nel gioco i testi nuovi in `target` (chiave → testo) al posto di
/// quelli di una lingua esistente (`replace` la impone, altrimenti si sceglie
/// come in `probe`). L'originale resta come backup; applicare di nuovo riparte
/// dall'originale.
pub fn apply(game_dir: &Path, target: &str, replace: Option<&str>, translations: &HashMap<String, String>) -> Result<ApplyReport, String> {
    let path = bundle_path(game_dir)?;
    let mut report: Option<(usize, usize, usize, Vec<String>, String)> = None;

    let stats = replace_nodes_in_place(&path, |bundle| {
        let loaded = load(bundle, target, replace)?;
        let baked = &loaded.tables[loaded.replaced];
        let from: HashMap<String, String> = baked.entries.iter().cloned().collect();
        let map = translation_map(&from, translations);
        if map.is_empty() {
            return Err("nessuna voce traducibile: le traduzioni non corrispondono alle chiavi del gioco".to_string());
        }

        let mut replacements = Vec::new();
        let (mut replaced_total, mut files_changed) = (0usize, Vec::new());
        for index in serialized_nodes(bundle) {
            let data = node_bytes(bundle, index)?;
            let Ok(objects) = list_objects(&data) else { continue };
            let mut bodies = HashMap::new();
            for obj in objects.iter().filter(|o| o.class_id == CLASS_ID_MONO_BEHAVIOUR) {
                if let Some((body, replaced)) = replace_strings(&data[obj.start..obj.start + obj.size], &map) {
                    replaced_total += replaced;
                    bodies.insert(obj.path_id, body);
                }
            }
            if !bodies.is_empty() {
                files_changed.push(bundle.nodes[index].path.clone());
                replacements.push((index, rewrite_objects(&data, &bodies)?));
            }
        }
        if replacements.is_empty() {
            return Err("nessuna stringa da sostituire trovata nelle scene".to_string());
        }
        report = Some((replaced_total, map.len(), from.len().saturating_sub(map.len()), files_changed, baked.name.clone()));
        Ok(replacements)
    })?;

    let (strings_replaced, entries_translated, entries_skipped, files_changed, select_language) = report.ok_or("riscrittura senza esito")?;
    Ok(ApplyReport {
        strings_replaced,
        entries_translated,
        entries_skipped,
        files_changed,
        select_language,
        backup_path: backup_path(&path).to_string_lossy().to_string(),
        stats,
    })
}

/// Rimette il gioco com'era. `false` se non c'era nulla da ripristinare.
pub fn restore(game_dir: &Path) -> Result<bool, String> {
    restore_original(&bundle_path(game_dir)?)
}

/// Il metodo statico si applica a questo gioco Unity per `target_lang`?
/// Restituisce i testi da tradurre, oppure un errore che dice perché no.
#[tauri::command(rename_all = "camelCase")]
pub async fn unity_static_probe(game_path: String, target_lang: String, replace_language: Option<String>) -> Result<StaticProbe, String> {
    tauri::async_runtime::spawn_blocking(move || probe(Path::new(&game_path), &target_lang, replace_language.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

/// Scrive nel gioco le traduzioni (chiave → testo), con backup dell'originale.
#[tauri::command(rename_all = "camelCase")]
pub async fn unity_static_apply(
    game_path: String,
    target_lang: String,
    replace_language: Option<String>,
    translations: Vec<Entry>,
) -> Result<ApplyReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let map: HashMap<String, String> = translations.into_iter().map(|e| (e.key, e.text)).collect();
        apply(Path::new(&game_path), &target_lang, replace_language.as_deref(), &map)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Rimette l'originale al posto del bundle tradotto.
#[tauri::command(rename_all = "camelCase")]
pub async fn unity_static_restore(game_path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || restore(Path::new(&game_path)))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::unity_fs::tests::build_bundle;
    use crate::commands::unity_serialized::tests::{build_serialized, text_asset_body};

    const KEYS: [&str; 8] = ["Play", "Exit", "Settings", "Credits", "Yes", "No", "Language", "OK"];
    const LT: [&str; 8] = ["Žaisti", "Išeiti", "Nustatymai", "Kūrėjai", "Taip", "Ne", "Kalba", "OK"];
    const FR: [&str; 8] = ["Jouer", "Quitter", "Paramètres", "Crédits", "Oui", "Non", "Langue", "OK"];
    const RU: [&str; 8] = ["Играть", "Выход", "Настройки", "Титры", "Да", "Нет", "Язык", "OK"];

    fn csv(texts: &[&str]) -> String {
        KEYS.iter().zip(texts).map(|(k, t)| format!("{k},{t}\n")).collect()
    }

    fn unity_string(text: &str) -> Vec<u8> {
        let mut out = (text.len() as u32).to_le_bytes().to_vec();
        out.extend_from_slice(text.as_bytes());
        out.resize((out.len() + 3) & !3, 0);
        out
    }

    /// Uno script di scena con la tabella incorporata: chiave, testo, chiave, testo…
    fn baked_object(texts: &[&str]) -> Vec<u8> {
        let mut body = 7i32.to_le_bytes().to_vec();
        body.extend((KEYS.len() as u32 * 2).to_le_bytes());
        for (key, text) in KEYS.iter().zip(texts) {
            body.extend(unity_string(key));
            body.extend(unity_string(text));
        }
        body.extend(42i32.to_le_bytes());
        body
    }

    /// Un gioco finto: file lingua in sharedassets0, e in level0 uno script
    /// con la tabella incorporata per ognuna delle lingue in `baked`.
    fn game(baked: &[&[&str]]) -> tempfile::TempDir {
        let tables = build_serialized(
            22,
            "6000.3.8f1",
            &[
                (49, text_asset_body("GAME - English", &csv(&KEYS))),
                (49, text_asset_body("GAME - Lithuanian", &csv(&LT))),
                (49, text_asset_body("GAME - French", &csv(&FR))),
                (49, text_asset_body("GAME - Russian", &csv(&RU))),
                (49, text_asset_body("version", "1.0")),
            ],
        );
        let mut scene_objects = vec![(1, vec![1, 2, 3, 4])];
        for texts in baked {
            scene_objects.push((114, baked_object(texts)));
        }
        let scene = build_serialized(22, "6000.3.8f1", &scene_objects);
        let bundle = build_bundle(
            &[("sharedassets0.assets", tables), ("level0", scene), ("sharedassets0.assets.resS", vec![9; 3000])],
            1024,
            false,
            true,
        );
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("Game_Data")).unwrap();
        std::fs::write(dir.path().join("Game_Data/data.unity3d"), bundle).unwrap();
        dir
    }

    fn scene_texts(dir: &Path) -> Vec<String> {
        let mut bundle = Bundle::open(&dir.join("Game_Data/data.unity3d")).unwrap();
        let index = bundle.nodes.iter().position(|n| n.path == "level0").unwrap();
        let data = node_bytes(&mut bundle, index).unwrap();
        list_objects(&data)
            .unwrap()
            .iter()
            .filter(|o| o.class_id == 114)
            .flat_map(|o| find_strings(&data[o.start..o.start + o.size]))
            .map(|s| s.text)
            .collect()
    }

    fn italian() -> HashMap<String, String> {
        let it = ["Gioca", "Esci", "Impostazioni", "Crediti", "Sì", "No", "Lingua", "Va bene"];
        KEYS.iter().zip(it).map(|(k, t)| (k.to_string(), t.to_string())).collect()
    }

    #[test]
    fn probe_picks_the_least_common_language_with_the_same_script() {
        let dir = game(&[&LT, &FR, &RU]);
        let probe = probe(dir.path(), "it", None).unwrap();
        assert_eq!(probe.family, "GAME");
        let mut baked = probe.baked_languages.clone();
        baked.sort();
        assert_eq!(baked, ["fr", "lt", "ru"], "l'inglese coincide con le chiavi: non conta come incorporato");
        // italiano → alfabeto latino: fra lituano e francese si sacrifica il lituano
        assert_eq!(probe.replace_language, "lt");
        assert_eq!(probe.replace_language_name, "Lithuanian");
        assert_eq!(probe.source_language, "en");
        assert_eq!(probe.baked_texts_found, 7, "«OK» è anche una chiave e non conta");
        assert_eq!(probe.entries.len(), 8);
        assert_eq!(probe.entries[0], Entry { key: "Play".into(), text: "Play".into() });
    }

    #[test]
    fn the_replaced_language_must_share_the_target_script() {
        let dir = game(&[&LT, &FR, &RU]);
        // ucraino → cirillico: l'unica candidata è il russo
        assert_eq!(probe(dir.path(), "uk", None).unwrap().replace_language, "ru");
        // giapponese: nessuna lingua del gioco ha quei caratteri
        assert!(probe(dir.path(), "ja", None).unwrap_err().contains("alfabeto"));
        // senza russo incorporato, l'ucraino non ha dove andare
        let latin_only = game(&[&LT, &FR]);
        assert!(probe(latin_only.path(), "uk", None).is_err());
    }

    #[test]
    fn the_user_can_choose_which_language_to_replace() {
        let dir = game(&[&LT, &FR, &RU]);
        assert_eq!(probe(dir.path(), "it", Some("fr")).unwrap().replace_language, "fr");
        assert!(probe(dir.path(), "it", Some("de")).unwrap_err().contains("non è fra quelle"));
    }

    #[test]
    fn a_language_the_game_already_has_is_refused() {
        let dir = game(&[&LT, &FR]);
        assert!(probe(dir.path(), "fr", None).unwrap_err().contains("ha già"));
        assert!(apply(dir.path(), "fr", None, &italian()).is_err());
    }

    #[test]
    fn a_game_with_no_baked_language_is_not_for_this_method() {
        // nelle scene ci sono solo le chiavi (= inglese): nessuna lingua incorporata
        let only_keys = game(&[&KEYS]);
        assert!(probe(only_keys.path(), "it", None).unwrap_err().contains("incorporata"));
        let no_script = game(&[]);
        assert!(probe(no_script.path(), "it", None).is_err());
        // e apply non scrive nulla
        assert!(apply(no_script.path(), "it", None, &italian()).is_err());
        assert!(!backup_path(&no_script.path().join("Game_Data/data.unity3d")).exists());
    }

    #[test]
    fn not_a_unity_bundle_game_is_refused_with_a_reason() {
        let empty = tempfile::tempdir().unwrap();
        assert!(probe(empty.path(), "it", None).unwrap_err().contains("_Data"));
        std::fs::create_dir(empty.path().join("Game_Data")).unwrap();
        assert!(probe(empty.path(), "it", None).unwrap_err().contains("data.unity3d"));
    }

    #[test]
    fn apply_replaces_one_language_and_restore_brings_it_back() {
        let dir = game(&[&LT, &FR]);
        let original = std::fs::read(dir.path().join("Game_Data/data.unity3d")).unwrap();

        let report = apply(dir.path(), "it", None, &italian()).unwrap();
        assert_eq!(report.select_language, "Lithuanian");
        assert_eq!(report.files_changed, ["level0"]);
        // «OK» è anche una chiave: resta fuori. Le altre 7 voci si traducono.
        assert_eq!((report.strings_replaced, report.entries_translated, report.entries_skipped), (7, 7, 1));
        assert_eq!(
            scene_texts(dir.path()),
            [
                // la tabella lituana ora è italiana; le chiavi sono intatte
                "Play", "Gioca", "Exit", "Esci", "Settings", "Impostazioni", "Credits", "Crediti", "Yes", "Sì", "No", "No", "Language", "Lingua", "OK", "OK",
                // la tabella francese non è stata toccata
                "Play", "Jouer", "Exit", "Quitter", "Settings", "Paramètres", "Credits", "Crédits", "Yes", "Oui", "No", "Non", "Language", "Langue", "OK", "OK",
            ]
        );

        // una seconda applicazione riparte dall'originale: stesso risultato
        assert_eq!(apply(dir.path(), "it", None, &italian()).unwrap().strings_replaced, 7);
        // dopo l'applicazione la sonda legge ancora dall'originale
        assert_eq!(probe(dir.path(), "it", None).unwrap().replace_language, "lt");

        assert!(restore(dir.path()).unwrap());
        assert_eq!(std::fs::read(dir.path().join("Game_Data/data.unity3d")).unwrap(), original);
        assert!(!restore(dir.path()).unwrap());
    }

    #[test]
    fn translations_that_match_no_key_write_nothing() {
        let dir = game(&[&LT, &FR]);
        let wrong: HashMap<String, String> = [("Sconosciuta".to_string(), "x".to_string())].into();
        assert!(apply(dir.path(), "it", None, &wrong).unwrap_err().contains("chiavi"));
        assert!(!backup_path(&dir.path().join("Game_Data/data.unity3d")).exists());
    }

    #[test]
    fn tables_may_use_tabs_and_quotes() {
        assert_eq!(parse_table("\u{feff}a\tb\nc\td\n"), [("a".into(), "b".into()), ("c".into(), "d".into())]);
        assert_eq!(parse_table("k,\"uno, due\"\n,vuota\nsolo\n"), [("k".to_string(), "uno, due".to_string())]);
    }
}

/// Misura su un gioco VERO, in sola lettura: cosa dice la sonda e quanto ci mette.
///
/// ```bash
/// cd src-tauri && GS_UNITY_TARGET="nl" GS_UNITY_GAME_DIRS="E:/SteamLibrary/steamapps/common/Lost Host Demo" \
///   cargo test --bin gamestringer -- commands::unity_static::real_static_probe::real_static_probe --ignored --nocapture --exact
/// ```
#[cfg(test)]
mod real_static_probe {
    use super::*;

    #[test]
    #[ignore]
    fn real_static_probe() {
        let dirs = std::env::var("GS_UNITY_GAME_DIRS").expect("GS_UNITY_GAME_DIRS non impostata");
        for dir in dirs.split(';').filter(|d| !d.trim().is_empty()) {
            let started = std::time::Instant::now();
            // punteggi lingua per lingua, per capire una risposta inattesa
            if let Ok(path) = bundle_path(Path::new(dir)) {
                let mut bundle = Bundle::open(&original_bundle(&path)).unwrap();
                if let Ok((family, tables)) = load_family(&mut bundle) {
                    let strings = scene_strings(&mut bundle);
                    println!("    famiglia {family} | {} stringhe negli script delle scene", strings.len());
                    for (table, found, total) in language_scores(&tables, &strings) {
                        println!("    {:>3} {:<22} | voci {:>3} | testi non-chiave {total:>3} | ritrovati nelle scene {found:>3}", table.code, table.name, table.entries.len());
                    }
                }
            }
            let target = std::env::var("GS_UNITY_TARGET").unwrap_or_else(|_| "it".to_string());
            match probe(Path::new(dir), &target, None) {
                Err(e) => println!("{dir} | lingua voluta {target} | non applicabile: {e} | {} ms", started.elapsed().as_millis()),
                Ok(p) => println!(
                    "{dir} | lingua voluta {target} | famiglia={} | lingue={} | incorporate={} | da sostituire={} ({}) con {} testi | sorgente={} | voci={} | {} ms",
                    p.family,
                    p.languages.len(),
                    p.baked_languages.len(),
                    p.replace_language,
                    p.replace_language_name,
                    p.baked_texts_found,
                    p.source_language,
                    p.entries.len(),
                    started.elapsed().as_millis()
                ),
            }
        }
    }
}
