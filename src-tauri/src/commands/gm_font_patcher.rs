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

use std::collections::BTreeMap;
use std::fs;

use serde::{Deserialize, Serialize};

use crate::commands::gamemaker_patcher::find_data_win;
use crate::commands::gm_font::{self, Font};
use crate::commands::gm_glyph_inject::{self, Richiesta, KANJI};
use crate::commands::gm_glyph_raster::{self, SOGLIA};
use crate::commands::gm_texture;

/// Corpo minimo sotto il quale una lettera non e' piu' leggibile.
const CORPO_MINIMO: f32 = 5.0;

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
fn cella_garantita(f: &Font, n: usize) -> Option<(u16, u16)> {
    let mut celle: Vec<(u16, u16)> = f
        .donatori(KANJI.0, KANJI.1, 0, 0)
        .iter()
        .map(|g| (g.source_w, g.source_h))
        .collect();
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
) -> Option<(Vec<f32>, Vec<Richiesta>, Vec<(String, String)>)> {
    let realizzabile = |corpo: f32| -> Option<(Vec<Richiesta>, Vec<(String, String)>)> {
        let (richieste, saltati) = prepara(ttf, f, voluti, corpo);
        if richieste.is_empty() {
            return None;
        }
        gm_glyph_inject::pianifica(f, &richieste, KANJI, true)
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
    if let Some(cella) = cella_garantita(f, base.len()) {
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
        if !adattate.is_empty()
            && gm_glyph_inject::pianifica(f, &adattate, KANJI, true).is_ok()
        {
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

    // Font su cui lavorare.
    let scelti: Vec<&Font> = if font_names.is_empty() {
        tutti.iter().filter(|f| f.quanti_in(KANJI.0, KANJI.1) > 0).collect()
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
        return Err("nessun font utilizzabile: servono glifi donatori (kanji)".into());
    }

    // Font del gioco che restano scoperti: vanno DICHIARATI, non scoperti
    // dall'utente a gioco avviato.
    for f in &tutti {
        if f.quanti_in(KANJI.0, KANJI.1) > 0 && !scelti.iter().any(|s| s.name == f.name) {
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

            let (corpi, richieste, saltati) = corpo_che_ci_sta(&ttf, f, &voluti, corpo)
                .ok_or_else(|| {
                    let piu_grande = prime
                        .iter()
                        .map(|r| (r.bitmap.w, r.bitmap.h))
                        .max_by_key(|(w, h)| (*w as u32) * (*h as u32))
                        .map(|(w, h)| format!("{w}x{h} px"))
                        .unwrap_or_else(|| "nessuno".into());
                    let celle = cella_garantita(f, prime.len())
                        .map(|(w, h)| format!("{w}x{h} px"))
                        .unwrap_or_else(|| "nessuna disponibile".into());
                    format!(
                        "'{}': nessun corpo fra {CORPO_MINIMO} e {corpo:.1} produce lettere che \
                         entrino nelle celle. All'altezza delle maiuscole ({altezza} px) il glifo \
                         piu' grande sarebbe {piu_grande}, e la cella garantita a ciascuna delle \
                         {} lettere e' {celle}.",
                        f.name,
                        prime.len()
                    )
                })?;

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
                avvisi.push(format!(
                    "'{}': {} lettere su {} non entrano a grandezza piena ({altezza} px) e sono \
                     state ridotte — {}. Le celle riusabili sono al massimo {}x{} px e un accento \
                     occupa spazio sopra la lettera: nel gioco si vedranno un po' piu' piccole \
                     del testo circostante.",
                    f.name,
                    cedute.len(),
                    richieste.len(),
                    cedute.join(", "),
                    f.donatori(KANJI.0, KANJI.1, 0, 0)
                        .iter()
                        .map(|g| g.source_w)
                        .max()
                        .unwrap_or(0),
                    f.donatori(KANJI.0, KANJI.1, 0, 0)
                        .iter()
                        .map(|g| g.source_h)
                        .max()
                        .unwrap_or(0),
                ));
            }

            let piano = gm_glyph_inject::pianifica(f, &richieste, KANJI, true)
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

        let esito = gm_inject_glyphs(
            dir,
            vec!["fnt_ja_main".into(), "fnt_ja_small".into()],
            "àèéìòùÀÈÉÌÒÙ".into(),
            ttf,
            true,
        )
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

        // Gli accenti italiani: la prima prova sul campo scelta con Davide.
        let esito = gm_inject_glyphs(
            dir,
            vec!["fnt_ja_main".into(), "fnt_ja_small".into()],
            "àèéìòùÀÈÉÌÒÙ".into(),
            ttf,
            false,
        )
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
    }
}
