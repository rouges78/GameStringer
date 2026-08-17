//! Iniezione di glifi in un font GameMaker: scelta dei donatori e disegno.
//!
//! Quarto strato di ADR-005, sopra [`gm_qoi`](crate::commands::gm_qoi) (pixel),
//! [`gm_texture`](crate::commands::gm_texture) (contenitore) e
//! [`gm_font`](crate::commands::gm_font) (tabella).
//!
//! # Cosa fa, in una riga
//!
//! Prende delle lettere che il font non ha, sceglie altrettanti glifi che non
//! servono (i kanji, per chi installa una patch russa o italiana), **riscrive i
//! loro pixel** nell'atlante e **cambia il loro codepoint** nella tabella.
//! Niente cambia dimensione, quindi nessun offset del `data.win` si sposta.
//!
//! # Cosa NON fa
//!
//! Non rasterizza: le immagini dei glifi arrivano già pronte come [`Bitmap`]
//! binarie. È deliberato — la sorgente (un TTF via `font_installer`, o bitmap
//! disegnate a mano per rispettare uno stile pixel-art) è una scelta che
//! cambierà, e non deve trascinarsi dietro il resto.
//!
//! E non scrive su disco: [`applica`] lavora su un atlante in memoria e su una
//! copia dei byte del `data.win`. Ricomprimere, verificare il budget e salvare
//! con backup sono compiti del comando Tauri, ancora da scrivere.
//!
//! # I tre vincoli che governano tutto
//!
//! 1. **Il glifo nuovo deve stare nella cella del donatore.** Non si può
//!    allargare un rettangolo senza spostare i vicini nell'atlante.
//! 2. **I pixel sono bicolore**, `[0,0,0,0]` o `[255,255,255,255]`: niente
//!    antialiasing. Scriverli sfumati fa crescere il blob compresso oltre il
//!    budget — misurato, +4.256 byte (ADR-005, verifica del 26/07).
//! 3. **Le coordinate dei glifi sono relative alla regione TPAG**, non alla
//!    texture. Qui si usa sempre [`gm_font::Font::posizione_assoluta`].

#![allow(dead_code)]

use crate::commands::gm_font::{self, Font, Glyph};
use crate::commands::gm_qoi::GmImage;

/// Pixel acceso e pixel spento nell'atlante. Non ci sono valori intermedi.
const ACCESO: [u8; 4] = [255, 255, 255, 255];
const SPENTO: [u8; 4] = [0, 0, 0, 0];

// ── Tipi ──

/// Immagine binaria di un glifo: `on[y * w + x]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bitmap {
    pub w: u16,
    pub h: u16,
    pub on: Vec<bool>,
}

impl Bitmap {
    pub fn nuova(w: u16, h: u16) -> Self {
        Self { w, h, on: vec![false; w as usize * h as usize] }
    }

    pub fn set(&mut self, x: u16, y: u16, acceso: bool) {
        if x < self.w && y < self.h {
            let i = y as usize * self.w as usize + x as usize;
            self.on[i] = acceso;
        }
    }

    pub fn get(&self, x: u16, y: u16) -> bool {
        if x >= self.w || y >= self.h {
            return false;
        }
        self.on[y as usize * self.w as usize + x as usize]
    }

    /// Quanti pixel accesi: serve a scartare i glifi vuoti.
    pub fn accesi(&self) -> usize {
        self.on.iter().filter(|&&b| b).count()
    }
}

/// Una lettera da aggiungere al font.
#[derive(Debug, Clone)]
pub struct Richiesta {
    /// Codepoint che il glifo dovrà avere (es. 0x0410 per А, 0x00E0 per à).
    pub carattere: u16,
    pub bitmap: Bitmap,
    /// Quanto avanzare dopo averlo disegnato. Se `None` si usa
    /// `bitmap.w + 1`, che è la convenzione dei font bitmap di GameMaker.
    pub shift: Option<i16>,
}

/// Cosa si intende fare, prima di farlo.
///
/// Il piano si calcola e si ispeziona **senza toccare niente**: e' l'unico
/// modo di sapere in anticipo se l'operazione e' realizzabile.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Piano {
    /// `(indice del glifo donatore, indice della richiesta)`.
    pub assegnazioni: Vec<(usize, usize)>,
    /// Donatori rimasti, da svuotare per liberare spazio compresso.
    ///
    /// E' la "strategia B" di ADR-005: togliere transizioni al disegno riduce
    /// il blob molto piu' di quanto lo riduca togliere pixel accesi.
    pub da_svuotare: Vec<usize>,
    /// `(indice del glifo, nuova origine relativa alla regione TPAG)`.
    ///
    /// **Vuoto in tutti i piani storici**, e deve restarlo: il percorso kanji
    /// e' provato in-game e li' vale il vincolo n. 1 di questo modulo — il
    /// glifo nuovo sta nella cella del donatore, che non si muove.
    ///
    /// Si popola SOLO con [`pianifica_su_spazio_libero`], scritta il 16/08 per
    /// i font latini: li' le celle dei simboli sacrificabili sono minuscole
    /// (misurato su `fnt_main` di Deltarune: 3x5 px contro le 12x16 che
    /// servono), mentre dentro la stessa regione TPAG c'e' spazio VUOTO in
    /// abbondanza. Si sacrifica il record per avere lo slot nella tabella, ma
    /// il suo rettangolo si riscrive su una cella libera abbastanza capiente.
    ///
    /// Resta dentro la regione del font: le coordinate dei glifi sono relative
    /// all'origine TPAG e senza segno, quindi una cella interna e' sempre
    /// raggiungibile e nessun renderer taglia ai bordi di qualcosa che non
    /// abbiamo attraversato.
    pub ricollocati: Vec<(usize, u16, u16)>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Errore {
    /// Il font non ha la regione TPAG: senza, non si sa dove disegnare.
    TpagAssente,
    /// Non ci sono abbastanza celle libere e capienti.
    ///
    /// Porta con se' le misure che servono a capire il perche': senza sapere
    /// quanto era grande il glifo che non entrava e quanto e' la cella piu'
    /// capiente, "trovate 0" su un font con 1.296 kanji non e' una diagnosi.
    DonatoriInsufficienti {
        servono: usize,
        trovati: usize,
        /// Dimensione del glifo che non ha trovato posto.
        serviva: (u16, u16),
        /// La cella libera piu' capiente rimasta.
        cella_piu_grande: (u16, u16),
    },
    /// Una lettera richiesta esiste gia' nel font: sovrascriverla sarebbe un
    /// errore silenzioso.
    CarattereGiaPresente { carattere: u16 },
    /// Nella regione TPAG non c'e' abbastanza spazio VUOTO per le lettere.
    ///
    /// Distinta da [`Errore::DonatoriInsufficienti`] di proposito: li' mancano
    /// i record da sacrificare, qui manca il posto dove disegnare. Sono due
    /// rimedi diversi — allargare i candidati contro cambiare font — e un
    /// errore solo per due cause manda a lavorare dalla parte sbagliata.
    SpazioLiberoInsufficiente {
        servono: usize,
        collocate: usize,
        /// Dimensione della lettera che non ha trovato posto.
        serviva: (u16, u16),
        /// La regione del font, per capire se il problema e' lo spazio o la
        /// frammentazione (su `fnt_dotumche`: 7.505 pixel liberi su 16.384 e
        /// UNA sola cella 12x17 — spazio c'e', contiguo no).
        regione: (u16, u16),
        pixel_liberi: usize,
    },
    /// La bitmap non entra nella cella assegnata.
    BitmapTroppoGrande { carattere: u16, bitmap: (u16, u16), cella: (u16, u16) },
    /// La cella cade fuori dall'atlante.
    CellaFuoriDallAtlante { carattere: u16, x: u16, y: u16 },
    /// La lista puntatori dei glifi non combacia col buffer: il riordino
    /// post-iniezione (obbligatorio: il runtime fa ricerca binaria) non è
    /// applicabile in sicurezza.
    TabellaGlifiIncoerente { font: String },
}

impl std::fmt::Display for Errore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TpagAssente => write!(f, "il font non ha una regione TPAG: non si sa dove disegnare"),
            Self::DonatoriInsufficienti { servono, trovati, serviva, cella_piu_grande } => write!(
                f,
                "servivano {servono} celle riusabili, assegnate {trovati}: un glifo di {}x{} px \
                 non entra nella cella libera piu' grande, che e' {}x{} px. \
                 Rimpicciolire i glifi, o allargare l'insieme dei donatori",
                serviva.0, serviva.1, cella_piu_grande.0, cella_piu_grande.1
            ),
            Self::CarattereGiaPresente { carattere } => write!(
                f,
                "il font contiene gia' il carattere U+{carattere:04X}: non lo si sovrascrive"
            ),
            Self::SpazioLiberoInsufficiente {
                servono, collocate, serviva, regione, pixel_liberi,
            } => write!(
                f,
                "servivano {servono} celle libere nella regione del font, collocate {collocate}: \
                 un glifo di {}x{} px non trova spazio vuoto contiguo. La regione e' {}x{} px con \
                 {pixel_liberi} pixel liberi — se sono molti, il problema e' la frammentazione, \
                 non lo spazio",
                serviva.0, serviva.1, regione.0, regione.1
            ),
            Self::BitmapTroppoGrande { carattere, bitmap, cella } => write!(
                f,
                "U+{carattere:04X}: il glifo e' {}x{} ma la cella e' {}x{}",
                bitmap.0, bitmap.1, cella.0, cella.1
            ),
            Self::CellaFuoriDallAtlante { carattere, x, y } => {
                write!(f, "U+{carattere:04X}: la cella a ({x}, {y}) cade fuori dall'atlante")
            }
            Self::TabellaGlifiIncoerente { font } => write!(
                f,
                "'{font}': la lista puntatori dei glifi non combacia col file, riordino non applicabile"
            ),
        }
    }
}

impl std::error::Error for Errore {}

// ── Pianificazione ──

/// Intervallo CJK unificato: i kanji, che sono i donatori naturali.
pub const KANJI: (u16, u16) = (0x4E00, 0x9FFF);

/// Sceglie quali glifi sacrificare per quali lettere.
///
/// I donatori si prendono nell'intervallo `donatori`, ordinati **dal piu'
/// grande al piu' piccolo**: cosi' le lettere trovano posto anche quando le
/// celle hanno dimensioni molto diverse, invece di esaurire le celle capienti
/// su glifi che non ne avevano bisogno.
///
/// `svuota_resto` mette in piano lo svuotamento dei donatori non usati.
pub fn pianifica(
    font: &Font,
    richieste: &[Richiesta],
    donatori: (u16, u16),
    svuota_resto: bool,
) -> Result<Piano, Errore> {
    // Firma e comportamento IDENTICI a prima del 16/08: il percorso kanji e'
    // provato in-game su Deltarune e non si tocca. Cambia solo la forma —
    // l'intervallo diventa un predicato, cosi' la stessa pianificazione serve
    // anche ai font latini, dove i donatori non sono un intervallo contiguo.
    pianifica_con_predicato(
        font,
        richieste,
        &|c| c >= donatori.0 && c <= donatori.1,
        svuota_resto,
    )
}

/// Come [`pianifica`], ma i donatori sono una **lista esplicita** di codepoint.
///
/// Serve ai font latini (16/08: la traduzione italiana di Deltarune vive nello
/// slot inglese, disegnato da `fnt_main` e soci, che non hanno kanji): li' non
/// esiste un intervallo di glifi sacrificabili, esistono i candidati misurati
/// sul corpus del gioco. Con `svuota_resto` si svuotano SOLO i candidati della
/// lista rimasti inutilizzati — gli altri glifi del font sono testo vivo e
/// nessuno deve toccarli.
pub fn pianifica_da_lista(
    font: &Font,
    richieste: &[Richiesta],
    candidati: &[u16],
    svuota_resto: bool,
) -> Result<Piano, Errore> {
    let insieme: std::collections::HashSet<u16> = candidati.iter().copied().collect();
    pianifica_con_predicato(font, richieste, &|c| insieme.contains(&c), svuota_resto)
}

/// Mappa dei pixel della regione TPAG occupati dai glifi del font.
///
/// «Occupato» qui significa *rivendicato da un glifo di questo font*, non
/// *acceso*: un glifo con dei pixel spenti dentro il suo rettangolo occupa lo
/// stesso tutta la cella, perche' il gioco continuera' a disegnarla. Guardare
/// i pixel accesi invece dei rettangoli sembrerebbe piu' generoso e sarebbe
/// sbagliato — si finirebbe a scrivere dentro la cella di una lettera viva.
fn occupazione(font: &Font) -> Option<(Vec<bool>, u16, u16)> {
    let t = font.tpag.as_ref()?;
    let (w, h) = (t.source_w as usize, t.source_h as usize);
    if w == 0 || h == 0 {
        return None;
    }
    let mut occ = vec![false; w * h];
    for g in &font.glyphs {
        for y in g.source_y..g.source_y.saturating_add(g.source_h) {
            for x in g.source_x..g.source_x.saturating_add(g.source_w) {
                let (x, y) = (x as usize, y as usize);
                if x < w && y < h {
                    occ[y * w + x] = true;
                }
            }
        }
    }
    Some((occ, t.source_w, t.source_h))
}

/// Cerca nella regione la prima cella libera `serve_w x serve_h` e la marca
/// come occupata, cosi' la chiamata successiva non la riassegna.
///
/// Scansione dall'alto a sinistra: deterministica, quindi due esecuzioni
/// identiche producono lo stesso file — invariante di tutto ADR-005.
fn prendi_cella_libera(
    occ: &mut [bool],
    w: u16,
    h: u16,
    serve_w: u16,
    serve_h: u16,
) -> Option<(u16, u16)> {
    if serve_w == 0 || serve_h == 0 || serve_w > w || serve_h > h {
        return None;
    }
    let (wu, hu) = (w as usize, h as usize);
    for y in 0..=(hu - serve_h as usize) {
        'x: for x in 0..=(wu - serve_w as usize) {
            for yy in y..y + serve_h as usize {
                for xx in x..x + serve_w as usize {
                    if occ[yy * wu + xx] {
                        continue 'x;
                    }
                }
            }
            for yy in y..y + serve_h as usize {
                for xx in x..x + serve_w as usize {
                    occ[yy * wu + xx] = true;
                }
            }
            return Some((x as u16, y as u16));
        }
    }
    None
}

/// Come [`pianifica_da_lista`], ma le lettere si disegnano nello **spazio
/// vuoto** della regione invece che nella cella del donatore.
///
/// # Perche' esiste (16/08/2026)
///
/// Sui font latini di Deltarune la via classica e' morta con un numero: i
/// simboli sacrificabili di `fnt_main` danno una cella garantita di **3x5 px**
/// mentre una maiuscola accentata ne vuole **12x16**. Aggiungere donatori
/// peggiora: la cella garantita e' la piu' PICCOLA di quelle scelte, e i
/// simboli piu' sdoganabili (`|`, `\`, `_`) sono i piu' stretti che esistano.
///
/// Nella stessa regione, pero', c'e' spazio vuoto: 9.430 pixel liberi su
/// 16.384, e undici celle 12x16. Quindi si tengono i record — servono per
/// avere gli slot nella tabella glifi, ed e' per questo che la leva dei
/// donatori sdoganati resta necessaria — ma si **riscrive il loro
/// rettangolo** su una cella libera capiente.
///
/// # Cosa NON cambia
///
/// Il numero di record, la lunghezza della tabella, la dimensione del file.
/// Si muove un rettangolo dentro una regione che il font gia' possiede.
pub fn pianifica_su_spazio_libero(
    font: &Font,
    richieste: &[Richiesta],
    candidati: &[u16],
    svuota_resto: bool,
) -> Result<Piano, Errore> {
    let Some((mut occ, w, h)) = occupazione(font) else {
        return Err(Errore::TpagAssente);
    };
    let pixel_liberi = occ.iter().filter(|&&o| !o).count();

    for r in richieste {
        if font.glifo(r.carattere).is_some() {
            return Err(Errore::CarattereGiaPresente { carattere: r.carattere });
        }
    }

    // I record da sacrificare. L'ordine per capienza qui non ha piu' un
    // effetto: la cella del donatore viene abbandonata e `occupazione` la
    // marca comunque occupata, quindi sacrificare un record largo o stretto
    // non cambia di un pixel lo spazio disponibile. Si conserva solo perche'
    // e' DETERMINISTICO — due esecuzioni identiche devono dare lo stesso file,
    // invariante di tutto ADR-005.
    // ⏸️ Miglioria possibile e non fatta: liberare nella mappa anche le celle
    // dei record sacrificati, che nessuno disegnera' piu'. Vale qualche cella
    // in piu' su font stretti, ma va misurata prima di scriverla.
    let insieme: std::collections::HashSet<u16> = candidati.iter().copied().collect();
    let mut disponibili: Vec<usize> = font
        .glyphs
        .iter()
        .enumerate()
        .filter(|(_, g)| insieme.contains(&g.character))
        .map(|(i, _)| i)
        .collect();
    disponibili.sort_by_key(|&i| {
        let g = &font.glyphs[i];
        std::cmp::Reverse((g.source_w as u32) * (g.source_h as u32))
    });

    if disponibili.len() < richieste.len() {
        let piu_grande = disponibili
            .iter()
            .map(|&i| (font.glyphs[i].source_w, font.glyphs[i].source_h))
            .max_by_key(|(w, h)| (*w as u32) * (*h as u32))
            .unwrap_or((0, 0));
        let serviva = richieste
            .iter()
            .map(|r| (r.bitmap.w, r.bitmap.h))
            .max_by_key(|(w, h)| (*w as u32) * (*h as u32))
            .unwrap_or((0, 0));
        return Err(Errore::DonatoriInsufficienti {
            servono: richieste.len(),
            trovati: disponibili.len(),
            serviva,
            cella_piu_grande: piu_grande,
        });
    }

    // Le lettere si collocano dalla piu' ingombrante: con celle di dimensioni
    // diverse e' l'ordine che fallisce piu' tardi possibile. Servirle in
    // ordine alfabetico esaurirebbe lo spazio buono sulle minuscole e
    // lascerebbe fuori le maiuscole accentate, che sono le piu' grandi.
    let mut ordine: Vec<usize> = (0..richieste.len()).collect();
    ordine.sort_by_key(|&i| {
        std::cmp::Reverse((richieste[i].bitmap.w as u32) * (richieste[i].bitmap.h as u32))
    });

    let mut assegnazioni = Vec::with_capacity(richieste.len());
    let mut ricollocati = Vec::with_capacity(richieste.len());
    let mut usati = vec![false; font.glyphs.len()];

    for (n, &ir) in ordine.iter().enumerate() {
        let b = &richieste[ir].bitmap;
        match prendi_cella_libera(&mut occ, w, h, b.w, b.h) {
            Some((x, y)) => {
                let ic = disponibili[n];
                usati[ic] = true;
                assegnazioni.push((ic, ir));
                ricollocati.push((ic, x, y));
            }
            None => {
                return Err(Errore::SpazioLiberoInsufficiente {
                    servono: richieste.len(),
                    collocate: assegnazioni.len(),
                    serviva: (b.w, b.h),
                    regione: (w, h),
                    pixel_liberi,
                });
            }
        }
    }

    let da_svuotare = if svuota_resto {
        disponibili.iter().copied().filter(|&i| !usati[i]).collect()
    } else {
        Vec::new()
    };

    assegnazioni.sort_unstable();
    ricollocati.sort_unstable();
    Ok(Piano { assegnazioni, da_svuotare, ricollocati })
}

/// L'implementazione vera: chi e' donatore lo decide il predicato.
///
/// L'ordinamento per capienza resta qui dentro (dal piu' grande al piu'
/// piccolo, con `sort_by_key` stabile): a parita' di area l'ordine dei glifi
/// nel font decide, quindi due esecuzioni identiche producono lo stesso piano.
fn pianifica_con_predicato(
    font: &Font,
    richieste: &[Richiesta],
    e_donatore: &dyn Fn(u16) -> bool,
    svuota_resto: bool,
) -> Result<Piano, Errore> {
    if font.tpag.is_none() {
        return Err(Errore::TpagAssente);
    }

    for r in richieste {
        if font.glifo(r.carattere).is_some() {
            return Err(Errore::CarattereGiaPresente { carattere: r.carattere });
        }
    }

    // Indici dei possibili donatori, dal piu' capiente al meno.
    let mut candidati: Vec<usize> = font
        .glyphs
        .iter()
        .enumerate()
        .filter(|(_, g)| e_donatore(g.character))
        .map(|(i, _)| i)
        .collect();
    candidati.sort_by_key(|&i| {
        let g = &font.glyphs[i];
        std::cmp::Reverse((g.source_w as u32) * (g.source_h as u32))
    });

    // Le richieste si servono dalla piu' ingombrante: e' l'accoppiamento che
    // fallisce piu' tardi possibile.
    let mut ordine: Vec<usize> = (0..richieste.len()).collect();
    ordine.sort_by_key(|&i| {
        std::cmp::Reverse((richieste[i].bitmap.w as u32) * (richieste[i].bitmap.h as u32))
    });

    let mut assegnazioni = Vec::with_capacity(richieste.len());
    let mut usati = vec![false; font.glyphs.len()];

    for &ir in &ordine {
        let b = &richieste[ir].bitmap;
        let scelto = candidati.iter().find(|&&ic| {
            !usati[ic] && font.glyphs[ic].source_w >= b.w && font.glyphs[ic].source_h >= b.h
        });
        match scelto {
            Some(&ic) => {
                usati[ic] = true;
                assegnazioni.push((ic, ir));
            }
            None => {
                let piu_grande = candidati
                    .iter()
                    .filter(|&&ic| !usati[ic])
                    .map(|&ic| (font.glyphs[ic].source_w, font.glyphs[ic].source_h))
                    .max_by_key(|(w, h)| (*w as u32) * (*h as u32))
                    .unwrap_or((0, 0));
                return Err(Errore::DonatoriInsufficienti {
                    servono: richieste.len(),
                    trovati: assegnazioni.len(),
                    serviva: (b.w, b.h),
                    cella_piu_grande: piu_grande,
                });
            }
        }
    }

    let da_svuotare = if svuota_resto {
        candidati.iter().copied().filter(|&i| !usati[i]).collect()
    } else {
        Vec::new()
    };

    // Ordine stabile, cosi' due esecuzioni identiche producono lo stesso file.
    assegnazioni.sort_unstable();
    // Nessuna ricollocazione: qui il rettangolo del donatore non si muove, ed
    // e' il vincolo n. 1 del modulo. Solo `pianifica_su_spazio_libero` lo
    // supera, e lo fa restando dentro la regione del font.
    Ok(Piano { assegnazioni, da_svuotare, ricollocati: Vec::new() })
}

// ── Applicazione ──

/// Spegne tutti i pixel della cella di un glifo.
fn svuota_cella(atlante: &mut GmImage, font: &Font, g: &Glyph) -> bool {
    let (ax, ay) = match font.posizione_assoluta(g) {
        Some(p) => p,
        None => return false,
    };
    for dy in 0..g.source_h {
        for dx in 0..g.source_w {
            atlante.set_pixel(ax + dx, ay + dy, SPENTO);
        }
    }
    true
}

/// Esegue il piano: ridisegna l'atlante e riscrive la tabella dei glifi.
///
/// `dati` sono i byte del `data.win`, modificati **in place**: solo i 14 byte
/// fissi di ogni glifo toccato, mai la lunghezza del file. `atlante` e'
/// l'immagine gia' decodificata, che il chiamante dovra' poi ricomprimere e
/// verificare contro il budget del blob.
///
/// Restituisce i glifi aggiornati, utili al chiamante per registrare cosa e'
/// stato fatto.
pub fn applica(
    atlante: &mut GmImage,
    dati: &mut [u8],
    font: &Font,
    piano: &Piano,
    richieste: &[Richiesta],
) -> Result<Vec<Glyph>, Errore> {
    if font.tpag.is_none() {
        return Err(Errore::TpagAssente);
    }

    // Dove finisce ciascun glifo: la sua cella di sempre, oppure la cella
    // libera che il piano gli ha assegnato.
    let nuova_origine = |ic: usize| -> Option<(u16, u16)> {
        piano.ricollocati.iter().find(|(i, _, _)| *i == ic).map(|&(_, x, y)| (x, y))
    };

    // Prima si controlla tutto, poi si scrive: un fallimento a meta' lascerebbe
    // un atlante mezzo riscritto e nessun modo di sapere dove ci si e' fermati.
    let t = font.tpag.as_ref().ok_or(Errore::TpagAssente)?;
    for &(ic, ir) in &piano.assegnazioni {
        let g = &font.glyphs[ic];
        let r = &richieste[ir];
        // `ingombro` e' cio' che verra' scritto a partire da (ax, ay): per un
        // ricollocato e' la sola bitmap, perche' la cella del donatore resta
        // indietro; per gli altri e' la cella intera, che viene svuotata.
        let (ax, ay, ingombro) = match nuova_origine(ic) {
            // Ricollocato: il vincolo da rispettare non e' piu' la cella del
            // donatore (che si abbandona) ma la REGIONE, dentro cui la cella
            // libera e' stata scelta.
            Some((rx, ry)) => {
                if rx as u32 + r.bitmap.w as u32 > t.source_w as u32
                    || ry as u32 + r.bitmap.h as u32 > t.source_h as u32
                {
                    return Err(Errore::BitmapTroppoGrande {
                        carattere: r.carattere,
                        bitmap: (r.bitmap.w, r.bitmap.h),
                        cella: (t.source_w, t.source_h),
                    });
                }
                // Se l'origine della regione piu' l'offset sfora u16 il
                // problema e' la cella, non il TPAG: dirlo come «manca la
                // regione» manderebbe a diagnosticare la cosa sbagliata.
                let (Some(ax), Some(ay)) =
                    (t.source_x.checked_add(rx), t.source_y.checked_add(ry))
                else {
                    return Err(Errore::CellaFuoriDallAtlante {
                        carattere: r.carattere,
                        x: rx,
                        y: ry,
                    });
                };
                (ax, ay, (r.bitmap.w, r.bitmap.h))
            }
            None => {
                if r.bitmap.w > g.source_w || r.bitmap.h > g.source_h {
                    return Err(Errore::BitmapTroppoGrande {
                        carattere: r.carattere,
                        bitmap: (r.bitmap.w, r.bitmap.h),
                        cella: (g.source_w, g.source_h),
                    });
                }
                let (ax, ay) = font.posizione_assoluta(g).ok_or(Errore::TpagAssente)?;
                (ax, ay, (g.source_w, g.source_h))
            }
        };
        if ax as u32 + ingombro.0 as u32 > atlante.width as u32
            || ay as u32 + ingombro.1 as u32 > atlante.height as u32
        {
            return Err(Errore::CellaFuoriDallAtlante { carattere: r.carattere, x: ax, y: ay });
        }
    }

    let mut aggiornati = Vec::with_capacity(piano.assegnazioni.len());

    // FASE 1 — si svuotano tutte le celle di partenza PRIMA di disegnare
    // qualunque lettera. Con le ricollocazioni le due operazioni non possono
    // piu' stare nello stesso giro: svuotare dopo aver disegnato cancellerebbe
    // una lettera appena scritta se la sua cella nuova toccasse la cella
    // vecchia di un altro donatore. Le celle libere non si sovrappongono a
    // nessun glifo per costruzione, ma quest'ordine non lo dà per scontato.
    for &(ic, _) in &piano.assegnazioni {
        svuota_cella(atlante, font, &font.glyphs[ic]);
    }

    // FASE 2 — si disegna e si riscrive la tabella.
    for &(ic, ir) in &piano.assegnazioni {
        let g = &font.glyphs[ic];
        let r = &richieste[ir];
        let ricollocato = nuova_origine(ic);
        let (ax, ay) = match ricollocato {
            Some((rx, ry)) => (t.source_x + rx, t.source_y + ry),
            None => font.posizione_assoluta(g).ok_or(Errore::TpagAssente)?,
        };

        // Si scrivono TUTTI i pixel della bitmap, accesi e spenti. Scrivere
        // solo gli accesi bastava finche' la cella veniva svuotata prima; per
        // un ricollocato la cella nuova e' spazio della regione che nessuno ha
        // ripulito — «non rivendicato da un glifo» non vuol dire «trasparente»
        // — e i pixel gia' accesi si fonderebbero con la lettera.
        for dy in 0..r.bitmap.h {
            for dx in 0..r.bitmap.w {
                let colore = if r.bitmap.get(dx, dy) { ACCESO } else { SPENTO };
                atlante.set_pixel(ax + dx, ay + dy, colore);
            }
        }

        // Cambiano il codepoint e le dimensioni utili, che ora sono quelle
        // della lettera; e per i ricollocati anche l'origine del rettangolo.
        let (sx, sy) = ricollocato.unwrap_or((g.source_x, g.source_y));
        let nuovo = Glyph {
            character: r.carattere,
            source_x: sx,
            source_y: sy,
            source_w: r.bitmap.w,
            source_h: r.bitmap.h,
            shift: r.shift.unwrap_or(r.bitmap.w as i16 + 1),
            ..g.clone()
        };
        gm_font::scrivi_glifo(dati, &nuovo);
        aggiornati.push(nuovo);
    }

    // I donatori avanzati si svuotano nell'atlante ma NON si toccano nella
    // tabella: restano kanji dichiarati, semplicemente disegnati vuoti. Toglier
    // li dalla lista significherebbe cambiarne la lunghezza, cioe' spostare
    // offset, cioe' ADR-004.
    for &ic in &piano.da_svuotare {
        svuota_cella(atlante, font, &font.glyphs[ic]);
    }

    // ⚠️ 28/07/2026: i codepoint sono cambiati (kanji→cirillico/accenti), la
    // lista puntatori NON e' piu' ordinata per `character` — e il runtime
    // GameMaker la consulta con una ricerca binaria. Senza questo riordino il
    // gioco CRASHAVA all'avvio in giapponese, al primo disegno con un font
    // modificato. In inglese partiva, perche' i font `fnt_ja_*` non venivano
    // mai disegnati: il difetto era invisibile proprio dove non si provava.
    if !gm_font::riordina_puntatori_glifi(dati, font) {
        return Err(Errore::TabellaGlifiIncoerente { font: font.name.clone() });
    }

    Ok(aggiornati)
}

// ── Test ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::gm_font::Tpag;

    fn tpag(x: u16, y: u16) -> Tpag {
        Tpag {
            offset: 0,
            source_x: x,
            source_y: y,
            source_w: 512,
            source_h: 512,
            target_x: 0,
            target_y: 0,
            target_w: 512,
            target_h: 512,
            bounding_w: 512,
            bounding_h: 512,
            texture_index: 0,
        }
    }

    /// Font sintetico: `n` kanji in celle `lato`x`lato`, in fila.
    fn font_finto(n: u16, lato: u16, origine: (u16, u16)) -> Font {
        let glyphs = (0..n)
            .map(|i| Glyph {
                offset: 1000 + i as usize * GLIFO_PASSO,
                character: 0x4E00 + i,
                source_x: i * lato,
                source_y: 0,
                source_w: lato,
                source_h: lato,
                shift: lato as i16,
                offset_x: 0,
            })
            .collect();
        Font {
            offset: 0,
            name: "fnt_finto".into(),
            range_start: 0x20,
            range_end: 0xFF9F,
            scostamento_glifi: 44,
            tpag: Some(tpag(origine.0, origine.1)),
            glyphs,
        }
    }

    const GLIFO_PASSO: usize = 16;

    /// Buffer di data.win finto COERENTE col font: lista puntatori (conteggio
    /// + offset dei record) a `offset + scostamento_glifi`, e il `character`
    /// iniziale scritto in ogni record. Serve dal 28/07: `applica()` riordina
    /// la lista puntatori (il runtime fa ricerca binaria) e rifiuta i buffer
    /// in cui la lista non combacia — come faceva il vecchio vec![0u8; 4096].
    fn prepara_dati(f: &Font) -> Vec<u8> {
        let mut d = vec![0u8; 4096];
        let lista = f.offset + f.scostamento_glifi;
        d[lista..lista + 4].copy_from_slice(&(f.glyphs.len() as u32).to_le_bytes());
        for (i, g) in f.glyphs.iter().enumerate() {
            let p = lista + 4 + i * 4;
            d[p..p + 4].copy_from_slice(&(g.offset as u32).to_le_bytes());
            d[g.offset..g.offset + 2].copy_from_slice(&g.character.to_le_bytes());
        }
        d
    }

    fn lettera(carattere: u16, w: u16, h: u16) -> Richiesta {
        let mut b = Bitmap::nuova(w, h);
        // Una diagonale, così si vede se finisce nel posto giusto.
        for i in 0..w.min(h) {
            b.set(i, i, true);
        }
        Richiesta { carattere, bitmap: b, shift: None }
    }

    fn atlante_pieno(w: u16, h: u16) -> GmImage {
        let mut a = GmImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                a.set_pixel(x, y, ACCESO);
            }
        }
        a
    }

    /// Font coi glifi in una striscia in alto e celle STRETTE: e' la forma
    /// reale di `fnt_main` (simboli sacrificabili 3x5, regione 128x128 con
    /// spazio vuoto sotto).
    fn font_celle_strette(n: u16, cw: u16, ch: u16) -> Font {
        let mut f = font_finto(n, 16, (0, 0));
        // Regione 128x128 come quella VERA di fnt_main. Il TPAG ereditato da
        // `font_finto` e' 512x512: con quello le lettere entrerebbero tutte su
        // una riga sola e il percorso multi-banda — l'unico interessante sul
        // font vero — non verrebbe mai attraversato. Peggio, finirebbero fuori
        // dall'atlante 128x128 usato nel test di `applica`.
        if let Some(t) = f.tpag.as_mut() {
            t.source_w = 128;
            t.source_h = 128;
        }
        for (i, g) in f.glyphs.iter_mut().enumerate() {
            g.source_x = i as u16 * cw;
            g.source_y = 0;
            g.source_w = cw;
            g.source_h = ch;
        }
        f
    }

    /// L'INVARIANTE STORICO, sotto tutela: il percorso kanji non ricolloca
    /// niente. Se un giorno qualcuno facesse ricollocare anche quello, la
    /// patch russa provata in-game cambierebbe comportamento in silenzio.
    #[test]
    fn il_percorso_classico_non_ricolloca_niente() {
        let f = font_finto(10, 16, (0, 0));
        let richieste: Vec<_> = (0..3).map(|i| lettera(0x0410 + i, 8, 8)).collect();

        let kanji = pianifica(&f, &richieste, KANJI, true).unwrap();
        assert!(kanji.ricollocati.is_empty(), "il percorso kanji non muove i rettangoli");

        let lista: Vec<u16> = (0..10).map(|i| 0x4E00 + i).collect();
        let da_lista = pianifica_da_lista(&f, &richieste, &lista, true).unwrap();
        assert!(da_lista.ricollocati.is_empty(), "nemmeno la lista esplicita li muove");
    }

    /// Il caso che ha motivato tutto: celle donatrici 3x5, lettere 12x16.
    /// La via classica fallisce dicendo perche', quella su spazio libero
    /// riesce — e i due esiti insieme sono la misura di Deltarune.
    #[test]
    fn spazio_libero_riesce_dove_le_celle_donatrici_sono_troppo_strette() {
        let f = font_celle_strette(12, 3, 5);
        let richieste: Vec<_> = (0..12).map(|i| lettera(0x00E0 + i, 12, 16)).collect();
        let candidati: Vec<u16> = (0..12).map(|i| 0x4E00 + i).collect();

        // Via classica: nessuna cella da 12x16 fra celle da 3x5.
        assert!(
            matches!(
                pianifica_da_lista(&f, &richieste, &candidati, false),
                Err(Errore::DonatoriInsufficienti { cella_piu_grande: (3, 5), .. })
            ),
            "la via classica doveva fallire proprio sulla dimensione della cella"
        );

        // Via nuova: i record servono per gli slot, i rettangoli si spostano.
        let piano = pianifica_su_spazio_libero(&f, &richieste, &candidati, false).unwrap();
        assert_eq!(piano.assegnazioni.len(), 12);
        assert_eq!(piano.ricollocati.len(), 12, "ogni lettera deve avere una cella nuova");

        // Nessuna cella nuova si sovrappone a un glifo ancora vivo, e nessuna
        // esce dalla regione: sono le due cose che romperebbero il font.
        let t = f.tpag.as_ref().unwrap();
        for &(_, x, y) in &piano.ricollocati {
            assert!(
                x as u32 + 12 <= t.source_w as u32 && y as u32 + 16 <= t.source_h as u32,
                "cella ({x},{y}) fuori dalla regione {}x{}",
                t.source_w,
                t.source_h
            );
            for g in &f.glyphs {
                let sovrappone = x < g.source_x + g.source_w
                    && g.source_x < x + 12
                    && y < g.source_y + g.source_h
                    && g.source_y < y + 16;
                assert!(!sovrappone, "cella ({x},{y}) sopra il glifo U+{:04X}", g.character);
            }
        }

        // E nemmeno fra loro: due lettere nello stesso posto ne cancellano una.
        for (i, &(_, x1, y1)) in piano.ricollocati.iter().enumerate() {
            for &(_, x2, y2) in piano.ricollocati.iter().skip(i + 1) {
                let sovrappone = x1 < x2 + 12 && x2 < x1 + 12 && y1 < y2 + 16 && y2 < y1 + 16;
                assert!(!sovrappone, "due lettere collocate a ({x1},{y1}) e ({x2},{y2})");
            }
        }
    }

    /// Spazio esaurito: l'errore deve distinguersi da «mancano i record» e
    /// portarsi dietro i numeri che dicono se il problema e' lo spazio o la
    /// frammentazione.
    #[test]
    fn spazio_libero_esaurito_lo_dice_con_i_numeri() {
        // Regione piccola, tutta rivendicata dai glifi esistenti.
        let mut f = font_celle_strette(4, 16, 16);
        let t = f.tpag.as_mut().unwrap();
        t.source_w = 64;
        t.source_h = 16;

        let richieste: Vec<_> = (0..4).map(|i| lettera(0x00E0 + i, 12, 16)).collect();
        let candidati: Vec<u16> = (0..4).map(|i| 0x4E00 + i).collect();

        match pianifica_su_spazio_libero(&f, &richieste, &candidati, false) {
            Err(Errore::SpazioLiberoInsufficiente {
                servono, collocate, serviva, regione, pixel_liberi,
            }) => {
                assert_eq!(servono, 4);
                assert_eq!(collocate, 0, "non c'e' un solo pixel libero");
                assert_eq!(serviva, (12, 16));
                assert_eq!(regione, (64, 16));
                assert_eq!(pixel_liberi, 0);
            }
            altro => panic!("atteso SpazioLiberoInsufficiente, ottenuto {altro:?}"),
        }
    }

    /// Prova d'EFFETTO, non di piano: dopo `applica` i pixel della lettera
    /// stanno nella cella nuova, la cella vecchia e' spenta, e il record nella
    /// tabella punta al rettangolo nuovo. Senza questo test il piano potrebbe
    /// essere perfetto e il disegno finire nel posto di prima.
    #[test]
    fn applica_disegna_nella_cella_ricollocata_e_spegne_quella_vecchia() {
        let f = font_celle_strette(3, 6, 6);
        let richieste = vec![lettera(0x00E0, 6, 6)];
        let candidati: Vec<u16> = (0..3).map(|i| 0x4E00 + i).collect();

        let piano = pianifica_su_spazio_libero(&f, &richieste, &candidati, false).unwrap();
        let (ic, _) = piano.assegnazioni[0];
        let (_, nx, ny) = piano.ricollocati[0];
        let vecchia = (f.glyphs[ic].source_x, f.glyphs[ic].source_y);
        assert_ne!((nx, ny), vecchia, "la prova non vale se la cella non si e' mossa");

        // DUE atlanti, e servono entrambi. Su quello PIENO ogni pixel e' gia'
        // acceso: li' «la diagonale c'e'» sarebbe vero anche se `applica` non
        // disegnasse niente — quell'atlante prova solo la PULIZIA. Su quello
        // VUOTO nessun pixel e' acceso: li' la diagonale prova il DISEGNO.
        let mut dati = prepara_dati(&f);
        let mut vuoto = GmImage::new(128, 128);
        applica(&mut vuoto, &mut dati, &f, &piano, &richieste).unwrap();
        for i in 0..6u16 {
            assert_eq!(
                vuoto.get_pixel(nx + i, ny + i),
                Some(ACCESO),
                "la diagonale doveva essere DISEGNATA in ({}, {})",
                nx + i,
                ny + i
            );
        }

        let mut atlante = atlante_pieno(128, 128);
        let mut dati = prepara_dati(&f);
        let aggiornati = applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        for i in 0..6u16 {
            assert_eq!(atlante.get_pixel(nx + i, ny + i), Some(ACCESO));
        }
        // Fuori dalla diagonale, DENTRO la cella nuova, deve essere spento:
        // la cella nuova e' spazio della regione che nessuno ha ripulito, e
        // senza scrivere anche i pixel spenti la lettera si fonderebbe con
        // quello che c'era. E' l'asserzione che ha stanato il difetto vero.
        assert_eq!(
            atlante.get_pixel(nx + 5, ny),
            Some(SPENTO),
            "la cella nuova non e' stata ripulita: la lettera si fonde col fondo"
        );

        // La cella VECCHIA e' tutta spenta: il simbolo sacrificato sparisce
        // davvero dall'atlante, non resta come fantasma.
        for dy in 0..6u16 {
            for dx in 0..6u16 {
                assert_eq!(
                    atlante.get_pixel(vecchia.0 + dx, vecchia.1 + dy),
                    Some(SPENTO),
                    "la cella abbandonata deve restare vuota"
                );
            }
        }

        // E il record punta al rettangolo nuovo.
        assert_eq!(aggiornati.len(), 1);
        assert_eq!((aggiornati[0].source_x, aggiornati[0].source_y), (nx, ny));
        assert_eq!(aggiornati[0].character, 0x00E0);
    }

    #[test]
    fn senza_tpag_non_si_pianifica() {
        let mut f = font_finto(10, 16, (0, 0));
        f.tpag = None;
        assert_eq!(
            pianifica(&f, &[lettera(0x0410, 8, 8)], KANJI, false),
            Err(Errore::TpagAssente)
        );
    }

    #[test]
    fn un_carattere_gia_presente_e_un_errore() {
        let f = font_finto(4, 16, (0, 0));
        let r = lettera(0x4E00, 8, 8); // e' uno dei kanji esistenti
        assert_eq!(
            pianifica(&f, &[r], KANJI, false),
            Err(Errore::CarattereGiaPresente { carattere: 0x4E00 })
        );
    }

    #[test]
    fn donatori_insufficienti() {
        let f = font_finto(2, 16, (0, 0));
        let richieste: Vec<_> = (0..5).map(|i| lettera(0x0410 + i, 8, 8)).collect();
        assert!(matches!(
            pianifica(&f, &richieste, KANJI, false),
            Err(Errore::DonatoriInsufficienti { servono: 5, .. })
        ));
    }

    /// Le celle piccole non devono essere assegnate a glifi grandi.
    #[test]
    fn le_celle_troppo_piccole_non_vengono_scelte() {
        let mut f = font_finto(3, 16, (0, 0));
        f.glyphs[1].source_w = 4;
        f.glyphs[1].source_h = 4;

        let piano = pianifica(&f, &[lettera(0x0410, 12, 12)], KANJI, false).unwrap();
        assert_eq!(piano.assegnazioni.len(), 1);
        let (ic, _) = piano.assegnazioni[0];
        assert_ne!(ic, 1, "la cella 4x4 non puo' ospitare un glifo 12x12");
    }

    /// Il piano e' deterministico: due esecuzioni identiche danno lo stesso
    /// risultato, altrimenti due patch della stessa versione differirebbero.
    #[test]
    fn il_piano_e_deterministico() {
        let f = font_finto(20, 16, (0, 0));
        let richieste: Vec<_> = (0..6).map(|i| lettera(0x0410 + i, 8, 8)).collect();
        let a = pianifica(&f, &richieste, KANJI, true).unwrap();
        let b = pianifica(&f, &richieste, KANJI, true).unwrap();
        assert_eq!(a.assegnazioni, b.assegnazioni);
        assert_eq!(a.da_svuotare, b.da_svuotare);
    }

    #[test]
    fn svuota_resto_elenca_i_donatori_avanzati() {
        let f = font_finto(10, 16, (0, 0));
        let richieste: Vec<_> = (0..3).map(|i| lettera(0x0410 + i, 8, 8)).collect();

        let senza = pianifica(&f, &richieste, KANJI, false).unwrap();
        assert!(senza.da_svuotare.is_empty());

        let con = pianifica(&f, &richieste, KANJI, true).unwrap();
        assert_eq!(con.da_svuotare.len(), 7, "10 kanji meno 3 usati");
    }

    /// Il cuore: la lettera finisce nella cella giusta, alle coordinate
    /// ASSOLUTE, e la tabella viene riscritta.
    #[test]
    fn la_lettera_finisce_al_posto_giusto() {
        let origine = (100u16, 200u16);
        let f = font_finto(4, 16, origine);
        let mut atlante = atlante_pieno(512, 512);
        let mut dati = prepara_dati(&f);

        let richieste = vec![lettera(0x0410, 8, 8)];
        let piano = pianifica(&f, &richieste, KANJI, false).unwrap();
        let agg = applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        assert_eq!(agg.len(), 1);
        assert_eq!(agg[0].character, 0x0410);
        assert_eq!((agg[0].source_w, agg[0].source_h), (8, 8));
        assert_eq!(agg[0].shift, 9, "shift predefinito = larghezza + 1");

        let (ic, _) = piano.assegnazioni[0];
        let g = &f.glyphs[ic];
        let (ax, ay) = f.posizione_assoluta(g).unwrap();
        assert_eq!((ax, ay), (origine.0 + g.source_x, origine.1 + g.source_y));

        // La diagonale c'e', alle coordinate assolute.
        for i in 0..8u16 {
            assert_eq!(atlante.get_pixel(ax + i, ay + i), Some(ACCESO), "diagonale in ({i},{i})");
        }
        // E il resto della cella e' stato svuotato, non lasciato acceso.
        assert_eq!(atlante.get_pixel(ax + 1, ay), Some(SPENTO));
        assert_eq!(atlante.get_pixel(ax + 15, ay + 15), Some(SPENTO));

        // Fuori dalla cella l'atlante e' intatto.
        assert_eq!(atlante.get_pixel(ax + 16, ay), Some(ACCESO));
        assert_eq!(atlante.get_pixel(ax, ay.wrapping_sub(1)), Some(ACCESO));
    }

    /// Alle coordinate GREZZE non deve esserci finito niente: e' l'errore che
    /// l'esperimento visivo del 27/07 ha evitato.
    #[test]
    fn non_si_disegna_alle_coordinate_relative() {
        let origine = (100u16, 200u16);
        let f = font_finto(4, 16, origine);
        let mut atlante = GmImage::new(512, 512); // tutto spento
        let mut dati = prepara_dati(&f);

        let richieste = vec![lettera(0x0410, 8, 8)];
        let piano = pianifica(&f, &richieste, KANJI, false).unwrap();
        applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        let (ic, _) = piano.assegnazioni[0];
        let g = &f.glyphs[ic];
        // Alla posizione relativa (senza l'origine TPAG) l'atlante e' vuoto.
        assert_eq!(
            atlante.get_pixel(g.source_x, g.source_y),
            Some(SPENTO),
            "qualcosa e' stato disegnato alle coordinate relative"
        );
        // A quella assoluta invece no.
        let (ax, ay) = f.posizione_assoluta(g).unwrap();
        assert_eq!(atlante.get_pixel(ax, ay), Some(ACCESO));
    }

    #[test]
    fn i_donatori_avanzati_vengono_svuotati_nell_atlante() {
        let f = font_finto(4, 16, (0, 0));
        let mut atlante = atlante_pieno(256, 256);
        let mut dati = prepara_dati(&f);

        let richieste = vec![lettera(0x0410, 8, 8)];
        let piano = pianifica(&f, &richieste, KANJI, true).unwrap();
        applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        for &ic in &piano.da_svuotare {
            let g = &f.glyphs[ic];
            let (ax, ay) = f.posizione_assoluta(g).unwrap();
            assert_eq!(
                atlante.get_pixel(ax + 3, ay + 3),
                Some(SPENTO),
                "il donatore avanzato U+{:04X} doveva essere svuotato",
                g.character
            );
        }
    }

    /// Un piano non realizzabile deve fallire PRIMA di aver toccato l'atlante.
    #[test]
    fn un_fallimento_non_lascia_l_atlante_a_meta() {
        let f = font_finto(4, 16, (0, 0));
        let mut atlante = atlante_pieno(256, 256);
        let prima = atlante.clone();
        let mut dati = prepara_dati(&f);

        // Piano valido per due lettere, ma la seconda bitmap viene gonfiata
        // dopo la pianificazione: applica() deve accorgersene e non scrivere.
        let mut richieste = vec![lettera(0x0410, 8, 8), lettera(0x0411, 8, 8)];
        let piano = pianifica(&f, &richieste, KANJI, false).unwrap();
        richieste[1].bitmap = Bitmap::nuova(64, 64);

        let dati_prima = dati.clone();
        let esito = applica(&mut atlante, &mut dati, &f, &piano, &richieste);
        assert!(matches!(esito, Err(Errore::BitmapTroppoGrande { .. })));
        assert_eq!(atlante.bgra, prima.bgra, "l'atlante non doveva essere toccato");
        assert_eq!(dati, dati_prima, "il data.win non doveva essere toccato");
    }

    /// La lista esplicita e' un contratto: i glifi fuori lista non si toccano,
    /// ne' come donatori ne' come celle da svuotare.
    #[test]
    fn pianifica_da_lista_rispetta_la_lista() {
        let f = font_finto(6, 16, (0, 0)); // kanji 0x4E00..0x4E05
        let lista = vec![0x4E01u16, 0x4E03];

        let piano = pianifica_da_lista(&f, &[lettera(0x00E0, 8, 8)], &lista, true).unwrap();

        assert_eq!(piano.assegnazioni.len(), 1);
        let (ic, _) = piano.assegnazioni[0];
        assert!(
            lista.contains(&f.glyphs[ic].character),
            "donatore U+{:04X} fuori dalla lista",
            f.glyphs[ic].character
        );
        // svuota_resto con lista esplicita: si svuota SOLO il candidato in
        // lista non usato, non gli altri quattro glifi del font.
        assert_eq!(piano.da_svuotare.len(), 1);
        assert!(lista.contains(&f.glyphs[piano.da_svuotare[0]].character));
    }

    #[test]
    fn pianifica_da_lista_fallisce_quando_la_lista_non_basta() {
        let f = font_finto(6, 16, (0, 0));
        let lista = vec![0x4E01u16]; // un solo candidato per due lettere
        let richieste: Vec<_> = (0..2u16).map(|i| lettera(0x00E0 + i, 8, 8)).collect();
        assert!(matches!(
            pianifica_da_lista(&f, &richieste, &lista, false),
            Err(Errore::DonatoriInsufficienti { servono: 2, trovati: 1, .. })
        ));
    }

    /// Il refactoring a predicato non deve aver mosso niente sul percorso
    /// kanji, quello provato in-game: stesse assegnazioni, stessi svuotati,
    /// donatori tutti nell'intervallo CJK.
    #[test]
    fn pianifica_classico_invariato_sul_caso_kanji() {
        let f = font_finto(10, 16, (0, 0));
        let richieste: Vec<_> = (0..3u16).map(|i| lettera(0x0410 + i, 8, 8)).collect();

        let piano = pianifica(&f, &richieste, KANJI, true).unwrap();
        assert_eq!(piano.assegnazioni.len(), 3);
        assert_eq!(piano.da_svuotare.len(), 7, "10 kanji meno 3 usati");
        for &(ic, _) in &piano.assegnazioni {
            let c = f.glyphs[ic].character;
            assert!((KANJI.0..=KANJI.1).contains(&c), "U+{c:04X} non e' un kanji");
        }
    }

    /// La lunghezza dei dati non cambia mai: e' la promessa che tiene in piedi
    /// tutto ADR-005.
    #[test]
    fn la_lunghezza_dei_dati_non_cambia() {
        let f = font_finto(8, 16, (0, 0));
        let mut atlante = atlante_pieno(256, 256);
        let mut dati = prepara_dati(&f);
        let n = dati.len();

        let richieste: Vec<_> = (0..4).map(|i| lettera(0x0410 + i, 8, 8)).collect();
        let piano = pianifica(&f, &richieste, KANJI, true).unwrap();
        applica(&mut atlante, &mut dati, &f, &piano, &richieste).unwrap();

        assert_eq!(dati.len(), n);
        assert_eq!(atlante.bgra.len(), 256 * 256 * 4);
    }
}
