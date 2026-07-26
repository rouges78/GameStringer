# ADR-005 — Glifi mancanti nei font GameMaker (cirillico e accenti)

**Data:** 2026-07-26 · **Stato:** proposto · **Contesto misurato su:** DELTARUNE demo (Chapter 1 & 2)

## Il problema, con i numeri

Una traduzione può essere perfetta e restare **illeggibile**: se il font del gioco non
contiene i glifi della lingua di destinazione, il giocatore vede caselle vuote.

Letto il chunk `FONT` del `data.win` di Deltarune e contati i glifi realmente presenti
(non il range dichiarato, che mente):

| Font | Glifi | ASCII | Accenti latini | Cirillico | Kana | Kanji |
|---|---:|---:|---:|---:|---:|---:|
| `fnt_main` | 96 | 95 | 0 | **0** | 0 | 0 |
| `fnt_small` | 96 | 95 | 0 | **0** | 0 | 0 |
| `fnt_ja_main` | 1.768 | 95 | 0 | **0** | 173 | 1.347 |
| `fnt_ja_small` | 1.714 | 95 | 0 | **0** | 173 | 1.296 |

Tutti dichiarano `rangeStart..rangeEnd = 0x20..0xFF9F`, ma i glifi effettivi sono
ASCII più kana e kanji. **Nessun font contiene il cirillico o le lettere accentate**,
nemmeno quelli giapponesi.

Conseguenza: russo (la lingua della maggioranza dei nostri utenti), tedesco, francese,
spagnolo e italiano sono oggi **non traducibili in modo utilizzabile** su questo gioco —
e la stessa struttura si ritrova in gran parte dei giochi GameMaker.

La community di fan-translation è ferma esattamente qui **dal 2021**: nel thread Steam
ufficiale la richiesta è testuale — *«someone will need to figure out how to add new
characters to the in-game fonts»* — e non ha mai avuto risposta. Nessuno strumento
esistente (UndertaleModTool incluso) automatizza questo passaggio.

## Perché non è come Ren'Py o RPG Maker

Lì un font è un file `.ttf` sul disco: `font_installer.rs` lo sostituisce con un Noto
che ha i glifi giusti e il gioco riparte. In GameMaker il font è **bitmap**: i glifi
sono pixel dentro una texture page, e una tabella li mappa (`char` → rettangolo +
metriche). Non c'è nessun file da sostituire: vanno **generati i pixel** e **riscritta
la tabella**.

## Il formato, verificato

- **Texture**: chunk `TXTR`, 27 texture. Il formato non è PNG ma **QOI compresso con
  BZip2** — magic `2zoq`, poi width/height in `u16`, poi lo stream `BZh9`. La texture
  del font giapponese è 2048×2048.
- **Posizione del font nella texture**: chunk `TPAG`. `fnt_main` occupa un'area di
  **128×128** a `(1806, 1274)` nella texture 24; `fnt_ja_main` occupa **1024×512** a
  `(2, 1030)` nella texture 25.
- **Tabella dei glifi**: dentro l'entry `FONT`, un array di puntatori a strutture a
  campi fissi (`char: u16`, posizione, dimensione, `shift`, `offset`).

## Decisione proposta: sostituzione in place, senza rebuild

L'ostacolo che ha bloccato tutto finora è che **cambiare la dimensione di qualsiasi cosa
dentro `data.win` obbliga a ricalcolare tutti gli offset** (è il lavoro di ADR-004, non
ancora fatto). La proposta qui evita del tutto quel problema:

1. **Sacrificare glifi che non servono.** `fnt_ja_main` contiene 1.347 kanji. A un
   traduttore russo non serve nemmeno uno. I 66 caratteri cirillici (А–я) e i ~30
   accenti latini stanno comodamente in quello spazio.
2. **Riscrivere i pixel dentro l'area esistente.** Si decodifica la texture
   (BZip2 → QOI), si ridisegnano le celle dei kanji scelti con i glifi nuovi renderizzati
   da un TTF, si ricodifica. **Le dimensioni dell'immagine non cambiano.**
3. **Cambiare solo il `char` nella tabella.** Per ogni glifo riusato si riscrivono 2
   byte: da code point kanji a code point cirillico, più le metriche. **Struttura a
   dimensione fissa: nessuno spostamento.**
4. **Pareggiare la dimensione del blob compresso.** È l'unico punto delicato: BZip2 non
   dà una lunghezza prevedibile. Ma i glifi cirillici sono più semplici dei kanji, quindi
   il ricompresso sarà quasi certamente **più corto**; e poiché lo stream BZip2 ha un
   marcatore di fine, i byte residui fino alla lunghezza originale possono essere
   riempiti di zeri e vengono ignorati dal decoder. **Se invece risultasse più lungo, si
   abortisce con un messaggio chiaro** — mai scrivere un `data.win` corrotto.

Con questi quattro passi l'intervento è **byte-per-byte della stessa dimensione**, quindi
non richiede ADR-004 e non tocca nessun offset.

## Conseguenze

- Sblocca il cirillico e gli accenti su Deltarune e su ogni gioco GameMaker con font
  bitmap, che è la classe di giochi più richiesta dai nostri utenti.
- Dà a GameStringer una capacità che **nessun altro strumento di quella community ha**.
- Il font giapponese perde i kanji sostituiti: irrilevante per chi installa una patch
  russa, ma va **dichiarato** e va garantito il ripristino da backup.
- Serve un renderer di glifi. Crate mature e già compatibili: `qoi`, `bzip2`,
  `ab_glyph` o `fontdue` per la rasterizzazione.

## Rischi e come contenerli

| Rischio | Contenimento |
|---|---|
| Blob ricompresso più grande dell'originale | Verifica prima di scrivere; in caso, si annulla senza toccare il file |
| Metriche sbagliate → testo sovrapposto | Ricavare `shift`/`offset` dal rasterizzatore e provare su un sottoinsieme |
| Backup mancante → gioco rotto | Backup obbligatorio del `data.win` prima di ogni scrittura, come già fa il patcher |
| Stile incoerente (font pixel-art vs TTF moderno) | Scegliere un TTF pixel compatibile e rendere la scelta configurabile |

## Alternative scartate

- **Sostituire l'intera texture del font con una rigenerata**: più semplice, ma cambia
  l'aspetto anche delle lettere latine — su un gioco il cui stile è metà della sua
  identità, è una perdita che i fan non accettano.
- **Translitterare in ASCII** (Привет → Privet): leggibile, ma è una resa che nessun
  giocatore russo considererebbe una traduzione.
- **Aspettare ADR-004** e aggiungere i glifi allungando le strutture: corretto in teoria,
  ma rimanda tutto a un lavoro molto più grande e rischioso.

## Passi

1. Estrattore/reinseritore texture QOI+BZip2 con test sulla texture reale di Deltarune.
2. Lettore/scrittore della tabella glifi, con test che verifichi il round-trip
   byte-identico su un `data.win` non modificato.
3. Rasterizzatore dei glifi mancanti a partire dalla lingua di destinazione.
4. Comando Tauri `gm_inject_glyphs`, backup obbligatorio, e verifica della dimensione
   prima della scrittura.
5. Prova sul campo: una frase russa dentro Deltarune, letta a schermo.
