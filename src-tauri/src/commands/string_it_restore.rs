//! Annulla String it: rimette un gioco com'era prima che GameStringer lo
//! traducesse, metodo per metodo, e dice cosa ha fatto.
//!
//! Regola unica: si ripristina da un backup che GameStringer ha fatto, oppure
//! si cancella un file che porta la firma di GameStringer. Ciò che non si può
//! provare nostro non si tocca: finisce fra gli interventi manuali, col motivo.
//!
//! Dove ogni metodo scrive (e quindi cosa si annulla) è descritto accanto a
//! ogni `scan_*`, con il file del codice che applica la patch.

use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

const M_UNREAL: &str = "unreal-locres";
const M_UNITY_STATIC: &str = "unity-loc-tables";
const M_XUNITY: &str = "unity-xunity";
const M_RENPY: &str = "renpy";
const M_RPGMAKER: &str = "rpgmaker";
const M_VISIONAIRE: &str = "visionaire";
const M_TYRANO: &str = "tyrano";
const M_DANGANRONPA: &str = "danganronpa";
const M_HENDRIX: &str = "hendrix";
const M_GAMEMAKER: &str = "gamemaker";
const M_WORKFLOW: &str = "generic-workflow";

/// Cartella dei backup di `file_manager::save_file_with_backup`.
const FILE_MANAGER_BACKUPS: &str = ".gamestringer_backups";
/// Firme scritte da `renpy_patcher::generate_renpy_translation`.
const RENPY_FILTER_FILE: &str = "gamestringer_say_filter.rpy";
const RENPY_FILTER_SIGNATURE: &str = "# GameStringer — filtro traduzione dialoghi runtime";
const RENPY_ACTIVATOR_SIGNATURE: &str = "# GameStringer — attivazione della lingua";
const RENPY_UI_SIGNATURE: &str = "# Translation file for ";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MethodDetail {
    pub method: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MethodReason {
    pub method: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MethodError {
    pub method: String,
    pub error: String,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreReport {
    pub restored: Vec<MethodDetail>,
    pub skipped: Vec<MethodReason>,
    pub errors: Vec<MethodError>,
}

/// Cosa si può annullare, senza toccare nulla. `restorable` vuoto = niente
/// pulsante; `manual` sono cose trovate che non annulliamo da soli.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreProbe {
    pub restorable: Vec<MethodDetail>,
    pub manual: Vec<MethodReason>,
}

enum Op {
    /// Il backup più vecchio torna al posto del file (rename, stesso volume);
    /// gli altri backup GameStringer dello stesso file vengono eliminati.
    Swap { target: PathBuf, oldest: PathBuf, others: Vec<PathBuf> },
    /// Copia indietro senza consumare il backup (snapshot del workflow in AppData).
    CopyBack { target: PathBuf, backup: PathBuf },
    /// File con la firma GameStringer da cancellare, poi le cartelle rimaste vuote.
    Delete { files: Vec<PathBuf>, prune: Vec<PathBuf> },
    /// Copia i file di `backup_dir` in `target_dir`, poi elimina `backup_dir`.
    DirBack { backup_dir: PathBuf, target_dir: PathBuf },
    UnityStatic,
    UnrealPaks,
    Visionaire { backup: PathBuf },
    Tyrano { backup: PathBuf },
}

struct Item {
    method: &'static str,
    label: String,
    op: Op,
}

#[derive(Default)]
struct Scan {
    items: Vec<Item>,
    manual: Vec<MethodReason>,
}

fn manual(method: &str, reason: String) -> MethodReason {
    MethodReason { method: method.to_string(), reason }
}

/// Percorso relativo al gioco, con `/`, per i messaggi.
fn rel_label(game_dir: &Path, path: &Path) -> String {
    path.strip_prefix(game_dir)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn modified(path: &Path) -> SystemTime {
    fs::metadata(path).and_then(|m| m.modified()).unwrap_or(SystemTime::UNIX_EPOCH)
}

/// Primi `n` byte di un file come testo (le firme stanno in testa).
fn head(path: &Path, n: usize) -> String {
    match fs::read(path) {
        Ok(bytes) => String::from_utf8_lossy(&bytes[..bytes.len().min(n)]).into_owned(),
        Err(_) => String::new(),
    }
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

/// `YYYYmmdd_HHMMSS_<nome>` → `<nome>` (formato di `save_file_with_backup`).
fn strip_backup_timestamp(name: &str) -> Option<&str> {
    let b = name.as_bytes();
    if b.len() <= 16 || b[8] != b'_' || b[15] != b'_' {
        return None;
    }
    if !b[..8].iter().chain(&b[9..15]).all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(&name[16..])
}

// ─────────────────────────────────────────────────────────────────────────────
// Scansione della cartella del gioco
// ─────────────────────────────────────────────────────────────────────────────

/// Backup sparsi nell'albero del gioco, raccolti in una sola passata.
#[derive(Default)]
struct TreeBackups {
    /// rpgmaker: file → suoi backup (`.gamestringer_backups/` e `<file>.gs_bak`).
    rpg: BTreeMap<PathBuf, Vec<PathBuf>>,
    /// visionaire: (`<x>.vis`, `<x>.vis.gs_bak`).
    vis: Vec<(PathBuf, PathBuf)>,
    /// hendrix: (`<file>`, `<file>.gsbak`).
    hendrix: Vec<(PathBuf, PathBuf)>,
}

fn walk_tree(game_dir: &Path) -> TreeBackups {
    let mut out = TreeBackups::default();
    let mut it = walkdir::WalkDir::new(game_dir).max_depth(6).into_iter();
    while let Some(entry) = it.next() {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if entry.file_type().is_dir() {
            if name == FILE_MANAGER_BACKUPS {
                // file_manager.rs:24-38 — `<dir>/.gamestringer_backups/<ts>_<nome>`
                let parent = path.parent().unwrap_or(game_dir);
                for b in fs::read_dir(path).into_iter().flatten().flatten() {
                    let bp = b.path();
                    let bname = file_name(&bp);
                    if !bp.is_file() {
                        continue;
                    }
                    if let Some(orig) = strip_backup_timestamp(&bname) {
                        let target = parent.join(orig);
                        if target.is_file() {
                            out.rpg.entry(target).or_default().push(bp);
                        }
                    }
                }
                it.skip_current_dir();
            }
            continue;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        if let Some(orig) = name.strip_suffix(".gs_bak") {
            // visionaire_patcher.rs:769 (`<vis>.gs_bak`) e prediction_tool.rs:7353
            // (RPG Maker via workflow: `<data file>.gs_bak`).
            let target = path.with_file_name(orig);
            if !target.is_file() {
                continue;
            }
            let is_vis = target.extension().is_some_and(|e| e.eq_ignore_ascii_case("vis"));
            if is_vis {
                out.vis.push((target, path.to_path_buf()));
            } else {
                out.rpg.entry(target).or_default().push(path.to_path_buf());
            }
        } else if let Some(orig) = name.strip_suffix(".gsbak") {
            // hendrix_csv_patcher.rs:416, 559, 581
            let target = path.with_file_name(orig);
            if target.is_file() {
                out.hendrix.push((target, path.to_path_buf()));
            }
        }
    }
    out
}

/// Il backup più vecchio è l'originale: le copie conservano l'ordine in cui
/// sono state fatte (mtime), a parità vince il nome (timestamp nel nome).
fn swap_oldest(target: PathBuf, mut backups: Vec<PathBuf>) -> Op {
    backups.sort_by(|a, b| modified(a).cmp(&modified(b)).then_with(|| file_name(a).cmp(&file_name(b))));
    let oldest = backups.remove(0);
    Op::Swap { target, oldest, others: backups }
}

/// Stessa scelta di `visionaire_patcher::find_vis_file` (privata): il .vis
/// che `restore_vis_backup` ripristina.
fn main_vis_file(game_dir: &Path) -> Option<PathBuf> {
    if let Ok(content) = fs::read_to_string(game_dir.join("config.ini")) {
        for line in content.lines() {
            let t = line.trim();
            if t.to_uppercase().starts_with("FILE") && t.contains('=') {
                let val = t.split('=').nth(1).unwrap_or("").trim();
                if !val.is_empty() && game_dir.join(val).exists() {
                    return Some(game_dir.join(val));
                }
            }
        }
    }
    fs::read_dir(game_dir).ok()?.flatten().map(|e| e.path()).find(|p| {
        p.extension().is_some_and(|e| e.eq_ignore_ascii_case("vis"))
    })
}

fn scan_tree(game_dir: &Path, scan: &mut Scan) {
    let tree = walk_tree(game_dir);

    for (target, backups) in tree.rpg {
        let label = rel_label(game_dir, &target);
        scan.items.push(Item { method: M_RPGMAKER, label, op: swap_oldest(target, backups) });
    }

    let main_vis = main_vis_file(game_dir);
    for (target, backup) in tree.vis {
        let label = rel_label(game_dir, &target);
        let op = if main_vis.as_deref() == Some(target.as_path()) {
            Op::Visionaire { backup }
        } else {
            Op::Swap { target, oldest: backup, others: Vec::new() }
        };
        scan.items.push(Item { method: M_VISIONAIRE, label, op });
    }

    for (target, backup) in tree.hendrix {
        let label = rel_label(game_dir, &target);
        scan.items.push(Item { method: M_HENDRIX, label, op: Op::Swap { target, oldest: backup, others: Vec::new() } });
    }
}

/// danganronpa_patcher.rs:5444 — `<wad>.wad.gsbackup` accanto al WAD, fatto
/// una volta sola prima del rebuild; `.wad.gsnew` è il suo file temporaneo.
fn scan_danganronpa(game_dir: &Path, scan: &mut Scan) {
    for e in fs::read_dir(game_dir).into_iter().flatten().flatten() {
        let p = e.path();
        let name = file_name(&p);
        let Some(wad) = name.strip_suffix(".gsbackup") else { continue };
        if !wad.to_ascii_lowercase().ends_with(".wad") || !p.is_file() {
            continue;
        }
        let target = game_dir.join(wad);
        if !target.is_file() {
            continue;
        }
        let tmp = game_dir.join(format!("{}.gsnew", wad));
        let others = if tmp.is_file() { vec![tmp] } else { Vec::new() };
        scan.items.push(Item { method: M_DANGANRONPA, label: wad.to_string(), op: Op::Swap { target, oldest: p, others } });
    }
}

/// gamemaker_patcher.rs: `data.win.bak` (1281, anche gm_font_patcher.rs:1137),
/// `lang/lang_ja*.json.bak` (679), `language/engLanguage.bak/` (1074),
/// `<exe>.exe.bak` per YYC (1186). Stessi file di `gm_restore_backup` (1467),
/// che però non consuma i backup e ripristina qualsiasi `.exe.bak`.
fn scan_gamemaker(game_dir: &Path, scan: &mut Scan) {
    // find_data_win (489): data.win, poi game.unx, poi game.ios; with_extension("win.bak")
    let data_targets = [
        ("data.win.bak", vec!["data.win"]),
        ("game.win.bak", vec!["game.unx", "game.ios"]),
    ];
    for (bak, targets) in data_targets {
        let backup = game_dir.join(bak);
        if !backup.is_file() {
            continue;
        }
        if let Some(target) = targets.iter().map(|t| game_dir.join(t)).find(|t| t.is_file()) {
            let label = file_name(&target);
            scan.items.push(Item { method: M_GAMEMAKER, label, op: Op::Swap { target, oldest: backup, others: Vec::new() } });
        }
    }

    let lang = game_dir.join("lang");
    let mut lang_baks: Vec<PathBuf> = fs::read_dir(&lang)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            let n = file_name(p);
            n.starts_with("lang_ja") && n.ends_with(".json.bak") && p.is_file()
        })
        .collect();
    lang_baks.sort();
    for backup in lang_baks {
        let target = backup.with_extension(""); // toglie `.bak`
        if target.is_file() {
            let label = rel_label(game_dir, &target);
            scan.items.push(Item { method: M_GAMEMAKER, label, op: Op::Swap { target, oldest: backup, others: Vec::new() } });
        }
    }

    let eng_bak = game_dir.join("language").join("engLanguage.bak");
    let eng = game_dir.join("language").join("engLanguage");
    if eng_bak.is_dir() && eng.is_dir() {
        scan.items.push(Item {
            method: M_GAMEMAKER,
            label: "language/engLanguage".to_string(),
            op: Op::DirBack { backup_dir: eng_bak, target_dir: eng },
        });
    }

    for e in fs::read_dir(game_dir).into_iter().flatten().flatten() {
        let p = e.path();
        let name = file_name(&p);
        let Some(exe) = name.strip_suffix(".bak") else { continue };
        if exe.to_ascii_lowercase().ends_with(".exe") && p.is_file() && game_dir.join(exe).is_file() {
            scan.manual.push(manual(
                M_GAMEMAKER,
                format!(
                    "{name}: potrebbe essere il backup della patch GameMaker YYC, ma anche di un altro \
                     strumento (Steamless usa lo stesso nome). Non si può provare che sia di GameStringer: \
                     se è il tuo caso, rinominalo a mano in {exe}."
                ),
            ));
        }
    }
}

/// renpy_patcher.rs:620-813 — `game/tl/<lang>/<file>_<lang>.rpy` (intestazione
/// `# Translation file for`), `game/tl/<lang>/gamestringer_say_filter.rpy` e
/// `game/gs_language.rpy` (firma in prima riga). Più i `.rpyc` che Ren'Py
/// compila da quei file. Nient'altro in `tl/` viene toccato.
fn scan_renpy(game_dir: &Path, scan: &mut Scan) {
    let game = game_dir.join("game");
    let activator = game.join("gs_language.rpy");
    if activator.is_file() && head(&activator, 256).starts_with(RENPY_ACTIVATOR_SIGNATURE) {
        let mut files = vec![activator];
        let rpyc = game.join("gs_language.rpyc");
        if rpyc.is_file() {
            files.push(rpyc);
        }
        scan.items.push(Item {
            method: M_RENPY,
            label: "game/gs_language.rpy".to_string(),
            op: Op::Delete { files, prune: Vec::new() },
        });
    }

    let tl = game.join("tl");
    let mut langs: Vec<PathBuf> = fs::read_dir(&tl).into_iter().flatten().flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect();
    langs.sort();
    for lang_dir in langs {
        let lang = file_name(&lang_dir);
        let ui_header = format!("translate {} strings:", lang);
        let mut files: Vec<PathBuf> = Vec::new();
        for e in walkdir::WalkDir::new(&lang_dir).into_iter().flatten() {
            let p = e.path();
            if !e.file_type().is_file() || !p.extension().is_some_and(|x| x == "rpy") {
                continue;
            }
            let text = head(p, 512);
            let ours = if file_name(p) == RENPY_FILTER_FILE {
                text.starts_with(RENPY_FILTER_SIGNATURE)
            } else {
                let mut lines = text.lines();
                lines.next().is_some_and(|l| l.starts_with(RENPY_UI_SIGNATURE))
                    && lines.next().is_some_and(|l| l.trim().is_empty())
                    && lines.next().is_some_and(|l| l.trim_end() == ui_header)
            };
            if ours {
                files.push(p.to_path_buf());
                let rpyc = p.with_extension("rpyc");
                if rpyc.is_file() {
                    files.push(rpyc);
                }
            }
        }
        if files.is_empty() {
            continue;
        }
        // Solo le cartelle che contenevano un nostro file, dalla più profonda.
        let mut prune: Vec<PathBuf> = Vec::new();
        for f in &files {
            let mut d = f.parent();
            while let Some(dir) = d {
                if !dir.starts_with(&lang_dir) {
                    break;
                }
                if !prune.iter().any(|p| p == dir) {
                    prune.push(dir.to_path_buf());
                }
                d = dir.parent();
            }
        }
        prune.sort_by_key(|p| std::cmp::Reverse(p.components().count()));
        let rpy_count = files.iter().filter(|f| f.extension().is_some_and(|x| x == "rpy")).count();
        scan.items.push(Item {
            method: M_RENPY,
            label: format!("game/tl/{} ({} file)", lang, rpy_count),
            op: Op::Delete { files, prune },
        });
    }
}

/// unity_static.rs:290-344 + unity_fs.rs:497/585 — `<X>_Data/data.unity3d.gs_backup`;
/// `unity_static::restore` lo rimette al suo posto (rename, consuma il backup).
fn scan_unity_static(game_dir: &Path, scan: &mut Scan) {
    let Some(data) = super::unity_loc_tables::data_dir(game_dir) else { return };
    if super::unity_fs::backup_path(&data.join("data.unity3d")).is_file() {
        scan.items.push(Item {
            method: M_UNITY_STATIC,
            label: rel_label(game_dir, &data.join("data.unity3d")),
            op: Op::UnityStatic,
        });
    }
}

/// unity_patcher.rs:2087-2406 installa BepInEx + XUnity senza alcun marcatore:
/// `remove_unity_patch` (3121) cancella l'intera cartella BepInEx, mod
/// dell'utente comprese. Quindi qui si segnala soltanto.
fn scan_xunity(game_dir: &Path, scan: &mut Scan) {
    let bep = game_dir.join("BepInEx");
    if !bep.is_dir() {
        return;
    }
    let has_xunity = bep.join("config").join("AutoTranslatorConfig.ini").is_file()
        || fs::read_dir(bep.join("plugins"))
            .into_iter()
            .flatten()
            .flatten()
            .any(|e| file_name(&e.path()).contains("XUnity"));
    if has_xunity {
        scan.manual.push(manual(
            M_XUNITY,
            "BepInEx + XUnity.AutoTranslator sono installati, ma nessun marcatore prova che li abbia \
             installati GameStringer: rimuoverli cancellerebbe l'intera cartella BepInEx, con eventuali \
             mod tue. Se li ha messi GameStringer usa «Rimuovi patch» nel pannello Unity, altrimenti \
             togli a mano BepInEx/Translation e BepInEx/plugins/XUnity.AutoTranslator."
                .to_string(),
        ));
    }
}

/// unreal_localization.rs:1396 / unreal_iostore.rs:2519 — `*_GameStringer_*_P.pak|utoc|ucas`
/// e `GameStringer_LEGGIMI.txt` nella cartella Paks; li toglie
/// `remove_unreal_translation` (1795) con la stessa regola.
fn scan_unreal(game_dir: &Path, scan: &mut Scan) {
    let Some(paks) = super::unreal_localization::find_paks_dir(game_dir) else { return };
    let mut names: Vec<String> = fs::read_dir(&paks)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| file_name(&e.path()))
        .filter(|n| {
            n.contains("GameStringer")
                && (n.ends_with("_P.pak") || n.ends_with("_P.utoc") || n.ends_with("_P.ucas") || n == "GameStringer_LEGGIMI.txt")
        })
        .collect();
    if names.is_empty() {
        return;
    }
    names.sort();
    scan.items.push(Item { method: M_UNREAL, label: names.join(", "), op: Op::UnrealPaks });
}

/// tyranoscript_patcher.rs:477-503 — `%LOCALAPPDATA%/GameStringer/tyrano_work/<cartella>_backup/app.asar.bak`,
/// rimesso su `resources/app.asar` da `restore_tyrano_backup` (578).
fn scan_tyrano(game_dir: &Path, data_root: Option<&Path>, scan: &mut Scan) {
    let Some(root) = data_root else { return };
    let gname = game_dir.file_name().and_then(|n| n.to_str()).unwrap_or("game");
    let backup = root.join("tyrano_work").join(format!("{}_backup", gname)).join("app.asar.bak");
    if backup.is_file() && game_dir.join("resources").join("app.asar").is_file() {
        scan.items.push(Item { method: M_TYRANO, label: "resources/app.asar".to_string(), op: Op::Tyrano { backup } });
    }
}

/// `exec_<secondi>` → secondi, per ordinare le esecuzioni.
fn exec_number(name: &str) -> Option<u64> {
    name.strip_prefix("exec_")?.parse().ok()
}

/// `source` sta dentro `game_dir`? Restituisce il percorso relativo.
/// Confronto senza maiuscole e con entrambi i separatori: il percorso arriva
/// come l'ha scritto il workflow, che può differire da quello della UI.
fn relative_under(source: &str, game_dir: &Path) -> Option<PathBuf> {
    let s = source.replace('/', "\\");
    let g = game_dir.to_string_lossy().replace('/', "\\");
    let g = g.trim_end_matches('\\');
    if s.len() <= g.len() + 1 || !s.is_char_boundary(g.len()) || !s[..g.len()].eq_ignore_ascii_case(g) || !s[g.len()..].starts_with('\\') {
        return None;
    }
    Some(s[g.len() + 1..].split('\\').filter(|c| !c.is_empty()).collect())
}

/// prediction_tool.rs:6447-6505 (snapshot dei file in `backups/<exec>/<relativo>`)
/// e 8199-8329 (iniezione testuale guidata da `translations/<exec>/<relativo>.gs_translations.json`,
/// che registra `source_file`). Si ripristina un file solo se c'è la prova
/// dell'iniezione: è diverso dallo snapshot e contiene una traduzione che lo
/// snapshot non ha (altrimenti potrebbe essere un aggiornamento del gioco).
fn scan_workflow(game_dir: &Path, data_root: Option<&Path>, scan: &mut Scan) {
    let Some(root) = data_root else { return };
    let mut execs: Vec<(u64, String)> = fs::read_dir(root.join("translations"))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let n = file_name(&e.path());
            exec_number(&n).map(|k| (k, n))
        })
        .collect();
    execs.sort();

    // relativo → (esecuzioni in ordine, traduzioni viste)
    let mut by_file: BTreeMap<PathBuf, (Vec<String>, Vec<String>)> = BTreeMap::new();
    for (_, exec) in &execs {
        for e in walkdir::WalkDir::new(root.join("translations").join(exec)).into_iter().flatten() {
            if !e.file_type().is_file() || !file_name(e.path()).ends_with(".gs_translations.json") {
                continue;
            }
            let Ok(raw) = fs::read_to_string(e.path()) else { continue };
            let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) else { continue };
            let Some(rel) = json.get("source_file").and_then(|s| s.as_str()).and_then(|s| relative_under(s, game_dir)) else { continue };
            let entry = by_file.entry(rel).or_default();
            entry.0.push(exec.clone());
            for t in json.get("translations").and_then(|t| t.as_array()).into_iter().flatten() {
                let orig = t.get("original").and_then(|v| v.as_str()).unwrap_or("");
                let tr = t.get("translated").and_then(|v| v.as_str()).unwrap_or("");
                if !tr.is_empty() && tr != orig {
                    entry.1.push(tr.to_string());
                }
            }
        }
    }

    for (rel, (execs, translated)) in by_file {
        let target = game_dir.join(&rel);
        let Some(backup) = execs.iter().map(|x| root.join("backups").join(x).join(&rel)).find(|b| b.is_file()) else { continue };
        let (Ok(now), Ok(orig)) = (fs::read(&target), fs::read(&backup)) else { continue };
        if now == orig {
            continue;
        }
        let now = String::from_utf8_lossy(&now);
        let orig = String::from_utf8_lossy(&orig);
        if translated.iter().any(|t| now.contains(t.as_str()) && !orig.contains(t.as_str())) {
            scan.items.push(Item { method: M_WORKFLOW, label: rel_label(game_dir, &target), op: Op::CopyBack { target, backup } });
        }
    }
}

fn scan(game_dir: &Path, data_root: Option<&Path>) -> Scan {
    let mut s = Scan::default();
    scan_unreal(game_dir, &mut s);
    scan_unity_static(game_dir, &mut s);
    scan_xunity(game_dir, &mut s);
    scan_renpy(game_dir, &mut s);
    scan_tree(game_dir, &mut s); // rpgmaker, visionaire, hendrix
    scan_tyrano(game_dir, data_root, &mut s);
    scan_danganronpa(game_dir, &mut s);
    scan_gamemaker(game_dir, &mut s);
    scan_workflow(game_dir, data_root, &mut s);
    s
}

// ─────────────────────────────────────────────────────────────────────────────
// Esecuzione
// ─────────────────────────────────────────────────────────────────────────────

fn remove_files(files: &[PathBuf]) -> Result<(), String> {
    for f in files {
        if f.exists() {
            fs::remove_file(f).map_err(|e| format!("rimozione di {}: {}", f.display(), e))?;
        }
    }
    Ok(())
}

fn execute(game_dir: &Path, op: &Op) -> Result<(), String> {
    let game_path = game_dir.to_string_lossy().to_string();
    match op {
        Op::Swap { target, oldest, others } => {
            fs::rename(oldest, target).map_err(|e| format!("ripristino di {}: {}", target.display(), e))?;
            remove_files(others)?;
            // Cartella di backup rimasta vuota: era nostra, va via (se non è vuota resta).
            for b in std::iter::once(oldest).chain(others) {
                if let Some(dir) = b.parent().filter(|d| file_name(d) == FILE_MANAGER_BACKUPS) {
                    let _ = fs::remove_dir(dir);
                }
            }
            Ok(())
        }
        Op::CopyBack { target, backup } => fs::copy(backup, target)
            .map(|_| ())
            .map_err(|e| format!("ripristino di {}: {}", target.display(), e)),
        Op::Delete { files, prune } => {
            remove_files(files)?;
            for d in prune {
                let _ = fs::remove_dir(d); // solo se vuota
            }
            Ok(())
        }
        Op::DirBack { backup_dir, target_dir } => {
            for e in fs::read_dir(backup_dir).map_err(|e| e.to_string())?.flatten() {
                if e.path().is_file() {
                    fs::copy(e.path(), target_dir.join(e.file_name()))
                        .map_err(|err| format!("ripristino di {}: {}", e.path().display(), err))?;
                }
            }
            fs::remove_dir_all(backup_dir).map_err(|e| format!("rimozione di {}: {}", backup_dir.display(), e))
        }
        Op::UnityStatic => super::unity_static::restore(game_dir).map(|_| ()),
        Op::UnrealPaks => {
            tauri::async_runtime::block_on(super::unreal_localization::remove_unreal_translation(game_path)).map(|_| ())
        }
        Op::Visionaire { backup } => {
            tauri::async_runtime::block_on(super::visionaire_patcher::restore_vis_backup(game_path))?;
            remove_files(std::slice::from_ref(backup))
        }
        Op::Tyrano { backup } => {
            super::tyranoscript_patcher::restore_tyrano_backup(game_path)?;
            remove_files(std::slice::from_ref(backup))?;
            if let Some(dir) = backup.parent() {
                let _ = fs::remove_dir(dir);
            }
            Ok(())
        }
    }
}

/// Elenco breve per i messaggi: i primi nomi e quanti altri.
fn summarize(labels: &[String]) -> String {
    if labels.len() <= 4 {
        labels.join(", ")
    } else {
        format!("{} e altri {}", labels[..3].join(", "), labels.len() - 3)
    }
}

/// Raggruppa per metodo, nell'ordine in cui i metodi compaiono.
fn group<T>(items: impl IntoIterator<Item = (&'static str, T)>) -> Vec<(&'static str, Vec<T>)> {
    let mut out: Vec<(&'static str, Vec<T>)> = Vec::new();
    for (m, v) in items {
        match out.iter_mut().find(|(k, _)| *k == m) {
            Some((_, list)) => list.push(v),
            None => out.push((m, vec![v])),
        }
    }
    out
}

fn probe(game_dir: &Path, data_root: Option<&Path>) -> RestoreProbe {
    let s = scan(game_dir, data_root);
    RestoreProbe {
        restorable: group(s.items.into_iter().map(|i| (i.method, i.label)))
            .into_iter()
            .map(|(m, labels)| MethodDetail { method: m.to_string(), detail: summarize(&labels) })
            .collect(),
        manual: s.manual,
    }
}

fn restore_all(game_dir: &Path, data_root: Option<&Path>) -> RestoreReport {
    let s = scan(game_dir, data_root);
    let mut report = RestoreReport { skipped: s.manual, ..Default::default() };
    let mut done: Vec<(&'static str, String)> = Vec::new();
    for item in &s.items {
        match execute(game_dir, &item.op) {
            Ok(()) => done.push((item.method, item.label.clone())),
            Err(e) => report.errors.push(MethodError { method: item.method.to_string(), error: format!("{}: {}", item.label, e) }),
        }
    }
    report.restored = group(done)
        .into_iter()
        .map(|(m, labels)| MethodDetail { method: m.to_string(), detail: format!("ripristinato: {}", summarize(&labels)) })
        .collect();
    if report.restored.iter().any(|r| r.method == M_RENPY) {
        report.skipped.push(manual(
            M_RENPY,
            "Ren'Py può aver memorizzato la lingua scelta nei dati persistenti: senza i file tl/ \
             il gioco mostra comunque il testo originale."
                .to_string(),
        ));
    }
    log::info!(
        "↩️ String it restore {}: {} metodi ripristinati, {} saltati, {} errori",
        game_dir.display(),
        report.restored.len(),
        report.skipped.len(),
        report.errors.len()
    );
    report
}

fn gs_data_root() -> Option<PathBuf> {
    dirs::data_local_dir().map(|d| d.join("GameStringer"))
}

fn game_dir_checked(game_path: &str) -> Result<PathBuf, String> {
    let dir = PathBuf::from(game_path);
    if !dir.is_dir() {
        return Err(format!("Cartella del gioco non trovata: {}", game_path));
    }
    Ok(dir)
}

/// Cosa si può annullare in questo gioco, senza modificare nulla.
#[tauri::command(rename_all = "camelCase")]
pub async fn string_it_restore_probe(game_path: String) -> Result<RestoreProbe, String> {
    let dir = game_dir_checked(&game_path)?;
    tauri::async_runtime::spawn_blocking(move || probe(&dir, gs_data_root().as_deref()))
        .await
        .map_err(|e| e.to_string())
}

/// Annulla tutto ciò che String it ha applicato a questo gioco, metodo per metodo.
#[tauri::command(rename_all = "camelCase")]
pub async fn string_it_restore(game_path: String) -> Result<RestoreReport, String> {
    let dir = game_dir_checked(&game_path)?;
    super::path_guard::ensure_write_allowed(&dir)?;
    tauri::async_runtime::spawn_blocking(move || restore_all(&dir, gs_data_root().as_deref()))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn write(p: &Path, content: &[u8]) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, content).unwrap();
    }

    fn set_age(p: &Path, secs_after_epoch: u64) {
        let f = fs::File::options().write(true).open(p).unwrap();
        f.set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(1_700_000_000 + secs_after_epoch)).unwrap();
    }

    fn methods(p: &RestoreProbe) -> Vec<String> {
        p.restorable.iter().map(|r| r.method.clone()).collect()
    }

    #[test]
    fn string_it_restore_rpgmaker_takes_oldest_backup_and_probe_is_empty_after() {
        let g = tempfile::tempdir().unwrap();
        let map = g.path().join("www/data/Map001.json");
        write(&map, b"tradotto due volte");
        let baks = g.path().join("www/data/.gamestringer_backups");
        let first = baks.join("20260101_100000_Map001.json");
        let second = baks.join("20260102_100000_Map001.json");
        write(&first, b"originale");
        write(&second, b"tradotto una volta");
        set_age(&first, 10);
        set_age(&second, 20);
        // workflow generico: <file>.gs_bak, qui fatto dopo il primo backup
        let sys = g.path().join("www/data/System.json");
        write(&sys, b"sistema tradotto");
        write(&g.path().join("www/data/System.json.gs_bak"), b"sistema originale");

        let p = probe(g.path(), None);
        assert_eq!(methods(&p), vec![M_RPGMAKER]);

        let r = restore_all(g.path(), None);
        assert!(r.errors.is_empty(), "{:?}", r.errors);
        assert_eq!(r.restored.len(), 1);
        assert_eq!(fs::read(&map).unwrap(), b"originale");
        assert_eq!(fs::read(&sys).unwrap(), b"sistema originale");
        assert!(!baks.exists(), "la cartella dei backup vuota va via");
        assert!(!g.path().join("www/data/System.json.gs_bak").exists());
        assert!(probe(g.path(), None).restorable.is_empty());
    }

    #[test]
    fn string_it_restore_renpy_deletes_only_signed_files() {
        let g = tempfile::tempdir().unwrap();
        let game = g.path().join("game");
        write(&game.join("script.rpy"), b"label start:\n");
        write(&game.join("gs_language.rpy"), "# GameStringer — attivazione della lingua \"it\".\ninit 999 python:\n".as_bytes());
        write(&game.join("gs_language.rpyc"), b"compiled");
        let it = game.join("tl/it");
        write(&it.join("screens_it.rpy"), b"# Translation file for screens.rpy\n\ntranslate it strings:\n\n    old \"a\"\n    new \"b\"\n");
        write(&it.join("screens_it.rpyc"), b"compiled");
        write(&it.join(RENPY_FILTER_FILE), "# GameStringer — filtro traduzione dialoghi runtime per 'it'.\n".as_bytes());
        // file dell'utente nella stessa cartella e lingua del gioco: restano
        write(&it.join("mio.rpy"), b"translate it strings:\n");
        write(&game.join("tl/fr/common.rpy"), b"# TODO: Translation updated\n");

        assert_eq!(methods(&probe(g.path(), None)), vec![M_RENPY]);
        let r = restore_all(g.path(), None);
        assert!(r.errors.is_empty(), "{:?}", r.errors);
        assert!(!game.join("gs_language.rpy").exists());
        assert!(!game.join("gs_language.rpyc").exists());
        assert!(!it.join("screens_it.rpy").exists());
        assert!(!it.join("screens_it.rpyc").exists());
        assert!(!it.join(RENPY_FILTER_FILE).exists());
        assert!(it.join("mio.rpy").exists(), "file non nostro cancellato");
        assert!(game.join("tl/fr/common.rpy").exists());
        assert!(game.join("script.rpy").exists());
        assert!(probe(g.path(), None).restorable.is_empty());
    }

    #[test]
    fn string_it_restore_renpy_removes_tl_folder_it_created() {
        let g = tempfile::tempdir().unwrap();
        let it = g.path().join("game/tl/it");
        write(&it.join(RENPY_FILTER_FILE), "# GameStringer — filtro traduzione dialoghi runtime per 'it'.\n".as_bytes());
        restore_all(g.path(), None);
        assert!(!it.exists());
        assert!(g.path().join("game/tl").exists(), "si pota solo fin dove c'erano file nostri");
    }

    #[test]
    fn string_it_restore_gamemaker_restores_backups_and_leaves_exe_bak_manual() {
        let g = tempfile::tempdir().unwrap();
        let root = g.path();
        write(&root.join("data.win"), b"patched");
        write(&root.join("data.win.bak"), b"original");
        write(&root.join("lang/lang_en.json"), b"{}");
        write(&root.join("lang/lang_ja.json"), b"{\"a\":\"tradotto\"}");
        write(&root.join("lang/lang_ja.json.bak"), b"{\"a\":\"jp\"}");
        write(&root.join("language/engLanguage/a.jn"), b"tradotto");
        write(&root.join("language/engLanguage.bak/a.jn"), b"english");
        write(&root.join("Game.exe"), b"exe");
        write(&root.join("Game.exe.bak"), b"exe steamless");

        let p = probe(root, None);
        assert_eq!(methods(&p), vec![M_GAMEMAKER]);
        assert_eq!(p.manual.len(), 1);

        let r = restore_all(root, None);
        assert!(r.errors.is_empty(), "{:?}", r.errors);
        assert_eq!(fs::read(root.join("data.win")).unwrap(), b"original");
        assert_eq!(fs::read(root.join("lang/lang_ja.json")).unwrap(), b"{\"a\":\"jp\"}");
        assert_eq!(fs::read(root.join("language/engLanguage/a.jn")).unwrap(), b"english");
        assert!(!root.join("data.win.bak").exists());
        assert!(!root.join("language/engLanguage.bak").exists());
        // l'EXE non si tocca: non è provato nostro
        assert_eq!(fs::read(root.join("Game.exe")).unwrap(), b"exe");
        assert!(root.join("Game.exe.bak").exists());
        assert_eq!(r.skipped.len(), 1);

        let after = probe(root, None);
        assert!(after.restorable.is_empty());
    }

    #[test]
    fn string_it_restore_visionaire_restores_and_consumes_backup() {
        let g = tempfile::tempdir().unwrap();
        let vis = g.path().join("game.vis");
        write(&vis, b"patched");
        write(&g.path().join("game.vis.gs_bak"), b"original");
        assert_eq!(methods(&probe(g.path(), None)), vec![M_VISIONAIRE]);
        let r = restore_all(g.path(), None);
        assert!(r.errors.is_empty(), "{:?}", r.errors);
        assert_eq!(fs::read(&vis).unwrap(), b"original");
        assert!(probe(g.path(), None).restorable.is_empty());
    }

    #[test]
    fn string_it_restore_hendrix_and_danganronpa() {
        let g = tempfile::tempdir().unwrap();
        let root = g.path();
        write(&root.join("www/data/game_messages.csv"), b"Original,it\nHi,Ciao\n");
        write(&root.join("www/data/game_messages.csv.gsbak"), b"Original\nHi\n");
        write(&root.join("www/js/plugins.js"), b"var $plugins = [{\"status\":true}];");
        write(&root.join("www/js/plugins.js.gsbak"), b"var $plugins = [{\"status\":false}];");
        write(&root.join("dr1_data_us.wad"), b"tradotto");
        write(&root.join("dr1_data_us.wad.gsbackup"), b"originale");
        write(&root.join("dr1_data_us.wad.gsnew"), b"mezzo");

        assert_eq!(methods(&probe(root, None)), vec![M_HENDRIX, M_DANGANRONPA]);
        let r = restore_all(root, None);
        assert!(r.errors.is_empty(), "{:?}", r.errors);
        assert_eq!(fs::read(root.join("www/data/game_messages.csv")).unwrap(), b"Original\nHi\n");
        assert_eq!(fs::read(root.join("www/js/plugins.js")).unwrap(), b"var $plugins = [{\"status\":false}];");
        assert_eq!(fs::read(root.join("dr1_data_us.wad")).unwrap(), b"originale");
        assert!(!root.join("dr1_data_us.wad.gsnew").exists());
        assert!(probe(root, None).restorable.is_empty());
    }

    #[test]
    fn string_it_restore_workflow_needs_proof_of_injection() {
        let g = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        let root = g.path();
        write(&root.join("text/ui.txt"), b"Start = Inizia");
        write(&root.join("text/updated.txt"), b"new game version");
        let exec = "exec_1700000000";
        write(&data.path().join("backups").join(exec).join("text/ui.txt"), b"Start = Start");
        write(&data.path().join("backups").join(exec).join("text/updated.txt"), b"old game version");
        for (file, tr) in [("ui", "Inizia"), ("updated", "Tradotto")] {
            let json = serde_json::json!({
                "source_file": root.join(format!("text/{file}.txt")).to_string_lossy(),
                "translations": [{"original": "x", "translated": tr}],
            });
            write(
                &data.path().join("translations").join(exec).join(format!("text/{file}.gs_translations.json")),
                json.to_string().as_bytes(),
            );
        }

        let p = probe(root, Some(data.path()));
        assert_eq!(p.restorable, vec![MethodDetail { method: M_WORKFLOW.into(), detail: "text/ui.txt".into() }]);
        let r = restore_all(root, Some(data.path()));
        assert!(r.errors.is_empty(), "{:?}", r.errors);
        assert_eq!(fs::read(root.join("text/ui.txt")).unwrap(), b"Start = Start");
        // nessuna traduzione dentro: è un aggiornamento del gioco, non si tocca
        assert_eq!(fs::read(root.join("text/updated.txt")).unwrap(), b"new game version");
        assert!(probe(root, Some(data.path())).restorable.is_empty());
    }

    #[test]
    fn string_it_restore_xunity_is_manual_and_untouched() {
        let g = tempfile::tempdir().unwrap();
        let cfg = g.path().join("BepInEx/config/AutoTranslatorConfig.ini");
        write(&cfg, b"[General]");
        write(&g.path().join("BepInEx/plugins/MyMod.dll"), b"mod");
        let p = probe(g.path(), None);
        assert!(p.restorable.is_empty());
        assert_eq!(p.manual[0].method, M_XUNITY);
        let r = restore_all(g.path(), None);
        assert!(r.restored.is_empty());
        assert!(cfg.exists() && g.path().join("BepInEx/plugins/MyMod.dll").exists());
    }

    #[test]
    fn string_it_restore_untouched_game_has_nothing() {
        let g = tempfile::tempdir().unwrap();
        write(&g.path().join("data.win"), b"x");
        write(&g.path().join("www/data/.gamestringer_backups/notes.txt"), b"x");
        let p = probe(g.path(), None);
        assert!(p.restorable.is_empty() && p.manual.is_empty());
    }

    #[test]
    fn string_it_restore_relative_under_ignores_case_and_separators() {
        let game = Path::new("C:\\Games\\My Game");
        assert_eq!(relative_under("c:/games/my game/a/b.txt", game), Some(PathBuf::from("a").join("b.txt")));
        assert_eq!(relative_under("C:\\Games\\My Game2\\a.txt", game), None);
        assert_eq!(strip_backup_timestamp("20260101_100000_Map001.json"), Some("Map001.json"));
        assert_eq!(strip_backup_timestamp("notes.txt"), None);
    }
}
