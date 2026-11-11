//! Pianificatore di "String it".
//!
//! Dato un gioco, raccoglie i fatti che contano (motore e da dove lo sappiamo,
//! anti-cheat, variante del motore) e restituisce l'elenco ORDINATO dei metodi
//! di traduzione da provare: prima quello nativo del motore, poi l'aggancio a
//! runtime, per ultimo l'OCR che funziona su tutto. Il frontend li esegue in
//! ordine e passa al successivo quando uno non scrive nulla nel gioco.
//!
//! La regola (`build_plan`) è una funzione pura: non tocca il disco, così i
//! test la coprono senza giochi veri. Il disco lo legge solo `probe`.

use serde::Serialize;
use std::path::Path;

use crate::engine_detector::{detect_engine, GameEngine};

/// Da dove viene il nome del motore. Decide quanto fidarsi.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum EngineSource {
    /// File marcatori trovati nella cartella del gioco.
    Files,
    /// Suggerito dal chiamante (nome del gioco, PCGamingWiki, cache).
    Hint,
    /// Nessuna informazione.
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MethodKind {
    /// Scrive le traduzioni nei file del gioco.
    Static,
    /// Inietta codice nel processo del gioco.
    Runtime,
    /// Legge lo schermo: non tocca il gioco.
    Ocr,
    /// Strumento dedicato in un'altra pagina, non ancora automatico.
    Page,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PlannedMethod {
    /// Identificativo stabile, lo stesso che il frontend usa per eseguire.
    pub id: &'static str,
    pub kind: MethodKind,
    /// true = parte e finisce senza altre scelte dell'utente.
    pub automatic: bool,
    /// Pagina dello strumento, per i metodi `Page`.
    pub route: Option<&'static str>,
    /// Se presente il metodo non va eseguito; dice perché (es. "anti-cheat").
    pub blocked_by: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TranslationPlan {
    /// Nome del motore come lo mostra l'app ("Unity", "Ren'Py", "Unknown").
    pub engine: String,
    pub engine_source: EngineSource,
    /// 0-100. File marcatori = 90, suggerimento = 50, niente = 0.
    pub confidence: u8,
    /// Anti-cheat trovato nella cartella, se c'è.
    pub anti_cheat: Option<String>,
    /// Tabelle di localizzazione trovate nei TextAsset (solo Unity).
    pub unity_loc_tables: usize,
    /// Metodi nell'ordine in cui provarli.
    pub methods: Vec<PlannedMethod>,
}

/// Variante di RPG Maker: cambia completamente il metodo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RpgMakerFlavor {
    /// MV / MZ: `data/*.json` in chiaro.
    MvMz,
    /// XP / VX / VX Ace: archivi Ruby Marshal.
    Rgss,
    /// 2000 / 2003: nessun estrattore, solo runtime.
    Rm2k,
}

/// Fatti letti dal disco. Tutto quello che `build_plan` può sapere.
#[derive(Debug, Clone, Default)]
pub struct Facts {
    pub anti_cheat: Option<String>,
    pub rpgmaker: Option<RpgMakerFlavor>,
    /// TextAsset Unity riconosciuti come tabelle di localizzazione.
    pub unity_loc_tables: usize,
}

fn method(id: &'static str, kind: MethodKind, automatic: bool) -> PlannedMethod {
    PlannedMethod { id, kind, automatic, route: None, blocked_by: None }
}

fn page(id: &'static str, route: &'static str) -> PlannedMethod {
    PlannedMethod { id, kind: MethodKind::Page, automatic: false, route: Some(route), blocked_by: None }
}

/// Il metodo nativo del motore, se ne abbiamo uno. Stessi criteri di
/// riconoscimento che usava il dispatch nel frontend, per non cambiare a quali
/// giochi si applica ciascun ramo.
fn native_methods(engine_lower: &str, facts: &Facts) -> Vec<PlannedMethod> {
    let e = engine_lower;
    let has = |needle: &str| e.contains(needle);

    if has("spike") || has("danganronpa") {
        return vec![method("danganronpa-wad", MethodKind::Static, true)];
    }
    if has("hendrix") {
        return vec![method("hendrix-csv", MethodKind::Static, true)];
    }
    if has("ren'py") || has("renpy") {
        return vec![method("renpy-tl", MethodKind::Static, true)];
    }
    if has("visionaire") {
        return vec![method("visionaire-vis", MethodKind::Static, true)];
    }
    if has("tyrano") || has("nw.js") || has("electron") {
        return vec![method("tyrano-asar", MethodKind::Static, true)];
    }
    if has("unity") {
        let mut methods = Vec::new();
        // Se il gioco ha tabelle di localizzazione si prova prima a scrivere
        // nei suoi file (unity_static.rs, provato in gioco su Lost Host Demo
        // l'11/11/2026): non inietta nulla, quindi vale anche con un
        // anti-cheat. Se il gioco non è fatto per quel metodo, il metodo lo
        // dice e si passa a XUnity.
        if facts.unity_loc_tables > 0 {
            methods.push(method("unity-loc-tables", MethodKind::Static, true));
        }
        // XUnity inietta un loader nel gioco: è runtime, non statico.
        methods.push(method("unity-xunity", MethodKind::Runtime, true));
        return methods;
    }
    if has("unreal") {
        return vec![method("unreal-locres", MethodKind::Static, true)];
    }
    if has("rpg maker") || has("rpgmaker") {
        return match facts.rpgmaker {
            Some(RpgMakerFlavor::MvMz) | None => vec![method("rpgmaker-json", MethodKind::Static, true)],
            Some(RpgMakerFlavor::Rgss) => vec![method("generic-workflow", MethodKind::Static, true)],
            // 2000/2003: niente da estrarre, si va diretti al runtime.
            Some(RpgMakerFlavor::Rm2k) => vec![],
        };
    }
    if has("godot") {
        return vec![page("godot-pck", "/godot-translator")];
    }
    // 'wolf' da solo prenderebbe anche Wolfenstein (id Tech).
    if has("wolf") && has("rpg") {
        return vec![page("wolfrpg", "/wolfrpg-patcher")];
    }
    if has("creation engine") || has("bethesda") {
        return vec![page("bethesda", "/bethesda-patcher")];
    }
    if has("criware") || e.split(|c: char| !c.is_alphanumeric()).any(|w| w == "cri") {
        return vec![page("cri", "/cri-patcher")];
    }
    if has("telltale") {
        return vec![page("telltale", "/telltale-patcher")];
    }
    // GameMaker e tutto il resto: scansione generica dei file di testo.
    vec![method("generic-workflow", MethodKind::Static, true)]
}

/// La regola. Pura: stessi ingressi, stesso piano.
pub fn build_plan(engine: &str, source: EngineSource, facts: &Facts) -> TranslationPlan {
    let known = !engine.trim().is_empty() && !engine.eq_ignore_ascii_case("unknown");
    let (engine, source) = if known {
        (engine.to_string(), source)
    } else {
        ("Unknown".to_string(), EngineSource::None)
    };
    let confidence = match source {
        EngineSource::Files => 90,
        EngineSource::Hint => 50,
        EngineSource::None => 0,
    };

    let mut methods = native_methods(&engine.to_lowercase(), facts);
    // Dopo il metodo nativo: aggancio a runtime, poi OCR che va su tutto.
    methods.push(method("runtime-hook", MethodKind::Runtime, true));
    methods.push(method("ocr-overlay", MethodKind::Ocr, false));

    // Con un anti-cheat non si inietta nulla nel processo: rischio di ban.
    if let Some(name) = &facts.anti_cheat {
        for m in methods.iter_mut().filter(|m| m.kind == MethodKind::Runtime) {
            m.blocked_by = Some(format!("anti-cheat:{name}"));
        }
    }

    TranslationPlan {
        engine,
        engine_source: source,
        confidence,
        anti_cheat: facts.anti_cheat.clone(),
        unity_loc_tables: facts.unity_loc_tables,
        methods,
    }
}

fn rpgmaker_flavor(dir: &Path) -> Option<RpgMakerFlavor> {
    let exists = |rel: &str| dir.join(rel).exists();
    if exists("www/data/System.json") || exists("data/System.json") {
        return Some(RpgMakerFlavor::MvMz);
    }
    if exists("RPG_RT.exe") || exists("RPG_RT.ldb") {
        return Some(RpgMakerFlavor::Rm2k);
    }
    let rgss = ["Game.rgss3a", "Game.rgss2a", "Game.rgssad", "Data/System.rvdata2", "Data/System.rvdata", "Data/System.rxdata"];
    if rgss.iter().any(|f| exists(f)) {
        return Some(RpgMakerFlavor::Rgss);
    }
    None
}

/// Legge dal disco i fatti che servono alla regola. `engine` serve a non
/// cercare tabelle Unity in un gioco che Unity non è.
fn probe(dir: &Path, engine: &str) -> Facts {
    let (anti_cheat, _) = super::unity_patcher::detect_anti_cheat_files(&dir.to_string_lossy());
    let unity_loc_tables = if engine.to_lowercase().contains("unity") {
        super::unity_loc_tables::scan(dir).len()
    } else {
        0
    };
    Facts { anti_cheat, rpgmaker: rpgmaker_flavor(dir), unity_loc_tables }
}

/// Piano di traduzione per un gioco installato.
///
/// `engine_hint` è il motore che il chiamante conosce già (nome del gioco,
/// PCGamingWiki): si usa solo se i file non bastano a riconoscerlo.
#[tauri::command(rename_all = "camelCase")]
pub async fn plan_translation(game_path: String, engine_hint: Option<String>) -> Result<TranslationPlan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = Path::new(&game_path);
        if !dir.is_dir() {
            return Err("Cartella del gioco non trovata".to_string());
        }
        let detected = detect_engine(dir);
        let (engine, source) = if detected != GameEngine::Unknown {
            (detected.as_str().to_string(), EngineSource::Files)
        } else {
            (engine_hint.unwrap_or_default(), EngineSource::Hint)
        };
        let facts = probe(dir, &engine);
        Ok(build_plan(&engine, source, &facts))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(plan: &TranslationPlan) -> Vec<&'static str> {
        plan.methods.iter().map(|m| m.id).collect()
    }

    #[test]
    fn native_method_comes_first_then_runtime_then_ocr() {
        let plan = build_plan("Ren'Py", EngineSource::Files, &Facts::default());
        assert_eq!(ids(&plan), ["renpy-tl", "runtime-hook", "ocr-overlay"]);
        assert_eq!(plan.confidence, 90);
    }

    #[test]
    fn every_plan_ends_with_ocr_so_there_is_always_a_way() {
        for engine in ["Unity", "Unreal Engine", "Godot", "Kirikiri", "Unknown", ""] {
            let plan = build_plan(engine, EngineSource::Hint, &Facts::default());
            assert_eq!(plan.methods.last().map(|m| m.id), Some("ocr-overlay"), "{engine}");
        }
    }

    #[test]
    fn unknown_engine_has_zero_confidence_and_generic_first() {
        for engine in ["Unknown", "unknown", "  ", ""] {
            let plan = build_plan(engine, EngineSource::Files, &Facts::default());
            assert_eq!(plan.engine, "Unknown");
            assert_eq!(plan.engine_source, EngineSource::None);
            assert_eq!(plan.confidence, 0);
            assert_eq!(plan.methods[0].id, "generic-workflow");
        }
    }

    #[test]
    fn hint_is_trusted_less_than_files() {
        let plan = build_plan("Unity", EngineSource::Hint, &Facts::default());
        assert_eq!(plan.confidence, 50);
    }

    #[test]
    fn anti_cheat_blocks_every_injection_but_not_static_or_ocr() {
        let facts = Facts { anti_cheat: Some("EasyAntiCheat".into()), ..Facts::default() };

        let unity = build_plan("Unity", EngineSource::Files, &facts);
        assert_eq!(unity.anti_cheat.as_deref(), Some("EasyAntiCheat"));
        for m in &unity.methods {
            let blocked = m.blocked_by.as_deref() == Some("anti-cheat:EasyAntiCheat");
            assert_eq!(blocked, m.kind == MethodKind::Runtime, "{}", m.id);
        }
        // Unity con anti-cheat: XUnity e hook bloccati, resta l'OCR.
        let runnable: Vec<_> = unity.methods.iter().filter(|m| m.blocked_by.is_none()).map(|m| m.id).collect();
        assert_eq!(runnable, ["ocr-overlay"]);

        let unreal = build_plan("Unreal Engine", EngineSource::Files, &facts);
        assert!(unreal.methods[0].blocked_by.is_none(), "il pak statico non inietta nulla");
    }

    #[test]
    fn unity_loc_tables_come_before_xunity_and_survive_an_anti_cheat() {
        let none = build_plan("Unity", EngineSource::Files, &Facts::default());
        assert_eq!(ids(&none), ["unity-xunity", "runtime-hook", "ocr-overlay"]);

        let facts = Facts { unity_loc_tables: 3, ..Facts::default() };
        let plan = build_plan("Unity", EngineSource::Files, &facts);
        assert_eq!(ids(&plan), ["unity-loc-tables", "unity-xunity", "runtime-hook", "ocr-overlay"]);
        assert_eq!(plan.unity_loc_tables, 3);
        assert!(plan.methods[0].automatic);

        // scrivere nei file non inietta nulla: con un anti-cheat resta l'unico
        // metodo automatico
        let guarded = Facts { unity_loc_tables: 3, anti_cheat: Some("BattlEye".into()), ..Facts::default() };
        let plan = build_plan("Unity", EngineSource::Files, &guarded);
        let runnable: Vec<_> = plan.methods.iter().filter(|m| m.blocked_by.is_none()).map(|m| m.id).collect();
        assert_eq!(runnable, ["unity-loc-tables", "ocr-overlay"]);

        // le tabelle sono un fatto Unity: su altri motori non creano metodi
        let renpy = build_plan("Ren'Py", EngineSource::Files, &facts);
        assert_eq!(ids(&renpy), ["renpy-tl", "runtime-hook", "ocr-overlay"]);
    }

    #[test]
    fn rpg_maker_flavor_changes_the_method() {
        let plan = |flavor| {
            let facts = Facts { rpgmaker: flavor, ..Facts::default() };
            ids(&build_plan("RPG Maker", EngineSource::Files, &facts))
        };
        assert_eq!(plan(Some(RpgMakerFlavor::MvMz))[0], "rpgmaker-json");
        assert_eq!(plan(Some(RpgMakerFlavor::Rgss))[0], "generic-workflow");
        // 2000/2003: nessun metodo statico, si parte dal runtime.
        assert_eq!(plan(Some(RpgMakerFlavor::Rm2k)), ["runtime-hook", "ocr-overlay"]);
    }

    #[test]
    fn hendrix_wins_over_rpg_maker_and_wolfenstein_is_not_wolf_rpg() {
        let hendrix = build_plan("Hendrix Localization", EngineSource::Files, &Facts::default());
        assert_eq!(hendrix.methods[0].id, "hendrix-csv");

        let wolf = build_plan("Wolf RPG Editor", EngineSource::Files, &Facts::default());
        assert_eq!(wolf.methods[0].route, Some("/wolfrpg-patcher"));

        let wolfenstein = build_plan("id Tech (Wolfenstein)", EngineSource::Hint, &Facts::default());
        assert_eq!(wolfenstein.methods[0].id, "generic-workflow");
    }

    #[test]
    fn cri_matches_as_a_whole_word_only() {
        let cri = build_plan("CRI Middleware", EngineSource::Hint, &Facts::default());
        assert_eq!(cri.methods[0].id, "cri");
        let criware = build_plan("CRIWARE", EngineSource::Hint, &Facts::default());
        assert_eq!(criware.methods[0].id, "cri");
        // "Scripting" contiene «cri» ma non è CRI.
        let other = build_plan("Custom Scripting Engine", EngineSource::Hint, &Facts::default());
        assert_eq!(other.methods[0].id, "generic-workflow");
    }

    #[test]
    fn page_methods_are_not_automatic_and_carry_their_route() {
        let plan = build_plan("Godot", EngineSource::Files, &Facts::default());
        let first = &plan.methods[0];
        assert_eq!(first.kind, MethodKind::Page);
        assert!(!first.automatic);
        assert_eq!(first.route, Some("/godot-translator"));
    }

    #[test]
    fn probe_reads_rpg_maker_flavor_from_disk() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(rpgmaker_flavor(tmp.path()), None);

        std::fs::create_dir_all(tmp.path().join("www/data")).unwrap();
        std::fs::write(tmp.path().join("www/data/System.json"), "{}").unwrap();
        assert_eq!(rpgmaker_flavor(tmp.path()), Some(RpgMakerFlavor::MvMz));

        let old = tempfile::tempdir().unwrap();
        std::fs::write(old.path().join("RPG_RT.exe"), "").unwrap();
        assert_eq!(rpgmaker_flavor(old.path()), Some(RpgMakerFlavor::Rm2k));

        let ace = tempfile::tempdir().unwrap();
        std::fs::write(ace.path().join("Game.rgss3a"), "").unwrap();
        assert_eq!(rpgmaker_flavor(ace.path()), Some(RpgMakerFlavor::Rgss));
    }
}
