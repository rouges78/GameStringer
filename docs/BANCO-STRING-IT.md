# Banco di prova di String it — esiti sui giochi veri

`src-tauri/bench/string-it-plan.tsv` misura quale metodo il piano **sceglie**.
Questo file registra se poi il metodo **riesce**, gioco per gioco, e fino a
dove lo ha visto una persona sullo schermo. È la misura di "String it regge"
che il congelamento della larghezza (CLAUDE.md) aspetta: obiettivo 20–30
giochi, ognuno con una riga aggiornata.

## Come si segna un esito

- **A schermo** si scrive solo se una persona ha visto il testo tradotto
  dentro il gioco. Va detto *dove*: menu, prologo, capitolo 1, finale.
  "Il bundle si carica" o "il log è pulito" non valgono come visto.
- **Completo** = tutto il testo del gioco passa, non solo una tabella o un batch
  di prova. Se un limite noto taglia una parte (FText CultureInvariant su
  Unreal, frasi troppo lunghe su Visionaire), va scritto in Note.
- **Ripristino** = premuto "Ripristina file originali" nella scheda del gioco,
  il gioco riparte in lingua originale e Steam "verifica file" non trova
  differenze.
- Data in formato AAAA-MM-GG, versione dell'app o commit.

## Esiti

Le righe con data sono quelle documentate in `docs/METODI-DI-TRADUZIONE.md`
(sezione "Scelta del metodo"). Le altre aspettano la prima corsa.

| Gioco | Motore | Metodo | Data | Testi tradotti / scritti | A schermo | Completo | Ripristino | Note |
|---|---|---|---|---|---|---|---|---|
| Lost Host Demo | Unity | `unity-loc-tables` | 2026-11-12 | 291 / 319 | no (non guardato) | sì, demo | ripristinato a mano | lingua sostituita: nl al posto di una delle 14 |
| Mouthwashing | Unity | `unity-xunity` | 2026-11-13 | 49 | sì, menu | no | — | tradotto da Google dentro XUnity, non dalla catena AI (vedi PR #252) |
| art of rally | Unity | `unity-xunity` | — | — | — | — | — | |
| AILA | Unreal Engine | `unreal-locres` | 2026-11-13 | — | sì, menu principale | no | — | i `.locres` coprono solo una parte: FText CultureInvariant non raggiungibile |
| DREAD FLATS | Unreal Engine | `unreal-locres` | — | — | — | — | — | |
| Fobia | Unreal Engine | `unreal-locres` | — | — | — | — | — | il gioco ha già l'italiano: String it lo segnala prima di partire |
| Townfall | Unreal Engine | `unreal-locres` | — | — | — | — | — | |
| Scarlet Hollow | Ren'Py | `renpy-tl` | 2026-11-13 | batch di prova da 200 | sì, menu | no | — | testo che esce dai box; il modello traduceva identificatori |
| Danganronpa Trigger Happy Havoc | Spike Chunsoft | `danganronpa-wad` | 2026-11-13 | 192 / 47.999 | sì, prologo | no | — | font senza è/ì/ò/ù (sostituzione); testo fuori dal box |
| Foolish Mortals | Visionaire Studio | `visionaire-vis` | — | — | — | — | — | noto: le frasi più lunghe dell'originale vengono scartate |
| Look Outside | Hendrix Localization | `hendrix-csv` | — | — | — | — | — | |
| The Incident at Galley House | Godot | `runtime-hook` | — | — | — | — | — | String it oggi manda alla pagina Godot |
| Resident Evil Requiem | RE Engine | `generic-workflow` | — | — | — | — | — | |
| Gabriel Knight 2 | sconosciuto | `generic-workflow` | — | — | — | — | — | |
| The Dig | sconosciuto | `generic-workflow` | — | — | — | — | — | |
| DELTARUNE (demo) | GameMaker | `generic-workflow` (GameMaker) | 2026-11-16 | 6.242 chiavi scritte | da verificare | — | — | 2 chiavi con un `%` in più (vedi METODI, GameMaker) |

Mancano giochi per: RPG Maker MV/MZ puro, Tyrano, Wolf RPG, Unity IL2CPP.
Servono anche giochi che *non* hanno la lingua di destinazione e sono
popolari, perché il banco somigli a una libreria vera.

## Quando aggiornare

Dopo ogni corsa di String it su un gioco del banco, anche se fallisce: un
fallimento scritto qui vale più di un successo non verificato.
