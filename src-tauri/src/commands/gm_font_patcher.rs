//! Comando Tauri: aggiunge glifi mancanti ai font di un gioco GameMaker.
//!
//! Mette insieme i cinque strati di ADR-005 — codec
//! [`gm_qoi`](crate::commands::gm_qoi), contenitore
//! [`gm_texture`](crate::commands::gm_texture), tabella
//! [`gm_font`](crate::commands::gm_font), pianificazione
//! [`gm_glyph_inject`](crate::commands::gm_glyph_inject) e rasterizzazione
//! [`gm_glyph_raster`](crate::commands::gm_glyph_raster) — e li fa agire su un
//! `data.win` vero.
//!
//! # Le regole di condotta
//!
//! **Si può guardare prima di fare.** Con `apply = false` il comando calcola
//! tutto — comprese le dimensioni compresse reali — e non tocca niente. È il
//! solo modo di sapere in anticipo se l'operazione ci sta, e di mostrare
//! all'utente quanti glifi verranno sacrificati.
//!
//! **O tutto o niente.** Se anche un solo font non rientra nel suo budget, non
//! si scrive nulla. Una patch a metà lascerebbe un gioco con font incoerenti e
//! nessun modo di sapere dove ci si è fermati.
//!
//! **Backup obbligatorio, e una volta sola.** Il `.bak` si crea solo se non
//! esiste già, come fa `patch_json_lang_files`: ripatchare non deve mai
//! salvare sopra il backup una versione già modificata.
//!
//! **I font che condividono una texture si trattano insieme.** Due font sullo
//! stesso atlante vanno applicati entrambi *prima* di ricomprimere, altrimenti
//! la seconda scrittura cancella la prima. È l'errore che non darebbe alcun
//! segnale.

#![allow(dead_code)]

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::commands::gamemaker_patcher::find_data_win;
use crate::commands::gm_font::{self, Font};
use crate::commands::gm_glyph_inject::{self, Richiesta, KANJI};
use crate::commands::gm_glyph_raster::{self, SOGLIA};
use crate::commands::gm_placeholder::mask_gm_codes;
use crate::commands::gm_texture;

/// Corpo minimo sotto il quale una lettera non e' piu' leggibile.
const CORPO_MINIMO: f32 = 5.0;

// ── Donatori per i font latini ──
//
// Dal 16/08 la traduzione italiana di Deltarune vive nello SLOT INGLESE
// (`lang_en_ch1.json`), disegnato dai font latini: `fnt_main`, `fnt_small`,
// 96 glifi ASCII e zero kanji. Per iniettare li' le vocali accentate serve
// una strategia donatori diversa da quella CJK.

/// Candidati donatori nei font latini, in ordine di preferenza: prima i
/// simboli con la cella tipicamente alta e l'uso piu' raro nei dialoghi,
/// poi via via quelli piu' plausibili in un testo.
///
/// L'ordine qui e' l'ordine in cui [`donatori_latini`] li restituisce; la
/// pianificazione poi ordina per capienza della cella, ma in un font bitmap
/// le celle latine sono quasi tutte uguali e il sort stabile conserva questa
/// preferenza a parita' di area.
const CANDIDATI_LATINI: &[char] = &[
    '|', '{', '}', '@', '~', '\\', '`', '^', '_', '=', '<', '>', '#', '$', ';',
];

/// Il corpus dei testi che il gioco DISEGNA, costruito dai `lang/*.json`
/// accanto al `data.win`.
struct Corpus {
    /// Carattere disegnato -> un esempio (troncato) di stringa che lo usa.
    disegnati: HashMap<char, String>,
    /// Quanti file sono stati letti: 0 = ammissibilita' non misurabile.
    file_letti: usize,
    /// File esclusi perche' in maggioranza CJK: i loro testi li disegnano i
    /// font CJK, non i latini — vanno DETTI all'utente, non taciuti.
    ignorati: Vec<String>,
}

/// Il carattere appartiene alle scritture CJK (kana, kanji, punteggiatura e
/// forme a larghezza piena/dimezzata)?
fn e_cjk(c: char) -> bool {
    matches!(
        c as u32,
        0x3000..=0x30FF     // punteggiatura CJK + hiragana + katakana
        | 0x3400..=0x4DBF   // estensione A
        | 0x4E00..=0x9FFF   // ideogrammi unificati
        | 0xF900..=0xFAFF   // compatibilita'
        | 0xFF00..=0xFFEF   // fullwidth e halfwidth (ﾊﾟ eccetera)
    )
}

/// Toglie dal testo mascherato i segnaposto `[[n]]` lasciati da
/// [`mask_gm_codes`]. Un segnaposto e' esattamente `[[` + cifre + `]]`,
/// tutto ASCII: gli indici restano su confini di carattere validi.
fn rimuovi_segnaposto(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut i = 0usize;
    while i < b.len() {
        if b[i] == b'[' && i + 1 < b.len() && b[i + 1] == b'[' {
            let mut j = i + 2;
            while j < b.len() && b[j].is_ascii_digit() {
                j += 1;
            }
            if j > i + 2 && j + 1 < b.len() && b[j] == b']' && b[j + 1] == b']' {
                i = j + 2;
                continue;
            }
        }
        match s[i..].chars().next() {
            Some(ch) => {
                out.push(ch);
                i += ch.len_utf8();
            }
            None => break,
        }
    }
    out
}

/// Il testo che il gioco disegna DAVVERO per una stringa dei lang JSON.
///
/// I codici di controllo GameMaker (`&` a capo, `^1..^9` pausa, `/` attesa,
/// `%` fine, `\Xn` espressione) sono consumati dal writer dei dialoghi, mai
/// disegnati: qui si tolgono con [`mask_gm_codes`] e si eliminano i suoi
/// segnaposto. Ma `&`, `/` e `%` possono anche essere testo normale («100%»,
/// «and/or»): per questo l'ammissibilita' di un donatore va MISURATA sul
/// corpus, non presunta guardando la tabella dei codici.
fn testo_disegnato(s: &str) -> String {
    rimuovi_segnaposto(&mask_gm_codes(s).0)
}

/// Primi `max` caratteri, con ellissi se il testo era piu' lungo.
fn tronca(s: &str, max: usize) -> String {
    let mut t: String = s.chars().take(max).collect();
    if s.chars().count() > max {
        t.push('…');
    }
    t
}

/// Raccoglie ricorsivamente tutti i valori stringa di un JSON.
fn raccogli_stringhe<'a>(v: &'a serde_json::Value, out: &mut Vec<&'a str>) {
    match v {
        serde_json::Value::String(s) => out.push(s.as_str()),
        serde_json::Value::Array(a) => {
            for x in a {
                raccogli_stringhe(x, out);
            }
        }
        serde_json::Value::Object(o) => {
            for x in o.values() {
                raccogli_stringhe(x, out);
            }
        }
        _ => {}
    }
}

/// Legge tutti i `lang/*.json` sotto `dir_gioco` e misura quali caratteri il
/// gioco disegna. I file illeggibili si saltano senza fallire: un corpus
/// parziale e' comunque piu' onesto di nessun corpus, e `file_letti` dice al
/// chiamante quanto la misura vale.
///
/// **Filtro per scrittura (16/08, dal primo rosso dell'anteprima):** un file
/// in maggioranza CJK (es. `lang_ja.json` non tradotto) viene IGNORATO — quei
/// testi li disegnano i font CJK, che donano kanji e non passano di qui.
/// Senza il filtro, `;` `<` `>` `` ` `` venivano vetati come donatori di
/// `fnt_main` da stringhe giapponesi che `fnt_main` non disegnera' mai:
/// ancora il verificatore puntato sul bersaglio sbagliato. Un file MISTO
/// (traduzione italiana con residui giapponesi) resta invece dentro: i suoi
/// testi latini li disegna davvero un font latino. La soglia e' la
/// maggioranza dei caratteri non-spazio.
fn carica_corpus(dir_gioco: &Path) -> Corpus {
    let mut corpus = Corpus { disegnati: HashMap::new(), file_letti: 0, ignorati: Vec::new() };
    let voci = match fs::read_dir(dir_gioco.join("lang")) {
        Ok(v) => v,
        Err(_) => return corpus,
    };
    for voce in voci.flatten() {
        let p = voce.path();
        let e_json = p
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("json"))
            .unwrap_or(false);
        if !e_json {
            continue;
        }
        let testo = match fs::read_to_string(&p) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let radice: serde_json::Value = match serde_json::from_str(&testo) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let mut stringhe = Vec::new();
        raccogli_stringhe(&radice, &mut stringhe);

        // Prima si misura la scrittura del file, poi si decide se conta.
        let (mut cjk, mut totali) = (0usize, 0usize);
        for s in &stringhe {
            for c in testo_disegnato(s).chars().filter(|c| !c.is_whitespace()) {
                totali += 1;
                if e_cjk(c) {
                    cjk += 1;
                }
            }
        }
        if totali > 0 && cjk * 2 > totali {
            let nome = p
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| p.display().to_string());
            corpus.ignorati.push(nome);
            continue;
        }

        corpus.file_letti += 1;
        for s in stringhe {
            for c in testo_disegnato(s).chars() {
                corpus.disegnati.entry(c).or_insert_with(|| tronca(s, 40));
            }
        }
    }
    corpus
}

/// Strategia donatori per i font LATINI: quali celle si possono sacrificare.
///
/// Un candidato e' AMMISSIBILE solo se il font lo possiede davvero E il
/// corpus dei testi disegnati non lo usa MAI. Sacrificare la cella di un
/// carattere che il gioco disegna da qualche parte produce un buco silenzioso
/// a schermo — la classe di difetti che questo progetto chiama «fallimenti
/// muti» — quindi si misura, non si presume.
///
/// Restituisce i candidati ammissibili (nell'ordine di [`CANDIDATI_LATINI`])
/// e gli avvisi per l'utente. Se gli ammissibili sono meno di `servono` la
/// lista si restituisce comunque: decidere se bastano spetta al chiamante,
/// che sa quante lettere ha davvero da iniettare.
pub fn donatori_latini(game_dir: &Path, font: &Font, servono: usize) -> (Vec<u16>, Vec<String>) {
    let corpus = carica_corpus(game_dir);
    donatori_latini_con_corpus(font, servono, &corpus)
}

/// Variante con corpus gia' caricato: il comando legge i lang JSON una volta
/// sola e li riusa su tutti i font, invece di rileggerli per ciascuno.
fn donatori_latini_con_corpus(
    font: &Font,
    servono: usize,
    corpus: &Corpus,
) -> (Vec<u16>, Vec<String>) {
    let mut ammissibili: Vec<u16> = Vec::new();
    let mut nomi: Vec<String> = Vec::new();
    let mut esclusi: Vec<String> = Vec::new();

    for &c in CANDIDATI_LATINI {
        if font.glifo(c as u16).is_none() {
            continue; // il font non ha la cella: niente da sacrificare
        }
        match corpus.disegnati.get(&c) {
            Some(esempio) => esclusi.push(format!("'{c}' (disegnato, es. «{esempio}»)")),
            None => {
                ammissibili.push(c as u16);
                nomi.push(c.to_string());
            }
        }
    }

    let mut avvisi = Vec::new();
    if corpus.file_letti == 0 {
        avvisi.push(format!(
            "'{}': nessun lang/*.json leggibile — l'ammissibilita' dei donatori latini \
             non e' stata verificata sul corpus del gioco",
            font.name
        ));
    }
    if !ammissibili.is_empty() {
        avvisi.push(format!(
            "'{}': celle latine sacrificate — il gioco non sapra' piu' disegnare: {}",
            font.name,
            nomi.join(" ")
        ));
    }
    if ammissibili.len() < servono {
        avvisi.push(format!(
            "'{}': donatori latini insufficienti — servono {servono}, ammissibili {}. \
             Candidati esclusi perche' il gioco li disegna: {}",
            font.name,
            ammissibili.len(),
            if esclusi.is_empty() { "nessuno".to_string() } else { esclusi.join("; ") }
        ));
    }
    (ammissibili, avvisi)
}

/// Da dove prendere le celle donatrici di un font.
///
/// I font giapponesi hanno migliaia di kanji inutili a una patch latina: e' il
/// percorso provato in-game (ADR-005) e resta INTATTO. I font latini non hanno
/// kanji: li' si sacrificano i simboli che il corpus non disegna mai.
#[derive(Debug, Clone)]
enum StrategiaDonatori {
    /// Intervallo CJK, il percorso storico.
    Kanji,
    /// Lista esplicita di codepoint, misurata da [`donatori_latini`].
    Lista(Vec<u16>),
}

impl StrategiaDonatori {
    /// Pianifica con la via giusta per questa strategia.
    fn pianifica(
        &self,
        f: &Font,
        richieste: &[Richiesta],
        svuota_resto: bool,
    ) -> Result<gm_glyph_inject::Piano, gm_glyph_inject::Errore> {
        match self {
            Self::Kanji => gm_glyph_inject::pianifica(f, richieste, KANJI, svuota_resto),
            Self::Lista(c) => gm_glyph_inject::pianifica_da_lista(f, richieste, c, svuota_resto),
        }
    }

    /// Le dimensioni delle celle donatrici disponibili nel font.
    fn celle(&self, f: &Font) -> Vec<(u16, u16)> {
        match self {
            Self::Kanji => f
                .donatori(KANJI.0, KANJI.1, 0, 0)
                .iter()
                .map(|g| (g.source_w, g.source_h))
                .collect(),
            Self::Lista(c) => f
                .glyphs
                .iter()
                .filter(|g| c.contains(&g.character))
                .map(|g| (g.source_w, g.source_h))
                .collect(),
        }
    }
}

/// Rasterizza i caratteri richiesti al corpo dato, saltando quelli che il TTF
/// non ha o che il font ospite gia' possiede.
fn prepara(
    ttf: &fontdue::Font,
    f: &Font,
    voluti: &[char],
    corpo: f32,
) -> (Vec<Richiesta>, Vec<(String, String)>) {
    let mut richieste = Vec::new();
    let mut saltati = Vec::new();
    for &c in voluti {
        let cp = c as u32;
        if cp > u16::MAX as u32 {
            saltati.push((c.to_string(), "fuori dal piano base Unicode".into()));
            continue;
        }
        if f.glifo(cp as u16).is_some() {
            saltati.push((c.to_string(), "gia' presente nel font".into()));
            continue;
        }
        match gm_glyph_raster::rasterizza(ttf, c, corpo, SOGLIA) {
            Ok(b) if b.accesi() == 0 => saltati.push((c.to_string(), "disegno vuoto".into())),
            Ok(b) => richieste.push(Richiesta { carattere: cp as u16, bitmap: b, shift: None }),
            Err(e) => saltati.push((c.to_string(), e.to_string())),
        }
    }
    (richieste, saltati)
}

/// Cerca il corpo piu' grande le cui lettere entrano davvero nelle celle
/// disponibili, usando [`gm_glyph_inject::pianifica`] come giudice.
///
/// **Perche' non basta dimensionare sul font ospite.** L'idea di partenza era
/// «rendere le lettere nuove alte quanto le maiuscole gia' presenti», dando per
/// scontato che le celle dei kanji fossero abbondanti. Misurato su Deltarune il
/// 27/07: in `fnt_ja_small` le maiuscole sono alte 14 px e la cella kanji piu'
/// capiente e' **10x14** — i kanji hanno la stessa altezza di riga delle
/// lettere, non di piu'. In piu' una maiuscola accentata e' piu' alta di `H` di
/// circa tre pixel, perche' l'accento sta sopra. Con quei due fatti insieme,
/// dimensionare su `H` produce glifi da 13x17 che non entrano da nessuna parte.
///
/// Qui si parte dal corpo che riprodurrebbe l'altezza delle maiuscole (il
/// massimo sensato: non si disegnano lettere piu' grandi di quelle del gioco) e
/// si scende finche' il piano non regge. La ricerca e' per bisezione, monotona
/// perche' rimpicciolire non puo' che facilitare l'inserimento.
/// Il corpo piu' grande al quale `c` sta dentro una cella `w`x`h`.
///
/// Si dimensiona **una lettera alla volta**: a parita' di corpo una `à`
/// minuscola e' molto piu' bassa di una `À` maiuscola, quindi imporre a
/// entrambe lo stesso corpo perche' la seconda non entra rimpicciolisce anche
/// la prima senza motivo. Misurato su Deltarune: col corpo unico le lettere
/// scendevano da 14 a 11 px, visibilmente piu' piccole del testo circostante,
/// che nel font c'e' gia' a grandezza piena.
fn corpo_per_cella(
    ttf: &fontdue::Font,
    c: char,
    cella: (u16, u16),
    corpo_max: f32,
) -> Option<f32> {
    let entra = |corpo: f32| -> bool {
        match gm_glyph_raster::rasterizza(ttf, c, corpo, SOGLIA) {
            Ok(b) => b.accesi() > 0 && b.w <= cella.0 && b.h <= cella.1,
            Err(_) => false,
        }
    };
    if entra(corpo_max) {
        return Some(corpo_max);
    }
    let (mut basso, mut alto) = (CORPO_MINIMO, corpo_max);
    let mut migliore = None;
    for _ in 0..20 {
        let medio = (basso + alto) / 2.0;
        if entra(medio) {
            migliore = Some(medio);
            basso = medio;
        } else {
            alto = medio;
        }
        if alto - basso < 0.1 {
            break;
        }
    }
    migliore
}

/// La cella che si puo' garantire a ognuna delle `n` lettere richieste.
///
/// Le celle donatrici hanno dimensioni diverse; prendendo l'`n`-esima piu'
/// capiente si sa che ne esistono almeno `n` grandi almeno cosi', quindi
/// dimensionare tutte le lettere su questa rende l'assegnazione realizzabile.
fn cella_garantita(f: &Font, n: usize, strategia: &StrategiaDonatori) -> Option<(u16, u16)> {
    let mut celle: Vec<(u16, u16)> = strategia.celle(f);
    if celle.len() < n || n == 0 {
        return None;
    }
    celle.sort_by_key(|(w, h)| std::cmp::Reverse((*w as u32) * (*h as u32)));
    celle.get(n - 1).copied()
}

/// Restituisce il corpo usato **per ciascuna** lettera, allineato alle
/// richieste: e' l'unico modo di sapere quali hanno ceduto. L'ingombro del
/// glifo non basta — una `À` alta quanto il bersaglio ha la lettera sotto
/// l'accento piu' bassa delle maiuscole gia' presenti, e un controllo
/// sull'altezza totale non se ne accorge.
fn corpo_che_ci_sta(
    ttf: &fontdue::Font,
    f: &Font,
    voluti: &[char],
    corpo_max: f32,
    strategia: &StrategiaDonatori,
) -> Option<(Vec<f32>, Vec<Richiesta>, Vec<(String, String)>)> {
    let realizzabile = |corpo: f32| -> Option<(Vec<Richiesta>, Vec<(String, String)>)> {
        let (richieste, saltati) = prepara(ttf, f, voluti, corpo);
        if richieste.is_empty() {
            return None;
        }
        strategia
            .pianifica(f, &richieste, true)
            .ok()
            .map(|_| (richieste, saltati))
    };

    if let Some((r, s)) = realizzabile(corpo_max) {
        let corpi = vec![corpo_max; r.len()];
        return Some((corpi, r, s));
    }

    // Prima di rimpicciolire tutto, si prova a dimensionare OGNI lettera per
    // conto suo dentro la cella che le si puo' garantire: le minuscole
    // accentate restano a grandezza piena, solo le maiuscole cedono.
    let (base, saltati) = prepara(ttf, f, voluti, corpo_max);
    if let Some(cella) = cella_garantita(f, base.len(), strategia) {
        let mut adattate = Vec::with_capacity(base.len());
        let mut corpi = Vec::with_capacity(base.len());
        let mut minimo = corpo_max;
        for r in &base {
            let c = match char::from_u32(r.carattere as u32) {
                Some(c) => c,
                None => continue,
            };
            let corpo = corpo_per_cella(ttf, c, cella, corpo_max)?;
            minimo = minimo.min(corpo);
            let b = gm_glyph_raster::rasterizza(ttf, c, corpo, SOGLIA).ok()?;
            adattate.push(Richiesta { carattere: r.carattere, bitmap: b, shift: None });
            corpi.push(corpo);
        }
        if !adattate.is_empty() && strategia.pianifica(f, &adattate, true).is_ok() {
            let _ = minimo;
            return Some((corpi, adattate, saltati));
        }
    }

    // Ultima risorsa: stesso corpo per tutte, il piu' grande che regga.
    let (mut basso, mut alto) = (CORPO_MINIMO, corpo_max);
    let mut migliore = None;
    for _ in 0..20 {
        let medio = (basso + alto) / 2.0;
        match realizzabile(medio) {
            Some((r, s)) => {
                migliore = Some((vec![medio; r.len()], r, s));
                basso = medio;
            }
            None => alto = medio,
        }
        if alto - basso < 0.1 {
            break;
        }
    }
    migliore
}

/// Esito per un singolo font, sia in anteprima sia dopo la scrittura.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EsitoFont {
    pub font: String,
    pub texture: i16,
    /// Lettere effettivamente iniettate.
    pub iniettati: Vec<String>,
    /// Lettere saltate, con il motivo: assenti dal TTF, o senza celle libere.
    pub saltati: Vec<(String, String)>,
    /// Glifi donatori sacrificati (tanti quanti gli iniettati).
    pub donatori_sacrificati: usize,
    /// Donatori avanzati svuotati per liberare spazio compresso.
    pub donatori_svuotati: usize,
    /// Altezza in pixel delle lettere effettivamente disegnate.
    pub altezza_glifi: u16,
    /// Altezza delle maiuscole gia' presenti nel font, cioe' il bersaglio.
    /// Se e' maggiore di `altezza_glifi`, le lettere nuove sono piu' piccole
    /// perche' le celle disponibili non bastavano.
    pub altezza_maiuscole_font: u16,
}

/// Esito per una texture: è qui che si decide se l'operazione è realizzabile.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EsitoTextura {
    pub texture: i16,
    pub font: Vec<String>,
    pub blob_originale: usize,
    pub blob_nuovo: usize,
    /// Byte che avanzano. Negativo significa che non ci sta.
    pub margine: i64,
    pub ci_sta: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EsitoIniezione {
    /// `false` = anteprima, niente è stato scritto.
    pub applicato: bool,
    pub data_win: String,
    pub backup: Option<String>,
    pub font: Vec<EsitoFont>,
    pub texture: Vec<EsitoTextura>,
    /// Vero solo se ogni texture rientra nel proprio budget.
    pub realizzabile: bool,
    /// Avvisi da mostrare all'utente: font richiesti e non trovati, lettere
    /// saltate, font del gioco lasciati scoperti.
    pub avvisi: Vec<String>,
}

/// Aggiunge a uno o più font i caratteri che non hanno.
///
/// - `game_path`: cartella del gioco.
/// - `font_names`: nomi dei font da trattare (es. `fnt_ja_main`). Vuoto = tutti
///   quelli che hanno glifi donatori.
/// - `characters`: le lettere da aggiungere, come stringa (es. `"àèéìòù"`).
/// - `ttf_path`: il TTF da cui prendere i disegni.
/// - `apply`: `false` per la sola anteprima.
#[tauri::command(rename_all = "camelCase")]
pub async fn gm_inject_glyphs(
    game_path: String,
    font_names: Vec<String>,
    characters: String,
    ttf_path: String,
    apply: bool,
) -> Result<EsitoIniezione, String> {
    let percorso = find_data_win(&game_path)
        .ok_or_else(|| "data.win non trovato nella cartella del gioco".to_string())?;
    let mut dati = fs::read(&percorso).map_err(|e| format!("lettura di data.win: {e}"))?;

    let ttf_dati = fs::read(&ttf_path).map_err(|e| format!("lettura del TTF: {e}"))?;
    let ttf = gm_glyph_raster::carica_ttf(&ttf_dati).map_err(|e| e.to_string())?;

    let tutti = gm_font::leggi_font(&dati).map_err(|e| format!("chunk FONT: {e}"))?;
    let texture = gm_texture::elenca_texture(&dati);

    let voluti: Vec<char> = characters.chars().collect();
    if voluti.is_empty() {
        return Err("nessun carattere richiesto".into());
    }

    let mut avvisi = Vec::new();

    // Corpus dei testi disegnati, letto UNA volta sola: serve sia a decidere
    // quali font latini sono usabili, sia a scegliere le celle da sacrificare.
    // I lang/*.json vivono accanto al data.win, non necessariamente nella
    // radice passata dall'utente.
    let dir_dati = percorso.parent().map(Path::to_path_buf).unwrap_or_default();
    let corpus = carica_corpus(&dir_dati);
    if !corpus.ignorati.is_empty() {
        avvisi.push(format!(
            "corpus dei donatori latini: ignorato {} (testo in maggioranza CJK: quei testi \
             li disegnano i font CJK, non i latini)",
            corpus.ignorati.join(", ")
        ));
    }

    // Un font e' usabile se ha kanji (percorso storico, provato in-game)
    // oppure se esiste almeno un simbolo latino sacrificabile: dal 16/08 la
    // traduzione italiana vive nello slot inglese, disegnato dai font latini.
    let usabile = |f: &Font| -> bool {
        f.quanti_in(KANJI.0, KANJI.1) > 0
            || !donatori_latini_con_corpus(f, voluti.len(), &corpus).0.is_empty()
    };

    // Font su cui lavorare.
    let scelti: Vec<&Font> = if font_names.is_empty() {
        tutti.iter().filter(|f| usabile(f)).collect()
    } else {
        let mut v = Vec::new();
        for n in &font_names {
            match tutti.iter().find(|f| &f.name == n) {
                Some(f) => v.push(f),
                None => avvisi.push(format!("font '{n}' non trovato nel gioco")),
            }
        }
        v
    };
    if scelti.is_empty() {
        return Err(
            "nessun font utilizzabile: servono celle donatrici — kanji, oppure simboli \
             latini che il gioco non disegna mai nei suoi lang/*.json"
                .into(),
        );
    }

    // Font del gioco che restano scoperti: vanno DICHIARATI, non scoperti
    // dall'utente a gioco avviato.
    for f in &tutti {
        if usabile(f) && !scelti.iter().any(|s| s.name == f.name) {
            avvisi.push(format!(
                "'{}' non viene trattato: dove il gioco lo usa si vedranno caselle vuote",
                f.name
            ));
        }
    }

    // I font che condividono una texture vanno applicati insieme PRIMA di
    // ricomprimere, altrimenti la seconda scrittura cancella la prima.
    let mut per_texture: BTreeMap<i16, Vec<&Font>> = BTreeMap::new();
    for f in &scelti {
        match f.tpag.as_ref() {
            Some(t) => per_texture.entry(t.texture_index).or_default().push(f),
            None => avvisi.push(format!("'{}' non ha una regione TPAG: saltato", f.name)),
        }
    }

    let mut esiti_font = Vec::new();
    let mut esiti_tex = Vec::new();
    let mut da_scrivere: Vec<(usize, Vec<u8>)> = Vec::new();
    let mut realizzabile = true;

    for (indice, gruppo) in per_texture {
        let t = match texture.get(indice.max(0) as usize) {
            Some(t) => *t,
            None => {
                avvisi.push(format!("texture #{indice} non trovata: font saltati"));
                realizzabile = false;
                continue;
            }
        };

        let blob = &dati[t.offset..t.offset + t.spazio];
        let letta = gm_texture::leggi(blob)
            .map_err(|e| format!("texture #{indice} illeggibile: {e}"))?;
        let mut atlante = letta.image;

        for f in &gruppo {
            // Strategia donatori per QUESTO font: kanji se ne ha (percorso
            // provato in-game, intatto), altrimenti la lista dei simboli
            // latini ammissibili misurata sul corpus.
            let strategia = if f.quanti_in(KANJI.0, KANJI.1) > 0 {
                StrategiaDonatori::Kanji
            } else {
                let (candidati, avv) = donatori_latini_con_corpus(f, voluti.len(), &corpus);
                avvisi.extend(avv);
                if candidati.is_empty() {
                    // Onesta': senza donatori il font si scarta DICHIARANDOLO
                    // qui, non fallendo piu' avanti con un errore sulle celle.
                    avvisi.push(format!(
                        "'{}' scartato: nessun donatore ammissibile (niente kanji, e ogni \
                         simbolo latino candidato viene disegnato dal gioco)",
                        f.name
                    ));
                    continue;
                }
                StrategiaDonatori::Lista(candidati)
            };

            let altezza = gm_glyph_raster::altezza_maiuscole(f)
                .map_err(|e| format!("'{}': {e}", f.name))?;
            let corpo = gm_glyph_raster::dimensione_per_altezza(&ttf, 'H', altezza, SOGLIA)
                .map_err(|e| format!("'{}': {e}", f.name))?;

            // Idempotenza: se il font ha gia' tutte le lettere richieste non
            // c'e' niente da fare, e non e' un errore. Succede ogni volta che
            // si rilancia l'operazione su un gioco gia' trattato — capitato
            // subito, perche' `cargo test` esegue i test due volte (una per la
            // libreria e una per il binario) e il secondo giro ha trovato il
            // file gia' patchato.
            let (prime, gia_saltati) = prepara(&ttf, f, &voluti, corpo);
            if prime.is_empty() {
                let tutte_presenti = gia_saltati.iter().all(|(_, m)| m.contains("gia' presente"));
                if tutte_presenti {
                    avvisi.push(format!(
                        "'{}': le {} lettere richieste ci sono gia', niente da fare",
                        f.name,
                        gia_saltati.len()
                    ));
                } else {
                    avvisi.push(format!(
                        "'{}': nessuna lettera utilizzabile ({})",
                        f.name,
                        gia_saltati
                            .iter()
                            .map(|(c, m)| format!("{c}: {m}"))
                            .collect::<Vec<_>>()
                            .join("; ")
                    ));
                }
                esiti_font.push(EsitoFont {
                    font: f.name.clone(),
                    texture: indice,
                    iniettati: Vec::new(),
                    saltati: gia_saltati,
                    donatori_sacrificati: 0,
                    donatori_svuotati: 0,
                    altezza_glifi: 0,
                    altezza_maiuscole_font: altezza,
                });
                continue;
            }

            // Un font che non ce la fa NON deve abbattere gli altri: con la
            // selezione automatica (font_names vuoto, la via della card
            // in-app) basterebbe un font con donatori scarsi per negare la
            // patch anche ai font che funzionano. Si salta DICHIARANDO — la
            // conseguenza a schermo e' la stessa dei font non trattati.
            let (corpi, richieste, saltati) =
                match corpo_che_ci_sta(&ttf, f, &voluti, corpo, &strategia) {
                    Some(x) => x,
                    None => {
                        let piu_grande = prime
                            .iter()
                            .map(|r| (r.bitmap.w, r.bitmap.h))
                            .max_by_key(|(w, h)| (*w as u32) * (*h as u32))
                            .map(|(w, h)| format!("{w}x{h} px"))
                            .unwrap_or_else(|| "nessuno".into());
                        let celle = cella_garantita(f, prime.len(), &strategia)
                            .map(|(w, h)| format!("{w}x{h} px"))
                            .unwrap_or_else(|| "nessuna disponibile".into());
                        avvisi.push(format!(
                            "'{}' saltato: nessun corpo fra {CORPO_MINIMO} e {corpo:.1} produce \
                             lettere che entrino nelle celle. All'altezza delle maiuscole \
                             ({altezza} px) il glifo piu' grande sarebbe {piu_grande}, e la cella \
                             garantita a ciascuna delle {} lettere e' {celle}. Dove il gioco usa \
                             questo font le lettere nuove continueranno a mancare.",
                            f.name,
                            prime.len()
                        ));
                        let mut saltati = gia_saltati;
                        saltati.extend(prime.iter().filter_map(|r| {
                            char::from_u32(r.carattere as u32).map(|c| {
                                (c.to_string(), "le celle donatrici non bastano".to_string())
                            })
                        }));
                        esiti_font.push(EsitoFont {
                            font: f.name.clone(),
                            texture: indice,
                            iniettati: Vec::new(),
                            saltati,
                            donatori_sacrificati: 0,
                            donatori_svuotati: 0,
                            altezza_glifi: 0,
                            altezza_maiuscole_font: altezza,
                        });
                        continue;
                    }
                };

            // `altezza_resa` e' il MASSIMO, quindi include l'accento: dirlo da
            // solo sarebbe fuorviante, perche' resta uguale al bersaglio anche
            // quando le lettere base si sono rimpicciolite. Quello che conta
            // per l'occhio e' l'altezza di una lettera SENZA accento.
            let altezza_resa = richieste.iter().map(|r| r.bitmap.h).max().unwrap_or(0);

            // Ora ogni lettera puo' avere il suo corpo, quindi non c'e' piu'
            // "un'altezza": si elencano quelle che hanno dovuto cedere, con
            // nome e cognome. Un avviso che dice "le lettere sono piu' piccole"
            // senza dire QUALI non aiuta a decidere se accettare la patch.
            let cedute: Vec<String> = richieste
                .iter()
                .zip(corpi.iter())
                .filter(|(_, &c)| c < corpo - 0.5)
                .filter_map(|(r, &c)| {
                    // Quanto sarebbe alta la lettera a quel corpo, senza accento.
                    let alta = gm_glyph_raster::rasterizza(&ttf, 'H', c, SOGLIA)
                        .map(|b| b.h)
                        .unwrap_or(0);
                    char::from_u32(r.carattere as u32).map(|ch| format!("{ch} ({alta}px)"))
                })
                .collect();
            if !cedute.is_empty() {
                // Le dimensioni massime delle celle donatrici, qualunque sia
                // la strategia: servono solo a spiegare all'utente il perche'.
                let (cella_w, cella_h) = strategia
                    .celle(f)
                    .iter()
                    .fold((0u16, 0u16), |(mw, mh), &(w, h)| (mw.max(w), mh.max(h)));
                avvisi.push(format!(
                    "'{}': {} lettere su {} non entrano a grandezza piena ({altezza} px) e sono \
                     state ridotte — {}. Le celle riusabili sono al massimo {cella_w}x{cella_h} \
                     px e un accento occupa spazio sopra la lettera: nel gioco si vedranno un \
                     po' piu' piccole del testo circostante.",
                    f.name,
                    cedute.len(),
                    richieste.len(),
                    cedute.join(", "),
                ));
            }

            let piano = strategia
                .pianifica(f, &richieste, true)
                .map_err(|e| format!("'{}': {e}", f.name))?;
            let aggiornati =
                gm_glyph_inject::applica(&mut atlante, &mut dati, f, &piano, &richieste)
                    .map_err(|e| format!("'{}': {e}", f.name))?;

            for (c, motivo) in &saltati {
                avvisi.push(format!("'{}': '{c}' saltato ({motivo})", f.name));
            }
            esiti_font.push(EsitoFont {
                font: f.name.clone(),
                texture: indice,
                iniettati: aggiornati
                    .iter()
                    .map(|g| {
                        char::from_u32(g.character as u32)
                            .map(|c| c.to_string())
                            .unwrap_or_default()
                    })
                    .collect(),
                saltati,
                donatori_sacrificati: piano.assegnazioni.len(),
                donatori_svuotati: piano.da_svuotare.len(),
                altezza_glifi: altezza_resa,
                altezza_maiuscole_font: altezza,
            });
        }

        // Il verdetto. Si misura il blob PRIMA del riempimento: `scrivi`
        // restituisce sempre un blob lungo quanto lo spazio, quindi la sua
        // lunghezza non direbbe nulla sul margine.
        let blob_nuovo = gm_texture::dimensione_necessaria(&atlante, letta.header)
            .map_err(|e| format!("texture #{indice}: {e}"))?;
        let ci_sta = blob_nuovo <= t.spazio;
        if ci_sta {
            let b = gm_texture::scrivi(&atlante, letta.header, t.spazio)
                .map_err(|e| format!("texture #{indice}: {e}"))?;
            da_scrivere.push((t.offset, b));
        } else {
            realizzabile = false;
        }

        esiti_tex.push(EsitoTextura {
            texture: indice,
            font: gruppo.iter().map(|f| f.name.clone()).collect(),
            blob_originale: t.spazio,
            blob_nuovo,
            margine: t.spazio as i64 - blob_nuovo as i64,
            ci_sta,
        });
    }

    // O tutto o niente: una patch a meta' lascerebbe font incoerenti.
    if apply && !realizzabile {
        return Err(
            "almeno una texture non rientra nel suo spazio: niente e' stato scritto. \
             Ridurre le lettere richieste, o abbassare l'altezza dei glifi."
                .into(),
        );
    }

    let mut backup = None;
    if apply {
        for (offset, blob) in &da_scrivere {
            dati[*offset..*offset + blob.len()].copy_from_slice(blob);
        }

        // Backup una volta sola: ripatchare non deve salvare sopra il backup
        // una versione gia' modificata.
        let bak = percorso.with_extension("win.bak");
        if !bak.exists() {
            fs::copy(&percorso, &bak).map_err(|e| format!("backup non riuscito: {e}"))?;
        }
        backup = Some(bak.display().to_string());

        fs::write(&percorso, &dati).map_err(|e| format!("scrittura di data.win: {e}"))?;
    }

    Ok(EsitoIniezione {
        applicato: apply,
        data_win: percorso.display().to_string(),
        backup,
        font: esiti_font,
        texture: esiti_tex,
        realizzabile,
        avvisi,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Font latino sintetico: una cella 16x16 per ogni carattere richiesto.
    /// Il TPAG non serve ai test sui donatori, che non pianificano.
    fn font_latino(nome: &str, caratteri: &str) -> Font {
        let glyphs = caratteri
            .chars()
            .enumerate()
            .map(|(i, c)| gm_font::Glyph {
                offset: 1000 + i * 16,
                character: c as u16,
                source_x: (i as u16) * 16,
                source_y: 0,
                source_w: 16,
                source_h: 16,
                shift: 16,
                offset_x: 0,
            })
            .collect();
        Font {
            offset: 0,
            name: nome.into(),
            range_start: 0x20,
            range_end: 0xFF,
            scostamento_glifi: 44,
            tpag: None,
            glyphs,
        }
    }

    /// I codici di controllo si tolgono, il testo resta. E i caratteri che
    /// SEMBRANO codici ma sono testo (`%` a meta' frase) restano disegnati:
    /// e' il motivo per cui l'ammissibilita' si misura e non si presume.
    #[test]
    fn testo_disegnato_toglie_i_codici_e_tiene_il_testo() {
        // `&` qui e' un codice (a capo): consumato dal writer, mai disegnato.
        assert_eq!(testo_disegnato("A&B"), "AB");
        // La frase che ha fermato Deltarune: via ^6, & e /% — restano le parole.
        assert_eq!(testo_disegnato("YOU^6& ACCEPT IT?/%"), "YOU ACCEPT IT?");
        // `%` a meta' frase e' testo normale: il gioco lo DISEGNA.
        assert_eq!(testo_disegnato("100% COMPLETE"), "100% COMPLETE");
        // I segnaposto senza la forma esatta [[cifre]] non si toccano.
        assert_eq!(rimuovi_segnaposto("resta [[x]] e [testo]"), "resta [[x]] e [testo]");
    }

    /// Su una cartella finta con un lang JSON: un candidato che compare nel
    /// testo disegnato viene escluso (con l'esempio), gli altri ammessi.
    #[test]
    fn donatori_latini_esclude_i_candidati_disegnati() {
        let dir = std::env::temp_dir()
            .join(format!("gs_donatori_latini_{}", std::process::id()));
        let lang = dir.join("lang");
        fs::create_dir_all(&lang).unwrap();
        // `@` e `#` compaiono nel testo DISEGNATO; il `&` di "1&GO" invece e'
        // un codice (a capo) e non rende disegnato niente.
        fs::write(
            lang.join("lang_en.json"),
            r#"{"a":"Write to mail@example.com","b":"Item #1&GO"}"#,
        )
        .unwrap();

        let f = font_latino("fnt_main", "|@#_");
        let (ammessi, avvisi) = donatori_latini(&dir, &f, 4);
        fs::remove_dir_all(&dir).ok();

        // `|` e `_` ammessi (mai disegnati); `@` e `#` esclusi; gli altri
        // candidati ignorati perche' il font non li possiede.
        assert_eq!(ammessi, vec![u16::from(b'|'), u16::from(b'_')]);
        // Servono 4, ammessi 2: l'avviso dice quanti mancano e QUALI sono
        // esclusi, con un esempio di stringa che li usa.
        assert!(
            avvisi.iter().any(|a| a.contains("insufficienti")
                && a.contains('@')
                && a.contains("mail@example.com")),
            "manca l'avviso sugli esclusi: {avvisi:?}"
        );
        // E c'e' sempre l'elenco onesto dei sacrificati.
        assert!(
            avvisi.iter().any(|a| a.contains("non sapra' piu' disegnare")),
            "manca l'elenco dei sacrificati: {avvisi:?}"
        );
    }

    /// Un file in maggioranza CJK non veta i donatori latini (i suoi testi li
    /// disegnano i font CJK); un file latino si'. Controllo in entrambe le
    /// direzioni: `;` torna ammissibile, `#` resta escluso — e il file misto
    /// (italiano con residui giapponesi) conta come latino.
    #[test]
    fn il_corpus_ignora_i_file_quasi_tutti_cjk() {
        let dir = std::env::temp_dir()
            .join(format!("gs_corpus_cjk_{}", std::process::id()));
        let lang = dir.join("lang");
        fs::create_dir_all(&lang).unwrap();
        // Giapponese puro: usa `;` — che NON deve contare come disegnato.
        fs::write(
            lang.join("lang_ja.json"),
            r#"{"a":"＊ ごきげんよう^1。本日は;&　こんがり色","b":"ヤル気　アルナラ　押シナサイ"}"#,
        )
        .unwrap();
        // Misto a maggioranza italiana (la traduzione con residui ja):
        // conta, e il suo `#` resta un veto legittimo.
        fs::write(
            lang.join("lang_ja_ch1.json"),
            r#"{"a":"per scegliere:& #1 TESTA, #2 CORPO","b":"ごきげんよう"}"#,
        )
        .unwrap();

        let f = font_latino("fnt_main", ";#|");
        let (ammessi, avvisi) = donatori_latini(&dir, &f, 3);
        fs::remove_dir_all(&dir).ok();

        assert_eq!(
            ammessi,
            vec![u16::from(b'|'), u16::from(b';')],
            "`;` vive solo nel file CJK e deve tornare ammissibile; `|` mai visto"
        );
        assert!(
            avvisi.iter().any(|a| a.contains("insufficienti") && a.contains('#')),
            "`#` e' nel file misto (latino): deve restare escluso — {avvisi:?}"
        );
    }

    /// SONDA ADR-006 (misura, non modifica). L'anteprima del 16/08 ha chiuso
    /// la via delle celle proprie: i font latini trattati uscivano a 3px con
    /// tre lettere vuote — i simboli sacrificabili hanno celle minuscole.
    /// L'idea successiva: puntare i record sacrificati dei font latini alle
    /// celle kanji SVUOTATE sulla stessa texture (grandi e abbondanti). Le
    /// coordinate dei glifi sono relative all'origine TPAG del font e senza
    /// segno: una cella e' raggiungibile solo se sta a destra/sotto quella
    /// origine. Qui si misura quante lo sono, e quante cadono FUORI dal
    /// riquadro dichiarato della regione — quelle contano solo se il renderer
    /// del gioco non taglia ai bordi della regione, cosa che decide la prova
    /// in-game, non questa sonda.
    ///
    /// ```text
    /// GS_GM_GAME_DIR="C:/.../DELTARUNEdemo" \
    ///   cargo test misura_celle_kanji -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore = "richiede GS_GM_GAME_DIR con la cartella di un gioco reale"]
    fn misura_celle_kanji_raggiungibili_dai_font_latini() {
        let dir = match std::env::var("GS_GM_GAME_DIR") {
            Ok(d) => d,
            _ => return,
        };
        let percorso = find_data_win(&dir).expect("data.win non trovato");
        let dati = fs::read(&percorso).expect("lettura data.win");
        let font = gm_font::leggi_font(&dati).expect("chunk FONT");

        for f in font.iter().filter(|f| f.quanti_in(KANJI.0, KANJI.1) == 0) {
            let Some(reg) = f.tpag.as_ref() else {
                eprintln!("{}: senza TPAG, non misurabile", f.name);
                continue;
            };
            let alt = gm_glyph_raster::altezza_maiuscole(f).unwrap_or(0);
            // Una maiuscola accentata vuole l'altezza delle maiuscole piu'
            // l'accento sopra (~3px) e una larghezza da lettera piena.
            let serve_h = alt + 3;
            let serve_w = (alt * 3) / 4;

            let (mut raggiungibili, mut capienti, mut fuori_regione) = (0usize, 0usize, 0usize);
            let (mut max_w, mut max_h) = (0u16, 0u16);
            for j in font.iter().filter(|j| {
                j.quanti_in(KANJI.0, KANJI.1) > 0
                    && j.tpag.as_ref().map(|t| t.texture_index) == Some(reg.texture_index)
            }) {
                for g in j.donatori(KANJI.0, KANJI.1, 0, 0) {
                    let Some((ax, ay)) = j.posizione_assoluta(g) else { continue };
                    if ax < reg.source_x || ay < reg.source_y {
                        continue; // offset relativo negativo: irraggiungibile
                    }
                    raggiungibili += 1;
                    max_w = max_w.max(g.source_w);
                    max_h = max_h.max(g.source_h);
                    if ax - reg.source_x >= reg.source_w || ay - reg.source_y >= reg.source_h {
                        fuori_regione += 1;
                    }
                    if g.source_w >= serve_w && g.source_h >= serve_h {
                        capienti += 1;
                    }
                }
            }
            eprintln!(
                "{:<14} texture #{:<3} regione ({},{}) {}x{}  maiuscole {:>2}px  serve ~{}x{}  \
                 kanji raggiungibili {:>5} (capienti {:>5}, fuori dal riquadro {:>5})  \
                 cella max {}x{}",
                f.name,
                reg.texture_index,
                reg.source_x,
                reg.source_y,
                reg.source_w,
                reg.source_h,
                alt,
                serve_w,
                serve_h,
                raggiungibili,
                capienti,
                fuori_regione,
                max_w,
                max_h
            );
        }
    }

    /// SONDA ADR-006, secondo tentativo. La prima sonda ha chiuso la via
    /// delle celle kanji: su Deltarune le regioni ja stanno sopra/a sinistra
    /// delle latine e gli offset dei glifi sono u16 senza segno — zero celle
    /// raggiungibili, morta in geometria. Ma le regioni latine sono piu'
    /// grandi del necessario (fnt_mainbig: 256x256 per ~96 glifi). Qui si
    /// misura lo spazio LIBERO dentro ciascuna regione latina: se ci stanno
    /// almeno 12 celle da lettera accentata, i record sacrificati possono
    /// puntare li' — stessa regione, niente scommessa sul renderer. Il
    /// conteggio e' greedy per bande: un limite INFERIORE, la direzione
    /// onesta (se dice 12, sono almeno 12).
    ///
    /// Stampa anche i donatori ammissibili dal corpus: la decisione ha
    /// bisogno di entrambi i numeri (celle libere E record sacrificabili).
    ///
    /// ```text
    /// GS_GM_GAME_DIR="C:/.../DELTARUNEdemo" \
    ///   cargo test misura_spazio_libero -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore = "richiede GS_GM_GAME_DIR con la cartella di un gioco reale"]
    fn misura_spazio_libero_nelle_regioni_latine() {
        let dir = match std::env::var("GS_GM_GAME_DIR") {
            Ok(d) => d,
            _ => return,
        };
        let percorso = find_data_win(&dir).expect("data.win non trovato");
        let dati = fs::read(&percorso).expect("lettura data.win");
        let font = gm_font::leggi_font(&dati).expect("chunk FONT");
        let radice = percorso.parent().expect("data.win senza cartella");

        for f in font.iter().filter(|f| f.quanti_in(KANJI.0, KANJI.1) == 0) {
            let Some(reg) = f.tpag.as_ref() else {
                eprintln!("{}: senza TPAG, non misurabile", f.name);
                continue;
            };
            let alt = gm_glyph_raster::altezza_maiuscole(f).unwrap_or(0);
            let serve_h = (alt + 3).max(1) as usize;
            let serve_w = ((alt * 3) / 4).max(1) as usize;
            let (w, h) = (reg.source_w as usize, reg.source_h as usize);

            // Occupazione della regione secondo i glifi del font stesso.
            let mut occ = vec![false; w * h];
            for g in &f.glyphs {
                for y in g.source_y..g.source_y.saturating_add(g.source_h) {
                    for x in g.source_x..g.source_x.saturating_add(g.source_w) {
                        let (x, y) = (x as usize, y as usize);
                        if x < w && y < h {
                            occ[y * w + x] = true;
                        }
                    }
                }
            }
            let pixel_liberi = occ.iter().filter(|&&o| !o).count();

            // Celle libere serve_w x serve_h, greedy: dentro una banda si
            // avanza di cella in cella, fra le bande di riga in riga.
            let mut libere = 0usize;
            let mut y = 0usize;
            while y + serve_h <= h {
                let mut x = 0usize;
                let mut trovata_in_banda = false;
                while x + serve_w <= w {
                    let occupata = (y..y + serve_h)
                        .any(|yy| (x..x + serve_w).any(|xx| occ[yy * w + xx]));
                    if occupata {
                        x += 1;
                    } else {
                        libere += 1;
                        trovata_in_banda = true;
                        x += serve_w;
                    }
                }
                y += if trovata_in_banda { serve_h } else { 1 };
            }

            let (ammessi, _) = donatori_latini(radice, f, 12);
            eprintln!(
                "{:<14} regione {}x{}  maiuscole {:>2}px  cella {}x{}  \
                 celle libere >= {:>4}  (pixel liberi {:>5}/{})  record sacrificabili {:>2}",
                f.name,
                w,
                h,
                alt,
                serve_w,
                serve_h,
                libere,
                pixel_liberi,
                w * h,
                ammessi.len()
            );
        }
    }

    /// L'ordine del risultato e' quello di preferenza dei CANDIDATI, non
    /// quello (sparso) della tabella glifi del font.
    #[test]
    fn i_donatori_rispettano_l_ordine_di_preferenza() {
        let f = font_latino("fnt_main", "#@|");
        // Cartella inesistente: corpus vuoto, tutti ammissibili, ma con
        // l'avviso che la misura non c'e' stata.
        let dir = std::env::temp_dir()
            .join(format!("gs_donatori_ordine_{}", std::process::id()));
        let (ammessi, avvisi) = donatori_latini(&dir, &f, 1);

        assert_eq!(
            ammessi,
            vec![u16::from(b'|'), u16::from(b'@'), u16::from(b'#')],
            "l'ordine deve essere quello di CANDIDATI_LATINI"
        );
        assert!(
            avvisi.iter().any(|a| a.contains("non e' stata verificata")),
            "corpus assente non dichiarato: {avvisi:?}"
        );
    }

    /// Il comando su una cartella senza `data.win` deve fallire dicendolo,
    /// non andare in panico.
    #[tokio::test]
    async fn senza_data_win_fallisce_con_un_messaggio() {
        let esito = gm_inject_glyphs(
            "Z:/cartella/che/non/esiste".into(),
            vec![],
            "à".into(),
            "Z:/nessun.ttf".into(),
            false,
        )
        .await;
        assert!(esito.is_err());
        let e = esito.unwrap_err();
        assert!(e.contains("data.win"), "messaggio poco chiaro: {e}");
    }

    /// Estrae dall'atlante di un `data.win` GIA' PATCHATO la regione del font,
    /// segnando in rosso le lettere iniettate. Serve a vedere il risultato
    /// senza dover avviare il gioco — utile perche' Deltarune non ha un menu
    /// lingua e sceglie in base alla lingua di Windows.
    ///
    /// ```text
    /// GS_GM_APPLY_DIR="G:/prove/DELTARUNEcopia" \
    ///   cargo test -- --ignored esporta_atlante_patchato --nocapture
    /// ```
    ///
    /// I PNG finiscono in `target/adr005/`.
    #[tokio::test]
    #[ignore = "richiede GS_GM_APPLY_DIR con una copia gia' patchata"]
    async fn esporta_atlante_patchato() {
        use crate::commands::gm_font::leggi_font;

        let dir = match std::env::var("GS_GM_APPLY_DIR") {
            Ok(d) => d,
            Err(_) => return,
        };
        let percorso = find_data_win(&dir).expect("data.win non trovato");
        let dati = std::fs::read(&percorso).expect("lettura fallita");

        let font = leggi_font(&dati).expect("chunk FONT illeggibile");
        let texture = gm_texture::elenca_texture(&dati);
        let out = std::path::Path::new("target").join("adr005");
        std::fs::create_dir_all(&out).expect("cartella non creata");

        // Le lettere che abbiamo iniettato: si riconoscono dal codepoint.
        let iniettate: Vec<u16> = "àèéìòùÀÈÉÌÒÙ".chars().map(|c| c as u16).collect();

        for nome in ["fnt_ja_main", "fnt_ja_small"] {
            let f = match font.iter().find(|f| f.name == nome) {
                Some(f) => f,
                None => continue,
            };
            let t = f.tpag.as_ref().expect("font senza TPAG");
            let tex = match texture.get(t.texture_index.max(0) as usize) {
                Some(x) => *x,
                None => continue,
            };
            let letta = gm_texture::leggi(&dati[tex.offset..tex.offset + tex.spazio])
                .expect("texture illeggibile");

            // Si ritaglia la sola regione del font: l'atlante intero e' 2048x2048.
            let (rw, rh) = (t.source_w as u32, t.source_h as u32);
            let mut rgba = Vec::with_capacity((rw * rh * 4) as usize);
            for y in 0..rh {
                for x in 0..rw {
                    let p = letta
                        .image
                        .get_pixel(t.source_x + x as u16, t.source_y + y as u16)
                        .unwrap_or([0, 0, 0, 0]);
                    // Su fondo nero i glifi bianchi si vedono; l'alfa si
                    // appiattisce perche' un PNG trasparente non si legge.
                    rgba.extend_from_slice(&[p[2], p[1], p[0], 255]);
                }
            }

            let mut trovate = 0usize;
            for g in f.glyphs.iter().filter(|g| iniettate.contains(&g.character)) {
                trovate += 1;
                let (x0, y0) = (g.source_x as i64, g.source_y as i64);
                let (x1, y1) = (x0 + g.source_w as i64, y0 + g.source_h as i64);
                let mut segna = |x: i64, y: i64| {
                    if x >= 0 && y >= 0 && (x as u32) < rw && (y as u32) < rh {
                        let i = ((y as u32 * rw + x as u32) * 4) as usize;
                        rgba[i] = 255;
                        rgba[i + 1] = 0;
                        rgba[i + 2] = 0;
                    }
                };
                // Riquadro un pixel FUORI dal glifo, per non coprirlo.
                for x in (x0 - 1)..=x1 {
                    segna(x, y0 - 1);
                    segna(x, y1);
                }
                for y in (y0 - 1)..=y1 {
                    segna(x0 - 1, y);
                    segna(x1, y);
                }
                eprintln!(
                    "  U+{:04X} '{}' a ({},{}) {}x{} px",
                    g.character,
                    char::from_u32(g.character as u32).unwrap_or('?'),
                    g.source_x,
                    g.source_y,
                    g.source_w,
                    g.source_h
                );
            }

            let file = out.join(format!("{nome}-patchato.png"));
            image::RgbaImage::from_raw(rw, rh, rgba)
                .expect("dimensioni incoerenti")
                .save(&file)
                .expect("salvataggio fallito");
            eprintln!("{nome}: {trovate} lettere iniettate trovate -> {}", file.display());
            assert!(trovate > 0, "{nome}: nessuna lettera iniettata nella tabella");
        }
        eprintln!("PNG in: {:?}", out.canonicalize().unwrap_or(out.clone()));
    }

    /// **SCRIVE DAVVERO.** Applica l'iniezione a una copia della cartella del
    /// gioco, per poterla poi avviare e guardare.
    ///
    /// ```text
    /// GS_GM_APPLY_DIR="G:/prove/DELTARUNEcopia" GS_TTF="C:/Windows/Fonts/arial.ttf" \
    ///   cargo test -- --ignored applica_su_una_copia --nocapture
    /// ```
    ///
    /// La variabile e' DIVERSA da quella dell'anteprima apposta: non deve
    /// bastare rilanciare il comando di prima per ritrovarsi il gioco
    /// modificato. E se il percorso contiene `steamapps` il test si ferma: la
    /// copia va fatta fuori dalla libreria Steam, cosi' un aggiornamento del
    /// gioco non ci passa sopra e l'originale resta intatto.
    #[tokio::test]
    #[ignore = "SCRIVE: richiede GS_GM_APPLY_DIR (una COPIA) e GS_TTF"]
    async fn applica_su_una_copia() {
        let (dir, ttf) = match (std::env::var("GS_GM_APPLY_DIR"), std::env::var("GS_TTF")) {
            (Ok(d), Ok(t)) => (d, t),
            _ => return,
        };
        assert!(
            !dir.to_lowercase().contains("steamapps"),
            "GS_GM_APPLY_DIR punta dentro la libreria Steam ({dir}). \
             Copiare la cartella del gioco altrove e riprovare: qui si scrive sul serio."
        );

        // Vuoto = tutti i font usabili: la stessa via della card in-app.
        let esito = gm_inject_glyphs(dir, vec![], "àèéìòùÀÈÉÌÒÙ".into(), ttf, true)
            .await
            .expect("applicazione fallita");

        assert!(esito.applicato);
        eprintln!("data.win scritto: {}", esito.data_win);
        eprintln!("backup: {:?}", esito.backup);
        for f in &esito.font {
            eprintln!("{}: {} lettere iniettate", f.font, f.iniettati.len());
        }
        assert!(esito.backup.is_some(), "il backup deve esistere");
        assert!(esito.realizzabile);
    }

    /// La prova vera, in ANTEPRIMA: non scrive niente, ma calcola le
    /// dimensioni compresse reali.
    ///
    /// ```text
    /// GS_GM_GAME_DIR="C:/.../DELTARUNEdemo" GS_TTF="C:/Windows/Fonts/arial.ttf" \
    ///   cargo test -- --ignored anteprima_su_deltarune --nocapture
    /// ```
    #[tokio::test]
    #[ignore = "richiede GS_GM_GAME_DIR e GS_TTF"]
    async fn anteprima_su_deltarune() {
        let (dir, ttf) = match (std::env::var("GS_GM_GAME_DIR"), std::env::var("GS_TTF")) {
            (Ok(d), Ok(t)) => (d, t),
            _ => return,
        };

        // Gli accenti italiani su TUTTI i font usabili (vuoto = selezione
        // automatica, la stessa via della card in-app). Il 16/08 la prima
        // anteprima trattava solo fnt_ja_main/fnt_ja_small: meccanicamente
        // verde, ma lo slot INGLESE disegna coi font latini — il bersaglio
        // vero e' fnt_main e famiglia.
        let esito = gm_inject_glyphs(dir, vec![], "àèéìòùÀÈÉÌÒÙ".into(), ttf, false)
            .await
            .expect("anteprima fallita");

        assert!(!esito.applicato, "l'anteprima non deve scrivere");
        assert!(esito.backup.is_none());

        for f in &esito.font {
            eprintln!(
                "{:<14} texture #{:<3} altezza {:>2}px (maiuscole del font: {:>2}px)  \
                 iniettati {:>2}  sacrificati {:>3}  svuotati {:>4}",
                f.font,
                f.texture,
                f.altezza_glifi,
                f.altezza_maiuscole_font,
                f.iniettati.len(),
                f.donatori_sacrificati,
                f.donatori_svuotati
            );
        }
        for t in &esito.texture {
            eprintln!(
                "texture #{}: {} -> {} byte, margine {} ({})",
                t.texture,
                t.blob_originale,
                t.blob_nuovo,
                t.margine,
                if t.ci_sta { "ci sta" } else { "NON ci sta" }
            );
        }
        for a in &esito.avvisi {
            eprintln!("avviso: {a}");
        }

        assert!(!esito.font.is_empty(), "nessun font trattato");
        assert!(esito.realizzabile, "l'operazione dovrebbe essere realizzabile");

        // Il bersaglio vero: lo slot inglese disegna con fnt_main e famiglia.
        // Un'anteprima verde che non li tocca e' il «verde meccanico» del
        // 16/08 — trattava solo i font giapponesi, che la modalita' inglese
        // non usa. Qui si pretende il bersaglio, non un font qualunque.
        for nome in ["fnt_main", "fnt_mainbig", "fnt_small"] {
            let ok = esito.font.iter().any(|f| {
                f.font == nome
                    && !f.iniettati.is_empty()
                    // LEGGIBILI, non solo presenti: il 16/08 la via delle
                    // celle latine ha prodotto lettere a 3px in font da 13
                    // ('iniettato' era vero, l'accento restava invisibile).
                    // Meta' delle maiuscole e' il pavimento sotto il quale
                    // l'iniezione non conta come bersaglio raggiunto.
                    && f.altezza_glifi * 2 >= f.altezza_maiuscole_font
            });
            assert!(
                ok,
                "'{nome}' senza lettere iniettate LEGGIBILI (almeno meta' delle maiuscole): \
                 in modalita' inglese gli accenti resterebbero spariti o illeggibili \
                 proprio dove il gioco li disegna"
            );
        }
    }
}
