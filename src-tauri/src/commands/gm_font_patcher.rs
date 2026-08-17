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
///
/// 16/08: la sonda su Deltarune ha misurato **9 ammissibili dove ne servono
/// 12**. I sei aggiunti stanno IN CODA di proposito: i primi quindici sono
/// gia' stati misurati sul gioco vero, e cambiarne l'ordine avrebbe spostato
/// quali celle si sacrificano senza che nessuno l'avesse chiesto. In coda,
/// entrano solo quando i precedenti non bastano.
///
/// Nessuno di questi e' ammesso per decreto: il corpus del gioco li veta uno
/// per uno se li disegna (vedi [`donatori_latini_con_corpus`]). Allungare la
/// lista allarga le possibilita', non le certezze.
const CANDIDATI_LATINI: &[char] = &[
    '|', '{', '}', '@', '~', '\\', '`', '^', '_', '=', '<', '>', '#', '$', ';',
    // Aggiunti il 16/08 per il gap 9→12, in coda all'ordine storico.
    '+', '*', '[', ']', '(', ')',
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
///
/// `forzati` sono i simboli che l'UTENTE ha deciso di sacrificare ANCHE SE il
/// corpus li disegna. Esistono perche' su Deltarune i tre veti piu' costosi
/// (`|`, `\`, `_`) vengono da stringhe TECNICHE — «||», una barra isolata,
/// «vista_xvista:» — che non sono dialoghi e che il giocatore non vede mai.
/// Ma quel giudizio vale PER QUEL GIOCO: un altro titolo GameMaker potrebbe
/// disegnare `_` in una schermata di immissione del nome. Per questo la scelta
/// e' un parametro, non una costante: chi la fa se la prende, e la vede scritta
/// negli avvisi con l'esempio della stringa che perdera' il disegno.
pub fn donatori_latini(
    game_dir: &Path,
    font: &Font,
    servono: usize,
    forzati: &[char],
) -> (Vec<u16>, Vec<String>) {
    let corpus = carica_corpus(game_dir);
    donatori_latini_con_corpus(font, servono, &corpus, forzati)
}

/// Variante con corpus gia' caricato: il comando legge i lang JSON una volta
/// sola e li riusa su tutti i font, invece di rileggerli per ciascuno.
fn donatori_latini_con_corpus(
    font: &Font,
    servono: usize,
    corpus: &Corpus,
    forzati: &[char],
) -> (Vec<u16>, Vec<String>) {
    let mut ammissibili: Vec<u16> = Vec::new();
    let mut nomi: Vec<String> = Vec::new();
    let mut esclusi: Vec<String> = Vec::new();
    // I forzati si raccolgono a parte e si accodano DOPO gli ammissibili
    // puliti: si sacrifica prima cio' che non costa niente. Se restassero
    // mescolati, una cella che il gioco disegna verrebbe consumata mentre una
    // gratuita resta libera — un prezzo pagato senza motivo.
    let mut forzati_usati: Vec<u16> = Vec::new();
    let mut forzati_nomi: Vec<String> = Vec::new();

    for &c in CANDIDATI_LATINI {
        if font.glifo(c as u16).is_none() {
            continue; // il font non ha la cella: niente da sacrificare
        }
        match corpus.disegnati.get(&c) {
            Some(esempio) => {
                if forzati.contains(&c) {
                    // Vetato dal corpus ma sdoganato dall'utente: si prende, e
                    // l'esempio della stringa che lo perde va DETTO. Un prezzo
                    // pagato in silenzio e' la stessa cosa di un difetto.
                    forzati_usati.push(c as u16);
                    forzati_nomi.push(format!("'{c}' (compare in «{esempio}»)"));
                } else {
                    esclusi.push(format!("'{c}' (disegnato, es. «{esempio}»)"));
                }
            }
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

    // Chiesti ma inutili: o il font non li ha, o erano gia' ammissibili da
    // soli. Dirlo evita che l'utente creda di aver pagato un prezzo che non
    // ha pagato — e che ne sdogani altri pensando che il primo non sia bastato.
    let inutili: Vec<String> = forzati
        .iter()
        .filter(|c| !forzati_usati.contains(&(**c as u16)))
        .map(|c| {
            // L'ordine dei tre casi conta: il ciclo dei forzati vive DENTRO
            // `for c in CANDIDATI_LATINI`, quindi un simbolo fuori da quella
            // lista non entra mai in `forzati_usati` e senza questo primo
            // ramo verrebbe descritto come «era gia' ammissibile», che e'
            // falso due volte — non e' un candidato, e il gioco potrebbe
            // disegnarlo eccome.
            if !CANDIDATI_LATINI.contains(c) {
                format!("'{c}' (non e' fra i candidati donatori: sdoganarlo non ha effetto)")
            } else if font.glifo(*c as u16).is_none() {
                format!("'{c}' (il font non ha questa cella)")
            } else {
                format!("'{c}' (era gia' ammissibile: il gioco non lo disegna)")
            }
        })
        .collect();
    if !inutili.is_empty() {
        avvisi.push(format!(
            "'{}': sdoganati senza effetto — {}",
            font.name,
            inutili.join("; ")
        ));
    }

    if !ammissibili.is_empty() {
        avvisi.push(format!(
            "'{}': celle latine sacrificate — il gioco non sapra' piu' disegnare: {}",
            font.name,
            nomi.join(" ")
        ));
    }
    if !forzati_usati.is_empty() {
        avvisi.push(format!(
            "'{}': celle sacrificate SU TUA RICHIESTA anche se il gioco le disegna — {}. \
             Dove compaiono, a schermo resteranno vuote.",
            font.name,
            forzati_nomi.join("; ")
        ));
    }

    // I forzati in coda: prima si spende cio' che e' gratuito.
    ammissibili.extend(forzati_usati);

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
    /// Come [`Self::Lista`], ma le lettere si disegnano nello SPAZIO VUOTO
    /// della regione invece che nella cella del donatore.
    ///
    /// Nata il 16/08 dalla misura su Deltarune: la cella garantita dai simboli
    /// latini di `fnt_main` e' 3x5 px, una maiuscola accentata ne vuole 12x16,
    /// e aggiungere donatori PEGGIORA (la garantita e' la piu' piccola delle
    /// scelte). Nella stessa regione ci sono pero' 9.430 pixel liberi e undici
    /// celle 12x16: i record servono ancora, per gli slot nella tabella, ma il
    /// loro rettangolo si sposta dove c'e' posto.
    SpazioLibero(Vec<u16>),
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
            Self::SpazioLibero(c) => {
                // `svuota_resto` NON si propaga: i donatori avanzati sono
                // simboli che il gioco potrebbe ancora disegnare, e qui non
                // c'e' il vantaggio compressivo dei 1.300 kanji svuotati.
                gm_glyph_inject::pianifica_su_spazio_libero(f, richieste, c, false)
            }
        }
    }

    /// Le dimensioni delle celle disponibili per `n` lettere.
    ///
    /// `n` serve solo alla via dello spazio libero, dove le celle non esistono
    /// gia' ma si RITAGLIANO: la domanda li' non e' «quali celle ci sono» ma
    /// «di che dimensione posso averne n». Per le altre due vie e' ignorato.
    fn celle(&self, f: &Font, n: usize) -> Vec<(u16, u16)> {
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
            // Qui la cella che conta NON e' quella del donatore: e' lo spazio
            // vuoto in cui la lettera verra' disegnata. Misurarla sui record
            // darebbe 3x5 e farebbe rimpicciolire le lettere fino a renderle
            // illeggibili — cioe' il difetto che questa strategia esiste per
            // togliere. ⚠️ Il numero di RECORD resta comunque un vincolo, ed
            // e' controllato da `pianifica_su_spazio_libero`: qui si risponde
            // solo sullo spazio.
            Self::SpazioLibero(_) => celle_libere_nella_regione(f, n),
        }
    }
}

/// Le `n` celle libere piu' grandi che la regione TPAG del font puo' offrire.
///
/// Misura greedy, la stessa della sonda `misura_spazio_libero_nelle_regioni_latine`:
/// dà un limite INFERIORE, cioe' sbaglia in difetto. E' la direzione giusta —
/// promettere una cella che non c'e' produrrebbe una patch che fallisce dopo
/// aver gia' scritto.
///
/// Le celle si cercano quadrate-ish a passi decrescenti finche' non se ne
/// trovano almeno `n`: serve a rispondere «di che dimensione posso averne n?»,
/// che e' la domanda di [`cella_garantita`].
fn celle_libere_nella_regione(f: &Font, n: usize) -> Vec<(u16, u16)> {
    let Some(t) = f.tpag.as_ref() else { return Vec::new() };
    let (w, h) = (t.source_w as usize, t.source_h as usize);
    if w == 0 || h == 0 || n == 0 {
        return Vec::new();
    }
    let mut occ = vec![false; w * h];
    for g in &f.glyphs {
        // Stessa dilatazione di 1 px di `gm_glyph_inject::occupazione` (17/08,
        // anti-bleeding): questa misura PROMETTE celle al chooser del corpo, e
        // deve promettere con la stessa matematica con cui il piano consegna.
        let x0 = g.source_x.saturating_sub(1);
        let y0 = g.source_y.saturating_sub(1);
        let x1 = g.source_x.saturating_add(g.source_w).saturating_add(1);
        let y1 = g.source_y.saturating_add(g.source_h).saturating_add(1);
        for y in y0..y1 {
            for x in x0..x1 {
                let (x, y) = (x as usize, y as usize);
                if x < w && y < h {
                    occ[y * w + x] = true;
                }
            }
        }
    }

    let conta = |cw: usize, ch: usize| -> usize {
        if cw == 0 || ch == 0 || cw > w || ch > h {
            return 0;
        }
        let mut libere = 0usize;
        let mut y = 0usize;
        while y + ch <= h {
            let mut x = 0usize;
            let mut trovata = false;
            while x + cw <= w {
                if (y..y + ch).any(|yy| (x..x + cw).any(|xx| occ[yy * w + xx])) {
                    x += 1;
                } else {
                    libere += 1;
                    trovata = true;
                    // +1: fra due celle contate resta il margine anti-bleeding,
                    // come fra le celle che `prendi_cella_libera` prenota.
                    x += cw + 1;
                }
            }
            y += if trovata { ch + 1 } else { 1 };
        }
        libere
    };

    // Dalla piu' grande in giu': la prima misura che ne trova almeno n e' la
    // risposta. Il rapporto 3/4 e' quello di una lettera latina con accento.
    for lato_h in (4..=h.min(64)).rev() {
        let lato_w = ((lato_h * 3) / 4).max(1);
        let quante = conta(lato_w, lato_h);
        if quante >= n {
            return vec![(lato_w as u16, lato_h as u16); quante];
        }
    }
    Vec::new()
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
    let mut celle: Vec<(u16, u16)> = strategia.celle(f, n);
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
/// - `donatori_forzati`: simboli da sacrificare ANCHE SE il gioco li disegna,
///   come stringa (es. `"|\\_"`). Assente o vuota = nessuno, che e' il
///   comportamento di sempre. Serve quando i veti del corpus vengono da
///   stringhe tecniche che il giocatore non vede mai: la decisione e' per
///   gioco, la prende l'utente e la ritrova scritta negli avvisi.
#[tauri::command(rename_all = "camelCase")]
pub async fn gm_inject_glyphs(
    game_path: String,
    font_names: Vec<String>,
    characters: String,
    ttf_path: String,
    apply: bool,
    donatori_forzati: Option<String>,
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

    // I simboli sdoganati dall'utente. Nessun default: se non li chiede
    // nessuno, la lista e' vuota e il comportamento e' quello di sempre.
    let forzati: Vec<char> = donatori_forzati
        .as_deref()
        .unwrap_or("")
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();

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
            || !donatori_latini_con_corpus(f, voluti.len(), &corpus, &forzati)
                .0
                .is_empty()
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
                let (candidati, avv) =
                    donatori_latini_con_corpus(f, voluti.len(), &corpus, &forzati);
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

                // Le celle dei simboli bastano, o serve lo spazio libero?
                // La domanda si fa QUI e con un confronto, non a intuito: si
                // guarda la cella garantita dalle due vie e si prende quella
                // che offre piu' area. Su fnt_main la Lista da' 3x5 e lo
                // spazio libero 12x16 — ma su un font con celle generose la
                // via classica resta migliore, e non va scavalcata per abitudine.
                let via_lista = StrategiaDonatori::Lista(candidati.clone());
                let via_spazio = StrategiaDonatori::SpazioLibero(candidati);
                let area = |s: &StrategiaDonatori| -> u32 {
                    cella_garantita(f, voluti.len(), s)
                        .map(|(w, h)| w as u32 * h as u32)
                        .unwrap_or(0)
                };
                let (a_lista, a_spazio) = (area(&via_lista), area(&via_spazio));
                if a_spazio > a_lista {
                    avvisi.push(format!(
                        "'{}': le celle dei simboli sacrificati sono troppo strette \
                         ({} px di area garantita), si disegna nello spazio libero della \
                         regione del font ({} px). I record sacrificati restano quelli, \
                         cambia solo dove finisce il disegno.",
                        f.name, a_lista, a_spazio
                    ));
                    via_spazio
                } else {
                    via_lista
                }
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
                    .celle(f, voluti.len())
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
        let (ammessi, avvisi) = donatori_latini(&dir, &f, 4, &[]);
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
        let (ammessi, avvisi) = donatori_latini(&dir, &f, 3, &[]);
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
            // ⛔ 16/08 sera: `(alt*3)/4` e' una STIMA della larghezza, e sul
            // referto dell'anteprima si e' visto che sbaglia in difetto — per
            // fnt_main da' 9 px mentre il glifo piu' largo ne vuole 12. Una
            // sonda che misura celle piu' strette di quelle che serviranno da
            // un numero ottimista, ed e' la terza volta che un verificatore
            // guarda una cosa leggermente diversa da quella che decide.
            // Quindi non un numero solo: la CURVA su piu' larghezze, cosi' si
            // legge dove sta il ginocchio invece di fidarsi di una stima.
            let stima_w = ((alt * 3) / 4).max(1) as usize;
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
            // Limite INFERIORE: se dice 12, sono almeno 12.
            let conta_celle = |serve_w: usize| -> usize {
                if serve_w == 0 || serve_h == 0 || serve_w > w || serve_h > h {
                    return 0;
                }
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
                libere
            };

            // Senza forzati: la sonda misura la situazione DI PARTENZA, quella
            // che ha dato 9 su 12. Sdoganare qui falserebbe la misura.
            let (ammessi, _) = donatori_latini(radice, f, 12, &[]);
            // ...e CON i tre sdoganati, che e' la situazione reale da stasera:
            // SpazioLibero ha bisogno di 12 RECORD per avere gli slot, e senza
            // la leva restano 9.
            let (con_leva, _) = donatori_latini(radice, f, 12, &['|', '\\', '_']);

            // La curva: la stima storica, poi larghezze crescenti fino oltre
            // quella che l'anteprima ha dichiarato necessaria (12 px per
            // fnt_main). Serve a vedere DOVE si rompe, non se si rompe.
            let mut curva = String::new();
            for lw in [stima_w, 10, 12, 14, 16] {
                curva.push_str(&format!(" {lw}x{serve_h}:{}", conta_celle(lw)));
            }

            eprintln!(
                "{:<14} regione {:>3}x{:<3} maiuscole {:>2}px  \
                 pixel liberi {:>5}/{:<6} record {:>2} (con leva {:>2})  celle libere →{}",
                f.name,
                w,
                h,
                alt,
                pixel_liberi,
                w * h,
                ammessi.len(),
                con_leva.len(),
                curva
            );
        }
    }

    /// SONDA ADR-006, quarto tentativo — la regressione delle R (17/08).
    ///
    /// La patch che porta gli accenti a schermo disegna anche un trattino in
    /// alto a destra su ogni R e ogni ?. `occupazione()` costruisce la mappa
    /// dei pixel occupati dai SOLI glifi del font che sta trattando, e
    /// `applica()` dichiara il presupposto per iscritto: «le celle libere non
    /// si sovrappongono a nessun glifo per costruzione». Il presupposto vale
    /// solo se la regione TPAG di quel font non ospita glifi di NESSUN altro
    /// font — e la texture #24 di Deltarune ne ospita nove, senza che nessuno
    /// abbia mai misurato se i loro riquadri si toccano.
    ///
    /// Due misure, entrambe in coordinate ASSOLUTE della texture:
    /// (1) le intersezioni fra i rettangoli TPAG, a coppie, per texture;
    /// (2) per ogni font, i glifi DEGLI ALTRI font che cadono dentro la sua
    ///     regione — perche' due regioni possono toccarsi in una striscia
    ///     vuota (innocuo) o proprio dove vivono le lettere (il trattino).
    /// La seconda misura e' quella che decide: se dentro la regione di
    /// fnt_main vivono glifi altrui, `occupazione()` deve nascere dai glifi
    /// di TUTTI i font della texture, non da quelli di uno solo.
    ///
    /// Sola lettura, niente gioco acceso, nessuna scrittura.
    ///
    /// ```text
    /// GS_GM_GAME_DIR="C:/.../DELTARUNEdemo" \
    ///   cargo test misura_sovrapposizioni_tpag -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore = "richiede GS_GM_GAME_DIR con la cartella di un gioco reale"]
    fn misura_sovrapposizioni_tpag_fra_font_della_stessa_texture() {
        let dir = match std::env::var("GS_GM_GAME_DIR") {
            Ok(d) => d,
            _ => return,
        };
        let percorso = find_data_win(&dir).expect("data.win non trovato");
        let dati = fs::read(&percorso).expect("lettura data.win");
        let font = gm_font::leggi_font(&dati).expect("chunk FONT");

        // Rettangolo assoluto della regione: (x0, y0, x1, y1), estremi esclusi.
        let rett = |t: &gm_font::Tpag| -> (u32, u32, u32, u32) {
            (
                t.source_x as u32,
                t.source_y as u32,
                t.source_x as u32 + t.source_w as u32,
                t.source_y as u32 + t.source_h as u32,
            )
        };
        let interseca = |a: (u32, u32, u32, u32), b: (u32, u32, u32, u32)| -> Option<(u32, u32)> {
            let w = a.2.min(b.2).saturating_sub(a.0.max(b.0));
            let h = a.3.min(b.3).saturating_sub(a.1.max(b.1));
            (w > 0 && h > 0).then_some((w, h))
        };

        let mut textures: Vec<i16> = font
            .iter()
            .filter_map(|f| f.tpag.as_ref().map(|t| t.texture_index))
            .collect();
        textures.sort_unstable();
        textures.dedup();

        let mut coppie_sovrapposte = 0usize;
        for tx in &textures {
            let su_questa: Vec<&Font> = font
                .iter()
                .filter(|f| f.tpag.as_ref().map(|t| t.texture_index) == Some(*tx))
                .collect();
            eprintln!("── texture #{tx}: {} font ──", su_questa.len());

            // (1) Intersezioni fra i riquadri, a coppie.
            for (i, a) in su_questa.iter().enumerate() {
                for b in su_questa.iter().skip(i + 1) {
                    let (ta, tb) = (a.tpag.as_ref().unwrap(), b.tpag.as_ref().unwrap());
                    if let Some((w, h)) = interseca(rett(ta), rett(tb)) {
                        coppie_sovrapposte += 1;
                        eprintln!(
                            "  ⛔ SOVRAPPOSTE {:<14} {:<14} area comune {}x{} px \
                             ({} a ({},{}) {}x{} · {} a ({},{}) {}x{})",
                            a.name, b.name, w, h,
                            a.name, ta.source_x, ta.source_y, ta.source_w, ta.source_h,
                            b.name, tb.source_x, tb.source_y, tb.source_w, tb.source_h,
                        );
                    }
                }
            }

            // (2) Glifi ALTRUI dentro la regione di ciascun font: la misura
            // che decide, perche' e' l'occupazione vera che manca alla mappa.
            for f in &su_questa {
                let t = f.tpag.as_ref().unwrap();
                let rf = rett(t);
                let mut intrusi = 0usize;
                let mut esempi: Vec<String> = Vec::new();
                for altro in su_questa.iter().filter(|o| o.offset != f.offset) {
                    for g in &altro.glyphs {
                        let Some((ax, ay)) = altro.posizione_assoluta(g) else { continue };
                        let rg = (
                            ax as u32,
                            ay as u32,
                            ax as u32 + g.source_w as u32,
                            ay as u32 + g.source_h as u32,
                        );
                        if interseca(rf, rg).is_some() {
                            intrusi += 1;
                            if esempi.len() < 4 {
                                esempi.push(format!(
                                    "{}:U+{:04X}@({},{})",
                                    altro.name, g.character, ax, ay
                                ));
                            }
                        }
                    }
                }
                if intrusi > 0 {
                    eprintln!(
                        "  ⛔ {:<14} ospita {:>4} glifi ALTRUI nella sua regione — es. {}",
                        f.name, intrusi, esempi.join(" · ")
                    );
                } else {
                    eprintln!("  ✅ {:<14} regione senza glifi altrui", f.name);
                }
            }
        }
        eprintln!(
            "TOTALE: {} coppie di regioni sovrapposte su {} texture — \
             se > 0, occupazione() deve nascere dai glifi di TUTTI i font della texture",
            coppie_sovrapposte,
            textures.len()
        );
    }

    /// SONDA ADR-006, quinto tentativo — chi ha scritto dentro la cella della R?
    ///
    /// La sonda delle sovrapposizioni ha dato ZERO su tutta la linea: nessuna
    /// regione si tocca, nessun glifo altrui dentro le regioni. Le due ipotesi
    /// di ieri sera sono morte entrambe, quindi la collisione e' DENTRO il
    /// font, e resta un sospettato solo con due facce: (a) la patch attuale
    /// scrive davvero dentro celle che crede libere, oppure (b) la copia
    /// provata in-game era gia' passata sotto la versione VECCHIA di
    /// `applica` — quella che scriveva solo i pixel accesi — e il trattino e'
    /// un RESIDUO («le copie di prova non sono piu' affidabili», 17/08 notte).
    ///
    /// Questa sonda distingue le due facce senza accendere il gioco.
    /// Confronta un data.win ORIGINALE di storia nota con la copia PATCHATA:
    /// (1) dentro ogni font patchato, i rettangoli dei glifi si sovrappongono
    ///     fra loro? (in coordinate assolute — se si', e' la faccia (a) ed
    ///     ecco le coppie);
    /// (2) per ogni glifo che NON e' stato toccato dal piano (stesso
    ///     carattere, stesso rettangolo che nell'originale), i pixel della
    ///     sua cella sono IDENTICI all'originale? Se la cella della R
    ///     differisce, la faccia (a) ha le coordinate esatte dell'intruso;
    ///     se e' identica ma in-game il trattino c'e', la copia provata non
    ///     era figlia di questo file — faccia (b).
    ///
    /// Sola lettura su entrambi i file.
    ///
    /// ```text
    /// GS_GM_GAME_DIR="C:/.../DELTARUNEdemo" \
    /// GS_GM_APPLY_DIR="G:/prove/DELTARUNEcopia" \
    ///   cargo test verifica_pixel_dopo_patch -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore = "richiede GS_GM_GAME_DIR (originale) e GS_GM_APPLY_DIR (copia patchata)"]
    fn verifica_pixel_dopo_patch_cella_per_cella() {
        let (Ok(dir_orig), Ok(dir_patch)) =
            (std::env::var("GS_GM_GAME_DIR"), std::env::var("GS_GM_APPLY_DIR"))
        else {
            return;
        };
        let leggi_tutto = |dir: &str| {
            let percorso = find_data_win(dir).expect("data.win non trovato");
            let dati = fs::read(&percorso).expect("lettura data.win");
            let font = gm_font::leggi_font(&dati).expect("chunk FONT");
            let texture = gm_texture::elenca_texture(&dati);
            (dati, font, texture)
        };
        let (dati_o, font_o, tex_o) = leggi_tutto(&dir_orig);
        let (dati_p, font_p, tex_p) = leggi_tutto(&dir_patch);

        // Le texture si decodificano una volta sola per indice, per file.
        let mut cache: HashMap<(bool, usize), gm_texture::GmTexture> = HashMap::new();
        let mut decodifica = |patchata: bool, idx: usize| -> Option<gm_texture::GmTexture> {
            if let Some(t) = cache.get(&(patchata, idx)) {
                return Some(t.clone());
            }
            let (dati, elenco) = if patchata { (&dati_p, &tex_p) } else { (&dati_o, &tex_o) };
            let tx = elenco.get(idx)?;
            let letta = gm_texture::leggi(&dati[tx.offset..tx.offset + tx.spazio]).ok()?;
            cache.insert((patchata, idx), letta.clone());
            cache.get(&(patchata, idx)).cloned()
        };

        let mut celle_cambiate = 0usize;
        let mut sovrapposizioni = 0usize;

        for fp in &font_p {
            let Some(fo) = font_o.iter().find(|f| f.name == fp.name) else {
                eprintln!("{}: non esiste nell'originale, salto", fp.name);
                continue;
            };
            let Some(tp) = fp.tpag.as_ref() else { continue };

            // Il rettangolo assoluto di ogni glifo del font patchato.
            let assoluto = |f: &Font, g: &gm_font::Glyph| -> Option<(u32, u32, u32, u32)> {
                let (ax, ay) = f.posizione_assoluta(g)?;
                Some((
                    ax as u32,
                    ay as u32,
                    ax as u32 + g.source_w as u32,
                    ay as u32 + g.source_h as u32,
                ))
            };

            // (1) Sovrapposizioni FRA glifi dello stesso font patchato.
            // Larghezza zero non interseca niente per costruzione (lo spazio).
            for (i, a) in fp.glyphs.iter().enumerate() {
                for b in fp.glyphs.iter().skip(i + 1) {
                    let (Some(ra), Some(rb)) = (assoluto(fp, a), assoluto(fp, b)) else {
                        continue;
                    };
                    let w = ra.2.min(rb.2).saturating_sub(ra.0.max(rb.0));
                    let h = ra.3.min(rb.3).saturating_sub(ra.1.max(rb.1));
                    if w > 0 && h > 0 {
                        sovrapposizioni += 1;
                        eprintln!(
                            "  ⛔ {}: U+{:04X} '{}' e U+{:04X} '{}' si SOVRAPPONGONO \
                             per {}x{} px (celle a ({},{}) e ({},{}))",
                            fp.name,
                            a.character,
                            char::from_u32(a.character as u32).unwrap_or('?'),
                            b.character,
                            char::from_u32(b.character as u32).unwrap_or('?'),
                            w, h, ra.0, ra.1, rb.0, rb.1,
                        );
                    }
                }
            }

            // (2) Pixel identici nelle celle NON toccate dal piano.
            let orig_per_char: HashMap<u16, &gm_font::Glyph> =
                fo.glyphs.iter().map(|g| (g.character, g)).collect();
            let (Some(io), Some(ip)) = (
                fo.tpag.as_ref().map(|t| t.texture_index.max(0) as usize),
                Some(tp.texture_index.max(0) as usize),
            ) else {
                continue;
            };
            let (Some(txo), Some(txp)) = (decodifica(false, io), decodifica(true, ip)) else {
                eprintln!("  {}: texture non decodificabile, pixel non confrontati", fp.name);
                continue;
            };

            let (mut invariati, mut toccati) = (0usize, 0usize);
            for g in &fp.glyphs {
                let identico_rect = orig_per_char.get(&g.character).is_some_and(|o| {
                    (o.source_x, o.source_y, o.source_w, o.source_h)
                        == (g.source_x, g.source_y, g.source_w, g.source_h)
                });
                if !identico_rect {
                    // Iniettato, ricollocato o sacrificato: il piano DOVEVA
                    // toccarlo, il confronto non lo giudica — ma DICE chi e':
                    // i codepoint toccati sono la firma di QUALE patch ha
                    // generato questo file (accenti latini = SpazioLibero,
                    // cirillico = la via russa di luglio, kanji = donatori).
                    toccati += 1;
                    let orig = orig_per_char.get(&g.character);
                    eprintln!(
                        "  ◐ {}: U+{:04X} '{}' TOCCATO dal piano — rect ora ({},{}) {}x{}{}",
                        fp.name,
                        g.character,
                        char::from_u32(g.character as u32).unwrap_or('?'),
                        g.source_x, g.source_y, g.source_w, g.source_h,
                        match orig {
                            Some(o) => format!(
                                ", nell'originale era ({},{}) {}x{}",
                                o.source_x, o.source_y, o.source_w, o.source_h
                            ),
                            None => ", ASSENTE nell'originale (iniettato)".into(),
                        },
                    );
                    continue;
                }
                invariati += 1;
                let Some((ax, ay)) = fp.posizione_assoluta(g) else { continue };
                let mut diversi = 0usize;
                let mut primo: Option<(u16, u16)> = None;
                for dy in 0..g.source_h {
                    for dx in 0..g.source_w {
                        let (x, y) = (ax + dx, ay + dy);
                        if txo.image.get_pixel(x, y) != txp.image.get_pixel(x, y) {
                            diversi += 1;
                            primo.get_or_insert((x, y));
                        }
                    }
                }
                if diversi > 0 {
                    celle_cambiate += 1;
                    eprintln!(
                        "  ⛔ {}: U+{:04X} '{}' NON era nel piano ma la sua cella e' \
                         CAMBIATA — {} px diversi, il primo a ({},{}) (cella a ({},{}) {}x{})",
                        fp.name,
                        g.character,
                        char::from_u32(g.character as u32).unwrap_or('?'),
                        diversi,
                        primo.unwrap().0,
                        primo.unwrap().1,
                        ax, ay, g.source_w, g.source_h,
                    );
                }
            }
            eprintln!(
                "  {} — glifi invariati {} (celle confrontate pixel per pixel), \
                 toccati dal piano {}",
                fp.name, invariati, toccati
            );
        }

        eprintln!(
            "VERDETTO: {} sovrapposizioni intra-font, {} celle fuori piano cambiate. \
             Entrambi zero + trattino in-game = la copia provata era sporca (faccia b): \
             si riparte da un data.win di storia nota. Uno dei due > 0 = il bug e' \
             VIVO nella patch attuale (faccia a), e le righe qui sopra dicono dove.",
            sovrapposizioni, celle_cambiate
        );
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
        let (ammessi, avvisi) = donatori_latini(&dir, &f, 1, &[]);

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

    /// La scelta fra le due vie si fa CONFRONTANDO, non per abitudine.
    ///
    /// Con celle donatrici strette (il caso `fnt_main`: 3x5) lo spazio libero
    /// deve vincere; con celle generose deve vincere la via classica, che non
    /// muove niente ed e' quella provata in-game. Il secondo verso e' la meta'
    /// che si salta: senza, «spazio libero sempre» passerebbe questo test.
    #[test]
    fn si_sceglie_la_via_che_offre_la_cella_piu_grande() {
        let candidati: Vec<u16> = "|{}@".chars().map(|c| c as u16).collect();
        // Regione 128x128 come quella vera di fnt_main. Senza TPAG lo spazio
        // libero non e' misurabile e la via nuova risulterebbe sempre perdente:
        // il test direbbe "va bene" senza aver provato niente.
        let regione = || {
            Some(gm_font::Tpag {
                offset: 0,
                source_x: 0,
                source_y: 0,
                source_w: 128,
                source_h: 128,
                target_x: 0,
                target_y: 0,
                target_w: 128,
                target_h: 128,
                bounding_w: 128,
                bounding_h: 128,
                texture_index: 24,
            })
        };

        // Celle strette in una regione con molto vuoto sotto.
        let mut stretto = font_latino("fnt_main", "|{}@");
        stretto.tpag = regione();
        for (i, g) in stretto.glyphs.iter_mut().enumerate() {
            g.source_x = i as u16 * 3;
            g.source_y = 0;
            g.source_w = 3;
            g.source_h = 5;
        }
        let area = |f: &Font, s: &StrategiaDonatori| {
            cella_garantita(f, 4, s).map(|(w, h)| w as u32 * h as u32).unwrap_or(0)
        };
        assert!(
            area(&stretto, &StrategiaDonatori::SpazioLibero(candidati.clone()))
                > area(&stretto, &StrategiaDonatori::Lista(candidati.clone())),
            "con celle 3x5 lo spazio libero deve offrire piu' area"
        );

        // Celle generose: la via classica non va scavalcata.
        let mut generoso = font_latino("fnt_main", "|{}@");
        generoso.tpag = regione();
        for (i, g) in generoso.glyphs.iter_mut().enumerate() {
            g.source_x = i as u16 * 32;
            g.source_y = 0;
            g.source_w = 32;
            g.source_h = 64;
        }
        assert!(
            area(&generoso, &StrategiaDonatori::Lista(candidati.clone()))
                >= area(&generoso, &StrategiaDonatori::SpazioLibero(candidati)),
            "con celle 32x64 la via classica, che non sposta niente, deve restare la scelta"
        );
    }

    /// I sei candidati aggiunti il 16/08 stanno IN CODA: allargano le
    /// possibilita' senza spostare quali celle si sacrificano per prime.
    /// Se qualcuno li mettesse in testa, questo test diventa rosso — ed e'
    /// il punto: l'ordine storico e' gia' stato misurato sul gioco vero.
    #[test]
    fn i_candidati_nuovi_stanno_in_coda() {
        let storici = ['|', '{', '}', '@', '~', '\\', '`', '^', '_', '=', '<', '>', '#', '$', ';'];
        assert_eq!(
            &CANDIDATI_LATINI[..storici.len()],
            &storici[..],
            "i primi quindici candidati sono gia' stati misurati: non si riordinano"
        );
        for c in ['+', '*', '[', ']', '(', ')'] {
            assert!(
                CANDIDATI_LATINI.contains(&c),
                "'{c}' doveva entrare fra i candidati (gap donatori 9→12)"
            );
        }
    }

    /// Il cuore della leva: un simbolo che il gioco DISEGNA resta escluso, e
    /// diventa donatore SOLO se l'utente lo chiede — con l'esempio della
    /// stringa che perdera' il disegno scritto nell'avviso.
    ///
    /// Controllo in entrambe le direzioni nello stesso test: senza forzati
    /// deve restare fuori. Un test che prova solo il caso «acceso» non
    /// distingue una leva che funziona da una costante cablata.
    #[test]
    fn i_forzati_entrano_solo_se_richiesti_e_vengono_dichiarati() {
        let dir = std::env::temp_dir()
            .join(format!("gs_donatori_forzati_{}", std::process::id()));
        let lang = dir.join("lang");
        fs::create_dir_all(&lang).unwrap();
        // `_` compare in una stringa TECNICA (il caso Deltarune), `@` in un
        // testo che il giocatore legge davvero.
        fs::write(
            lang.join("lang_en.json"),
            r#"{"a":"vista_xvista: 3","b":"Write to mail@example.com"}"#,
        )
        .unwrap();

        let f = font_latino("fnt_main", "|_@");

        // SENZA forzati: `_` e `@` restano fuori, resta solo `|`.
        let (soli, _) = donatori_latini(&dir, &f, 3, &[]);
        assert_eq!(
            soli,
            vec![u16::from(b'|')],
            "senza sdoganamento, un simbolo disegnato NON deve entrare"
        );

        // CON `_` sdoganato: entra, ma DOPO gli ammissibili gratuiti.
        let (con, avvisi) = donatori_latini(&dir, &f, 3, &['_']);
        fs::remove_dir_all(&dir).ok();
        assert_eq!(
            con,
            vec![u16::from(b'|'), u16::from(b'_')],
            "il forzato va in coda: prima si spende cio' che non costa niente"
        );
        // `@` non era fra i forzati: resta escluso anche ora.
        assert!(
            !con.contains(&u16::from(b'@')),
            "sdoganare `_` non deve sdoganare anche gli altri: {con:?}"
        );
        // Il prezzo va DETTO, con la stringa che lo paga.
        assert!(
            avvisi.iter().any(|a| a.contains("SU TUA RICHIESTA")
                && a.contains('_')
                && a.contains("vista_xvista")),
            "il sacrificio forzato non e' dichiarato con l'esempio: {avvisi:?}"
        );
    }

    /// Sdoganare un simbolo che non serviva non deve passare in silenzio:
    /// l'utente crederebbe di aver pagato un prezzo che non ha pagato, e
    /// potrebbe sdoganarne altri pensando che il primo non sia bastato.
    #[test]
    fn i_forzati_inutili_vengono_detti() {
        let dir = std::env::temp_dir()
            .join(format!("gs_forzati_inutili_{}", std::process::id()));
        let lang = dir.join("lang");
        fs::create_dir_all(&lang).unwrap();
        fs::write(lang.join("lang_en.json"), r#"{"a":"HELLO WORLD"}"#).unwrap();

        // Il font ha `|` (candidato, non disegnato) e `!` (NON candidato).
        let f = font_latino("fnt_main", "|!");
        // Tre casi diversi in una chiamata: `|` era gia' ammissibile, `{` il
        // font non ce l'ha, `!` non e' nemmeno un candidato. Se i tre motivi
        // non fossero distinti, uno di questi verrebbe descritto male — ed e'
        // il caso `!` che si prende la spiegazione sbagliata, perche' il font
        // LO POSSIEDE e senza il primo ramo passerebbe per «gia' ammissibile».
        let (ammessi, avvisi) = donatori_latini(&dir, &f, 1, &['|', '{', '!']);
        fs::remove_dir_all(&dir).ok();

        assert_eq!(ammessi, vec![u16::from(b'|')], "nessun doppione in lista");
        let inutili = avvisi
            .iter()
            .find(|a| a.contains("senza effetto"))
            .unwrap_or_else(|| panic!("gli sdoganamenti inutili non sono dichiarati: {avvisi:?}"));
        assert!(inutili.contains("gia' ammissibile"), "manca il motivo di `|`: {inutili}");
        assert!(inutili.contains("non ha questa cella"), "manca il motivo di `{{`: {inutili}");
        assert!(
            inutili.contains("non e' fra i candidati"),
            "`!` non e' un candidato e il motivo dev'essere QUELLO, non un altro: {inutili}"
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
            None,
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
        let mut totale_trovate = 0usize;

        // ⛔ 17/08: qui c'erano SOLO fnt_ja_main e fnt_ja_small, cablati.
        // Erano il bersaglio di luglio; da quando la traduzione vive nello
        // slot inglese il bersaglio sono i font LATINI, e questo export —
        // chiamato apposta per diagnosticare le «R» rovinate su fnt_main —
        // ha risposto parlando d'altro senza dirlo. Quarta volta in questa
        // vicenda che un verificatore guarda accanto al problema.
        // Ora si esportano TUTTI i font che hanno una regione, e il nome del
        // file dice quale.
        for f in font.iter() {
            let nome = f.name.as_str();
            // Tollerante: prima qui c'erano due font scelti a mano e il TPAG
            // c'era per forza. Ora si passa su tutti, e un font senza regione
            // si salta dicendolo invece di abbattere l'export.
            let Some(t) = f.tpag.as_ref() else {
                eprintln!("  {nome}: senza TPAG, non esportabile");
                continue;
            };
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
            // Non si pretende piu' che OGNI font ne abbia: ora si passa su
            // tutti, e un font senza lettere e' un'informazione — proprio
            // quella che serve a capire dove la patch non e' arrivata. Il
            // controllo che il lavoro sia stato fatto sta in fondo.
            totale_trovate += trovate;
        }
        eprintln!("PNG in: {:?}", out.canonicalize().unwrap_or(out.clone()));
        assert!(
            totale_trovate > 0,
            "nessuna lettera iniettata in nessun font: il data.win non e' patchato"
        );
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
        // GS_GM_DONATORI sdogana simboli che il gioco disegna (su Deltarune
        // `|\_`, che vengono da stringhe tecniche): assente = comportamento
        // di sempre, cosi' la prova senza la leva resta possibile.
        let forzati = std::env::var("GS_GM_DONATORI").ok();
        if let Some(f) = &forzati {
            eprintln!("donatori sdoganati dall'utente: {f}");
        }
        let esito = gm_inject_glyphs(dir, vec![], "àèéìòùÀÈÉÌÒÙ".into(), ttf, true, forzati)
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
        // GS_GM_DONATORI = i simboli sdoganati (es. `|\_` su Deltarune, che
        // vengono da stringhe tecniche). Assente = la misura di partenza,
        // quella che il 16/08 ha dato 9 donatori dove ne servivano 12.
        let forzati = std::env::var("GS_GM_DONATORI").ok();
        if let Some(f) = &forzati {
            eprintln!("donatori sdoganati dall'utente: {f}");
        }
        let esito = gm_inject_glyphs(dir, vec![], "àèéìòùÀÈÉÌÒÙ".into(), ttf, false, forzati)
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
