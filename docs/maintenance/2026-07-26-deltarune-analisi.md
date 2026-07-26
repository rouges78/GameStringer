# Deltarune: analisi sul gioco vero — 26/07/2026

Scaricata la demo gratuita (Chapter 1 & 2) e analizzata direttamente, dopo la lettura
del [thread Steam del 2021](https://steamcommunity.com/app/1671210/discussions/0/3090023948249828291/)
in cui la community prova a tradurla. Quattro utenti ci avevano chiesto proprio questo
gioco, ed era anche il `data.win` reale che ADR-004 aspettava da un mese.

## Com'è fatta la localizzazione

```
DELTARUNEdemo/
├── data.win            89 MB
├── DELTARUNE.exe
└── lang/
    ├── lang_en_ch1.json     6.242 chiavi   (Chapter 1, inglese)
    ├── lang_ja_ch1.json                    (Chapter 1, giapponese)
    └── lang_ja.json        13.031 chiavi   (Chapter 2, giapponese)
```

**JSON piatto, chiave → stringa.** Le chiavi sono nomi di script GameMaker
(`DEVICE_CONTACT_slash_Step_0_gml_6_0`), i valori contengono marcatori di controllo:

```json
"DEVICE_CONTACT_slash_Step_0_gml_6_0": " ARE YOU^6& THERE^6?\\M1 ^6 %"
```

`^6` pausa · `&` a capo · `\M0`/`\M1` espressione del volto · `%` fine messaggio.
Sono esattamente il tipo di sequenze che il nostro placeholder guard protegge già.

**Nota importante:** `lang_en.json` (Chapter 2 inglese) **non esiste**. L'inglese del
Chapter 2 sta dentro `data.win`; solo il giapponese è stato esternalizzato. Quindi per
il Chapter 2 il testo sorgente va estratto dal `data.win`, mentre il *risultato* può
essere scritto in un JSON esterno.

## Perché oggi non lo riconosciamo

`find_language_dir` in `gamemaker_patcher.rs` cerca `language/engLanguage/*.jn` — la
struttura di **Undertale**, con il formato `testo inglese|testo giapponese` per riga.
Deltarune usa `lang/*.json`. Non combaciando, si cade sulla priorità 2 (chunk `STRG`
dentro `data.win`) e ci si prende il problema dei troncamenti su un gioco che, per il
Chapter 1, non ne avrebbe alcun bisogno.

## Come il gioco sceglie la lingua

Nel `data.win`: `os_get_language`, `scr_change_language`, `global.lang`, e un debug
`[C] Switch Language`. I font sono in coppie parallele — `fnt_main`/`fnt_ja_main`,
`fnt_small`/`fnt_ja_small` — e ci sono impostazioni dedicate al giapponese
(`line_height_ja`, `border_options_ja`, `heart_pos_y_ja`).

È un sistema **a due lingue**, inglese e giapponese, non un meccanismo generico. La
strada praticabile è impersonare il giapponese: sostituire i `lang_ja*.json` e forzare
`global.lang`.

## Il verdetto sui font, che cambia l'ordine delle cose

Il thread del 2021 si arena sugli accenti: *«someone will need to figure out how to add
new characters to the in-game fonts»*. Ho letto il chunk `FONT` del `data.win` e contato
i glifi realmente presenti:

| Font | Glifi | ASCII | Accenti latini | **Cirillico** | Kana | Kanji |
|---|---:|---:|---:|---:|---:|---:|
| `fnt_main` | 96 | 95/95 | **0** | **0** | 0 | 0 |
| `fnt_small` | 96 | 95/95 | **0** | **0** | 0 | 0 |
| `fnt_ja_main` | 1.768 | 95/95 | **0** | **0** | 173 | 1.347 |
| `fnt_ja_small` | 1.714 | 95/95 | **0** | **0** | 173 | 1.296 |

I font dichiarano un range `0x20..0xFF9F`, ma i glifi effettivi sono ASCII più kana e
kanji. **Nessun font contiene il cirillico. Nessun font contiene le lettere accentate
latine** — nemmeno quelli giapponesi, che pure sarebbero i candidati naturali.

Conseguenza diretta: una traduzione **russa** di Deltarune — e il russo è la lingua
della maggioranza dei nostri utenti — oggi mostrerebbe caselle vuote, per quanto
perfetta sia la traduzione. Lo stesso vale per tedesco, francese, spagnolo e italiano
appena compare un accento.

**Il font non è il passo dopo: è il prerequisito.** Tradurre senza risolverlo produce
una patch inutilizzabile, cioè esattamente la cosa che il nostro guard sui troncamenti
esiste per impedire.

## Ordine di lavoro che ne segue

1. **Riconoscere `lang/*.json`** in `find_language_dir` (estensione piccola, nessun
   rischio): sblocca l'estrazione delle 6.242 stringhe del Chapter 1 senza toccare
   `data.win` e senza troncamenti.
2. **Glifi mancanti nei font GameMaker.** È il lavoro vero, ed è anche l'unico punto in
   cui possiamo fare qualcosa che nessuno strumento di quella community fa da cinque
   anni. `font_installer.rs` oggi copre Ren'Py, RPG Maker, Unity e Unreal con
   sostituzione Noto; GameMaker no, e qui non basta sostituire un TTF: i glifi sono
   bitmap in una texture page, quindi vanno **generati e reimpacchettati**, aggiornando
   la tabella dei glifi nel `data.win`.
3. **Rebuilder di `data.win`** (ADR-004) per il Chapter 2 e per i giochi senza file di
   lingua esterni.

## Cosa dichiarare invece di risolvere

Il thread segnala che il testo esce dai riquadri e che le interruzioni di riga non
aiutano, perché **le dimensioni dei box sono hardcoded nel gioco**. Non è un problema
che possiamo risolvere dall'esterno: va detto all'utente, come già facciamo per i
troncamenti.
