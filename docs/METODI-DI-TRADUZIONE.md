# Registro dei metodi di traduzione

**Quaderno di bordo di come si tira fuori il testo dai giochi.** Ogni volta che
si scopre come (o perché non si riesce a) estrarre, tradurre o reiniettare testo
in un engine, la scoperta finisce qui.

## Perché esiste

Le scoperte costano misure: aprire container da centinaia di MB, confrontare
tool, contare stringhe, sbagliare strada e capire perché. Se il risultato resta
in una chat o in un commento sepolto a riga 2817 di un file Rust, la volta dopo
si ricomincia da zero — e GameStringer, che deve arrivarci da solo, non ci arriva.

Regola: **una scoperta non registrata è una scoperta persa.**

## Formato di una voce

Ogni voce ha, nell'ordine:

1. **Il fatto** in una riga, in forma affermativa.
2. **Come è stato misurato** — comandi riproducibili e numeri veri, non stime.
3. **Quando** e su quale gioco.
4. **Dove vive nel codice** — file e funzione, così la scoperta è collegata.
5. **La trappola**, se ce n'è stata una: il ragionamento sbagliato da non rifare.

Se una voce diventa lunga, va in un documento suo e qui resta il riassunto con il
link (come per Unreal IoStore).

---

## Unreal Engine

### La profondità della cartella `Paks` va cercata, mai assunta

**Il fatto.** I finder di container e pak assumevano esattamente un livello di
sottocartella (`<gioco>/<sub>/Content/Paks`). Un gioco che ne annida due sparisce:
niente `.utoc`, niente `.pak`, e l'app dichiara «non espone testi estraibili» su
un gioco pieno di testo.

**Misura.** The Skin Stapler, 19/08/2026: percorso reale
`<install>/TheSkinStapler/TheSkinStapler/Content/Paks/`. Dopo la correzione
l'estrazione restituisce **1679 voci** dal `Game.locres` del gioco (1007 stringhe
uniche nella tabella: più chiavi possono puntare allo stesso testo).

**Nel codice.** `unreal_localization.rs::find_all_paks_dirs()` è l'unico modo di
cercare le cartelle `Paks` — ricorsivo fino a 5 livelli, con verifica che la
cartella contenga davvero `.pak`/`.utoc`. `find_paks_dir`, `find_utoc_files` e
`find_pak_files` ci si appoggiano tutti.

**Seconda trappola, stessa cartella (21/08/2026).** Non è solo una questione di
profondità: ogni gioco UE ha **almeno due** cartelle `Paks`, e quella che si
incontra per prima è quasi sempre il richiamo sbagliato —
`Engine/Programs/CrashReportClient/Content/Paks`, decine di MB di crash
reporter. Misurando quella si conclude che il gioco non ha localizzazione:
REANIMAL dava 45 MB e «nessun locres» contro i 15,6 GB della cartella vera, e
TerraTech Legion 46 MB contro 5,5 GB. Chi scrive uno script di analisi deve
scartare i percorsi sotto `Engine/Programs`, non fermarsi al primo `Paks`
trovato — che è esattamente quello che fa `find_all_paks_dirs()`, e il motivo
per cui va usata quella invece di una `find` improvvisata. Il controllo che
smaschera l'errore: The Skin Stapler DEVE risultare positivo (1679 voci), e
finché un metodo dice il contrario è il metodo a essere rotto.

**Trappola.** Il sintomo era una contraddizione a schermo: il pulsante prometteva
«.locres trovati», il pannello sotto negava. Erano **tre finder con due
profondità diverse in due file diversi** — `find_paks_dir` cercava già in modo
ricorsivo e trovava la cartella, gli altri due no. Quando due parti della UI si
contraddicono, sospetta due implementazioni della stessa domanda prima di
sospettare i dati.

**Ipotesi scartate** (verificate, non intuite): non mancava il codice che legge i
pak — `extract_iostore_localization` aveva già un fallback funzionante sui pak
classici, semplicemente irraggiungibile per via del return anticipato; e non era
Oodle, già presente nella cache tool.

Dettaglio completo: [UNREAL-DOVE-STANNO-I-LOCRES.md](UNREAL-DOVE-STANNO-I-LOCRES.md).

### I `.locres` possono stare nel container O nel `.pak` affiancato

**Il fatto.** Non c'è una regola sola. Vanno provati entrambi, e il codice lo fa.

**Misura.** Gioco di collaudo del 02/08/2026: `Game.locres` **dentro** il
container IoStore, 752 voci. The Skin Stapler, 19/08/2026: nessun `.locres` nel
container, quattro nel `.pak` affiancato, di cui uno del gioco con 1679 voci.
I `.locres` non sono asset, quindi non sono obbligati a passare dalla conversione
in Zen — ma niente vieta che ci finiscano.

**Nel codice.** `extract_iostore_localization()` prova prima il container, poi i
`.pak` classici (filtrando Engine e plugin, preferendo la cartella `/en/`), poi
come ultima risorsa i `.uasset` di localizzazione.

**Trappola.** Non scrivere «i locres stanno sempre in X». Ogni volta che sembra
esserci una regola secca sul packaging Unreal, probabilmente si è visto un gioco
solo.

### Pak con indice cifrato: la chiave la mette l'utente, non la ricaviamo noi

**Il fatto.** Alcuni giochi UE cifrano l'indice del `.pak` (AES-256, modalità
**ECB**, blocchi indipendenti da 16 byte) per scoraggiare il datamining. Con la
chiave l'indice si apre normalmente; la dimensione cifrata è quella dell'indice
arrotondata a multipli di 16.

**Scelta deliberata, non limite tecnico.** La chiave si potrebbe ricostruire
scandendo l'eseguibile del gioco — è ciò che fa il concorrente RuneTranslate —
ma sarebbe aggirare una misura tecnica di protezione, e `ANTI_PIRACY.md`
dichiara pubblicamente che non lo facciamo. La chiave la fornisce l'utente,
come in `repak --aes-key` e `retoc --aes-key`. Chi non ce l'ha resta fuori: è il
prezzo accettato della coerenza con quel documento.

**Nel codice.** `unreal_iostore.rs`: `parse_aes_key()` (accetta base64 a 44
caratteri o esadecimale a 64), `key_opens_pak_index()`, `decrypt_pak_index()`.
La chiave vive nello store cifrato insieme alle API key, sotto `PAK_AES::<gioco>`.
Comandi `set_pak_aes_key` / `has_pak_aes_key` / `clear_pak_aes_key`.

**Validare prima di parsare.** L'indice comincia con la FString del mount point,
un percorso tipo `../../../Gioco/Content/`. Bastano i primi 32 byte decifrati:
se la lunghezza è plausibile e i byte sono testo stampabile, la chiave è quella.
Senza questo controllo una chiave sbagliata produce byte casuali e l'errore
compare 200 righe più in là, dove nessuno lo collega alla chiave.

**Trappola.** «Indice cifrato» non va trattato come «gioco senza testo». Sono
due esiti diversi per l'utente: da una porta chiusa a chiave si può entrare
procurandosi la chiave, da una stanza vuota no. Nel codice il marcatore
`PAK_NEEDS_AES` risale fino alla UI proprio per tenerli separati.

**Seconda trappola (15/11/2026): il marcatore partiva solo sui giochi con `.utoc`.**
`extract_iostore_localization` usciva con «Nessun file .utoc trovato» prima di
arrivare al fallback sui `.pak` classici. Un gioco UE4 ha il solo `.pak`: se
l'indice è cifrato il marcatore non partiva mai e l'utente leggeva «non espone
testi estraibili». Misura: Fobia - St. Dinfna Hotel, un `.pak` da 3,3 GB con
indice cifrato, nessun `.utoc`. Ora si esce subito solo se mancano sia i `.utoc`
sia i `.pak`. Controllo riproducibile (sola lettura, deve finire con
`PAK_ENCRYPTED_NEEDS_AES_KEY`):

```bash
cd /c/GIT/GameStringer/src-tauri
GS_UE_GAME_PATH="E:/SteamLibrary/steamapps/common/FobiaStDinfnaHotel" cargo test --lib -- --ignored estrazione_su_gioco_reale --nocapture
```

### UE5 IoStore: un `_P.pak` da solo non si monta, serve la tripletta

**Il fatto.** Nei giochi UE5 IoStore (5.6+) un `_P.pak` da solo viene ignorato dal
motore in silenzio: il pak esiste, la UI dice «patch installata», il gioco resta
in lingua originale. Serve la tripletta `_P.pak` + `_P.utoc` + `_P.ucas`. La
coppia può essere **fittizia** (202+64 byte, zero asset): i `.locres` non sono
asset, quindi `retoc to-zen` produce una coppia vuota ma valida che, rinominata
col nome base del pak, lo fa montare.

**Misura.** 02/08/2026 su gioco reale: senza coppia patch invisibile, con la
coppia l'italiano è a schermo.

**Nel codice.** `retoc_wrapper.rs` (intestazione del modulo), costante
`RETOC_CONTAINER_VERSION = "UE5_7"`.

**Trappola.** L'asset GitHub di trumank si chiama `retoc_cli-…`, non `retoc-…`:
col nome sbagliato il download dà 404. E il «Rimuovi» cancella la tripletta
mentre l'apply ricreava solo il pak — patch orfana di nuovo, senza errori. La
coppia la deve scrivere l'apply, non l'utente a mano.

### Il reader di pak deve leggere la versione, non assumerla

**Il fatto.** L'indice di un `.pak` va parsato leggendo la versione dal footer.
Un parser con versione cablata fallisce **in silenzio** sui pak di altre versioni.

**Misura.** 02/08/2026: contatore con versione 4 cablata su un pak repak-V11 →
«0 stringhe tradotte» su una patch perfettamente funzionante.

**Nel codice.** `unreal_iostore.rs::pak_read_footer()`, usato da
`count_pak_translated_entries()`. Copre legacy v3–v9 e path-hash v10+.

### Senza Oodle il container è quasi tutto illeggibile

**Il fatto.** I blocchi dei container UE5 sono compressi Oodle. Senza la DLL si
leggono solo i blocchi non compressi, ed è troppo poco per servire a qualcosa.

**Misura.** 29/07/2026: 2,6–6,4% di blocchi in chiaro, e i file alla portata sono
enum e material function — **0,13 stringhe per file**.

**Nel codice.** `unreal_iostore.rs::OodleLib::load()` e
`find_oodle_dll_with_game()`.

**Trappola.** UE 5.8 (2025) ha rinominato la DLL da `oo2core_9_win64.dll` a
`oo2core.dll` nuda, in `runtimes/win-x64/native/`. Da non confondere con
`oo2tex_*` / `oo2texrt_*` (Oodle Texture): quelle non decomprimono i `.locres`.

**Nota aperta (19/08/2026).** `find_oodle_dll_with_game(Option<&Path>)` ha un ramo
che cerca la DLL nella cartella del gioco (`Binaries/Win64`, e la variante
annidata `<Gioco>/<Progetto>/Binaries/Win64`), ma l'unico chiamante è
`find_oodle_dll()` che passa `None`: quel ramo oggi è irraggiungibile. Molti
giochi UE spediscono la DLL accanto all'eseguibile, quindi passarle il path del
gioco allargherebbe la copertura a costo zero. Su The Skin Stapler non cambia
nulla — quel gioco non la spedisce — ma non è il caso generale.

---

## RPG Maker

### RPG Maker 2000/2003 non veniva riconosciuto affatto

**Il fatto.** GameStringer aveva un ramo dedicato che si presentava come
«RPG Maker classico (RPG_RT 2000/2003)» — con tanto di messaggio all'utente e,
da agosto 2026, l'aggancio al fallback a runtime. Quel ramo era
**irraggiungibile proprio per i giochi RPG_RT**: nessuno dei tre strati di
rilevamento sapeva riconoscerli.

**Come è emerso.** Installando Yume Nikki (RPG Maker 2003, gratuito su Steam,
app 650700) per provare il flusso completo. Interrogando i comandi direttamente
con `cargo run --example probe_rpgmaker -- "<percorso>"`:

```text
detect_rpgmaker_game -> ERRORE: Non sembra essere un gioco RPG Maker
```

…su una cartella che contiene `RPG_RT.exe`, `RPG_RT.ldb`, `RPG_RT.lmt`,
`RPG_RT.ini` e 60+ `Map####.lmu`.

**Perché.** Tre strati, tutti ciechi allo stesso modo:

1. `engine_detector::is_rpg_maker()` cercava `www/data/System.json` (MV/MZ),
   `Game.rpgproject` e `rgss*.dll` (XP/VX/VXAce). Nessun controllo su `RPG_RT.*`.
2. `RpgMakerVersion` non aveva una variante per 2000/2003: si ricadeva in
   `Unknown`, e `detect_rpgmaker_game` restituiva errore.
3. Nel frontend quell'errore finiva in
   `} catch { /* detect fallito → prosegui col workflow file-based normale */ }`,
   quindi il ramo «classico» veniva saltato **in silenzio**.

**La cura.** Variante `RpgMakerVersion::RT`, rilevamento sui file **dati** e
ricerca in profondità. Per RT `find_data_files` ritorna `Ok(vec![])`: zero file
dati **non è un errore**, è il fatto che manda questi giochi al runtime — se
tornasse `Err`, il rilevamento fallirebbe e il ramo resterebbe irraggiungibile
come prima.

**Due accortezze, entrambe già costate altrove.**

- **Mai cercare l'eseguibile.** Moltissimi giochi RPG_RT rinominano `RPG_RT.exe`
  col titolo. `RPG_RT.ldb` e `RPG_RT.lmt` non si toccano mai: sono quelli il
  marcatore. Una scansione della libreria che cerca `RPG_RT.exe` conclude «non
  ne hai» anche quando ne hai.
- **La profondità va cercata.** Steam installa Yume Nikki in
  `common/Yume Nikki/**yumenikki**/`: cercare solo nella radice non lo trova. È
  identica alla trappola dei `Paks` di Unreal, in un altro punto del codice.
  `find_rpg_rt_dir` cerca fino a 3 livelli e `detect_rpgmaker_game` **riporta la
  cartella trovata**, non la radice, così chi legge il risultato non deve
  rifare la ricerca.

**Dopo.** Dalla radice d'installazione, cioè il percorso che passa l'app:

```text
version: RT
path:    …\Yume Nikki\yumenikki      (risolto, non la radice)
title:   Yume Nikki
data_files: []          estrazione: 0 stringhe
```

Che sono esattamente le condizioni del ramo classico (`isMvMz` falso, stringhe
`<= 0`), quindi ora scatta — e con esso il fallback a runtime della PR #87.

**Anche l'eseguibile va cercato in profondità.** `find_executables_in_folder`
leggeva solo la radice: su `common/Yume Nikki` non trovava nulla, perché
`RPG_RT.exe` sta in `yumenikki/`. L'esito era peggiore di «non trovato»: chi
chiama ripiega sul nome del gioco (`YumeNikki.exe`), che non esiste, e poi cerca
un processo che non esisterà mai — il fallback direbbe «avvia il gioco» a gioco
già avviato. Ora, **se e solo se** la radice è vuota, guarda un livello sotto.
Con questa, la stessa lezione è comparsa in quattro punti indipendenti del
codice: i `Paks` di Unreal, il rilevatore RPG Maker, l'engine detector e la
ricerca dell'eseguibile.

**Prova del flusso completo (21/08/2026).** Con Yume Nikki in esecuzione, premuto
«STRING IT!» nella scheda del gioco. L'app mostrava già la strategia corretta —
«RPG Maker · RT — 0 file, 0 stringhe» — e il flusso è arrivato in fondo:

```text
[gs-hook] connesso a GameStringer via IPC
[gs-hook] dizionario pre-caricato: 0 voci da …\GameStringer\gs-hook-cache.gstc
[gs-hook] sorgente attiva: GDI (ExtTextOutW/DrawTextW) (livello 2)
[gs-hook] sorgente attiva: GDI/GetGlyphOutline (estrazione) (livello 2)
```

Tre conferme indipendenti: il log scritto nell'istante del clic; `RPG_RT.exe` è
a **32 bit**, quindi è stata iniettata la x86 e la selezione dual-arch ha
funzionato; ed esiste una finestra «GameStringer Overlay», che
`ensure_overlay_window()` crea **solo** dentro il ramo di successo
dell'iniezione. È la prima volta che il percorso dal pulsante al gioco viene
percorso per intero.

**La trappola.** Un ramo con un messaggio scritto bene, un commento circostanziato
e persino dei test a valle sembra codice vivo. Questo era morto da sempre, e non
per un difetto suo: per una condizione a monte che non poteva essere vera.
Prima di credere che un percorso funzioni, va provato con un input che lo
imbocchi davvero — qui è bastato installare un gioco.

## Unity

### Fran Bow: sei lingue fisse per frase in `resources.assets`, e i font sono già pronti per l'italiano

**Il fatto.** In Fran Bow (Unity 2021.3.16f1, Mono) ogni frase del gioco è un
array di 6 stringhe, una per lingua, dentro `resources.assets`: è l'unico file
con testo non inglese, i 145 file di scena `levelN` contengono solo inglese. Le
colonne sono fisse, nell'ordine **pt · fr · de · ru · es · en**. L'italiano non
c'è, e aggiungerlo come settima lingua vuol dire toccare il codice del gioco. Le
tabelle font TextMeshPro invece hanno già tutte le accentate italiane: per
l'italiano non serve nessun override di font.

**Misura.** Fran Bow, Steam app 362680, build 11189293, 12/09/2026:

```bash
node scripts/unity-loc-probe.js "C:/Program Files (x86)/Steam/steamapps/common/Fran Bow/Fran Bow_Data"
```

| Cosa | Risultato |
|---|---|
| Tabelle font TMP | 3 (due in `resources.assets` da 250 caratteri, una in `sharedassets0.assets` da 235): a nessuna manca `à è é ì ò ù À È É Ì Ò Ù ’` |
| File con testo non inglese | 1 su 146: `resources.assets` |
| Righe di localizzazione | 8.325, su 8.340 array di 6 stringhe (i 15 scartati sono keyword shader come `UNITY_UI_ALPHACLIP`) |
| Inglese | 300.563 caratteri, 58.186 parole · lunghezza mediana 35, 95° percentile 73, massimo 98 |
| Formattazione | 0 tag rich text, 0 segnaposto `{…}` o `%s` · 11 «a capo» e 8 azioni tra asterischi (`*hic*`) da preservare |
| Spazio a schermo | francese/inglese: mediana 1,16, 95° percentile 1,50 — l'italiano sta in questa fascia, e il gioco la mostra già |

Le stringhe sono nel formato Unity standard (int32 lunghezza + UTF-8, allineate a
4 byte), non Odin, anche se `Sirenix.Serialization.dll` è tra le assembly del
gioco. Le lingue ufficiali, dall'API di Steam:

```bash
curl -s "https://store.steampowered.com/api/appdetails?appids=362680&l=english" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)['362680'].data.supported_languages.replace(/<[^>]+>/g,'')))"
```

→ `English, German, Spanish - Spain, Russian, French, Portuguese - Brazil`. E
nei dati del gioco la parola `Italiano` compare zero volte.

**Cosa ne segue per il metodo.** Due strade, **nessuna ancora provata in gioco**:

- **XUnity via BepInEx (la più sicura).** GameStringer riconosce il gioco come
  Mono (`MonoBleedingEdge` presente, `GameAssembly.dll` assente), e fra i
  pacchetti di `unity_patcher.rs` c'è BepInEx 5.4.23.5 x64 per Mono, adatto a
  Unity 2021.3. `needs_font_override("it")` è falso, ed è giusto così: i glifi
  ci sono. Non si tocca `resources.assets`.
- **File-based, sovrascrivendo una colonna.** Due ostacoli misurati. Il testo
  italiano è più lungo, quindi `resources.assets` va riserializzato, non
  patchato in-place: in GameStringer lo fa `tools/unity_inject.py` tramite
  `unity_asset_injector.rs`, parte non coperta dalla CI. E lo scan euristico di
  `unity_assets.rs` **scarterebbe 1.057 righe inglesi su 8.324** («Eww!»,
  «No... Um.», «A door!», «Jump...»), perché `looks_like_game_text` vuole almeno
  uno spazio e più di 5 lettere. Prima dell'euristica, `scan_assets_for_text`
  prova a estrarre i TextAsset, mentre queste frasi stanno in campi di script:
  quale dei due rami parta su questo file **non è stato verificato**.

*Sospetto, non misurato:* nei file di scena compaiono chiavi come
`Mr. Midnight.: Use`, e tra le righe ci sono pezzi di frase. Se il gioco compone
le battute a runtime, un italiano tradotto a pezzi rischia accordi sbagliati con
le preposizioni articolate (a + la → «alla»), mentre XUnity vede la frase già
composta.

**Nel codice.**

- `scripts/unity-loc-probe.js` — la sonda di questa voce, sola lettura.
- `src-tauri/src/commands/unity_patcher.rs` — `BEPINEX5_X64_URL`, rilevamento
  Mono/IL2CPP (`is_il2cpp`), `needs_font_override`.
- `src-tauri/src/commands/unity_assets.rs` — `scan_assets_for_text`,
  `looks_like_game_text`.
- `src-tauri/src/commands/unity_asset_injector.rs` → `tools/unity_inject.py`.
- `src-tauri/src/commands/gamemaker_patcher.rs` — `find_data_win` (vedi trappola 5).

**Trappole.**

1. **La ricerca web ha detto che l'italiano c'è.** Era un riassunto automatico
   sbagliato. La pagina Steam sta dietro la verifica dell'età e un fetch non la
   legge; l'API `appdetails` sì. Le lingue ufficiali si leggono lì, e si
   confermano nei file.
2. **«Mr. Midnight» nei `levelN` sembrava dialogo.** Lì ci sono solo inglese e
   chiavi. Si contano parole-spia per lingua e per file, invece di fidarsi della
   prima occorrenza.
3. **La prima firma di record prendeva il menu, non i dialoghi.** Ancorata ai
   campi che precedono l'array (`-1`, `0`, ID, …, `9`, `6`) trovava 48 righe con
   ID 8726–8773: i nomi delle lingue. Le frasi hanno un'intestazione diversa;
   l'unica cosa comune a tutte è l'array di 6 stringhe.
4. **Un array di 6 stringhe non è per forza una frase.** Anche 15 liste di
   keyword shader hanno quella forma, e gonfiavano ogni conteggio. Il filtro che
   le separa si ricava dai dati: colonna russa in cirillico, oppure uguale
   all'inglese.
5. **La cartella `Fran Bow GameMaker` non confonde nessuno.** Contiene il
   `data.win` della versione originale del 2015. `detect_gamemaker` guarda solo
   la radice, e `find_data_win` pure: il suo ramo commentato «Subdirectories»
   itera la radice e tiene solo i file, quindi nelle sottocartelle non scende.
6. **Ambiente.** In Git Bash non c'è `strings`, e Python sulla console Windows
   (cp1252) si ferma stampando caratteri come `ő`. Per questo la sonda è in
   Node, come le altre in `scripts/`.

### TextAsset in Rust (`unity_serialized.rs`): misurato su un gioco vero, e perché non entra da solo in String it

**Il fatto.** Il riscrittore dei TextAsset tutto in Rust non restituiva il file
identico nemmeno senza sostituzioni: ricompattava gli oggetti con allineamento
a 4 byte e perdeva il riempimento originale e la coda del file. Corretto
l'11/11/2026: ora conserva i vuoti fra gli oggetti e la coda, e quando un testo
cambia lunghezza sposta gli oggetti successivi solo di multipli di 16 byte,
così ognuno mantiene l'allineamento che aveva.

**Misura.** art of rally (Steam, Unity 2019.4.38f1, SerializedFile v21), 11/11/2026,
sola lettura — non scrive nella cartella del gioco:

```bash
cd src-tauri && GS_UNITY_SHOW=1 GS_UNITY_DATA_DIRS="E:/SteamLibrary/steamapps/common/artofrally/artofrally_Data"   cargo test --bin gamestringer real_games_roundtrip -- --ignored --nocapture
```

| Cosa | Prima | Dopo |
|---|---|---|
| File `.assets` riconosciuti | 63 su 63 | 63 su 63 |
| Riscrittura senza sostituzioni identica byte per byte | 1 su 63 | 63 su 63 |
| Allungare un TextAsset e rileggerlo (testo nuovo presente, gli altri invariati) | ok | ok |
| TextAsset trovati | 23, tutti in `resources.assets` | 23 |

**Cosa contengono quei 23 TextAsset.** 9 assetti delle auto (`[body] weight=900 …`),
4 classifiche JSON (`top-times*`, fino a 199 KB), 4 tabelle di caratteri per
l'a capo di TextMeshPro, 2 README di un pacchetto di texture, un numero di
versione, una nota di una cartella, e **un solo** file con testo per il
giocatore: `achievements` (JSON, 14 KB).

**Cosa ne segue.** Tradurre «tutti i TextAsset» romperebbe il gioco: l'assetto
di un'auto è un TextAsset quanto un dialogo. Un metodo statico automatico su
Unity deve prima RICONOSCERE quali TextAsset sono tabelle di localizzazione
(CSV con colonne lingua, JSON con chiavi lingua, formati I2/SimpleLocalization)
e toccare solo quelli, campo per campo. Finché quel riconoscitore non c'è, il
piano di String it tiene XUnity come primo metodo per Unity.

**Trappole.**

1. **«12 giochi Unity installati» erano 1.** Le cartelle `*_Data` in
   `steamapps/common` restano dopo la disinstallazione, con dentro una cartella
   `Languages` o poco altro. Si contano i file `.assets`, non le cartelle.
2. **`data.unity3d` non è coperto.** Lost Host Demo ed Esoteric Ebb tengono
   tutto in un bundle UnityFS: zero file `.assets` sciolti, quindi questo
   riscrittore non li vede.
3. **Rileggere col proprio parser non prova che il gioco carichi il file.** Il
   test «allungo e rileggo» passava anche PRIMA della correzione, con il file
   già diverso dall'originale. L'unica prova forte senza avviare il gioco è
   l'identità byte per byte a sostituzioni vuote.
4. **`| tail` in fondo a un comando di misura taglia la misura.** La prima
   tabella mostrava solo art of rally perché le righe degli altri giochi non
   c'erano; ma l'avrebbe mostrata uguale se fossero state tagliate. Si salva
   l'uscita intera e si conta.

**Nel codice.** `src-tauri/src/commands/unity_serialized.rs` —
`rewrite_text_assets`, test `real_games_roundtrip` (ignorato, vuole
`GS_UNITY_DATA_DIRS`). Nessuna pagina chiama ancora `extract_unity_text_assets`
/ `rewrite_unity_text_assets`.

### Riconoscere le tabelle di localizzazione fra i TextAsset (`unity_loc_tables.rs`)

**Il fatto.** Dall'11/11/2026 un riconoscitore decide quali TextAsset sono
tabelle di localizzazione. È conservativo: dice sì solo se il file dichiara da
solo **almeno due lingue** — CSV/TSV con colonne-lingua nell'intestazione, JSON
con chiavi-lingua al primo livello o nelle voci di un elenco. Nel dubbio dice
no. Il numero di tabelle entra nel piano di String it (`unity_loc_tables`), che
su Unity aggiunge il metodo `unity-loc-tables` **dopo** XUnity e non automatico:
le tabelle si sanno leggere, non ancora riscrivere nel gioco.

**Misura.** Sola lettura, 11/11/2026:

```bash
cd src-tauri && GS_UNITY_GAME_DIRS="E:/SteamLibrary/steamapps/common/artofrally;E:/SteamLibrary/steamapps/common/Lost Host Demo"   cargo test --bin gamestringer real_games_loc_tables -- --ignored --nocapture
```

| Gioco | File `.assets` | TextAsset | Prese per tabelle | Tempo |
|---|---|---|---|---|
| art of rally | 63 | 23 | 0 (giusto: nessuno lo è) | 79 ms |
| Lost Host Demo | 0 (tutto in `data.unity3d`) | — | 0 | 1 ms |

I 79 ms valgono perché `extract_text_assets_from_path` legge dal disco solo la
tabella degli oggetti e i singoli TextAsset, non i file interi (il solo
`resources.assets` è 235 MB).

**Cosa NON è misurato.** Una tabella con più lingue nello STESSO file (CSV con
colonne-lingua, JSON con chiavi-lingua) su un gioco vero: quel sì è coperto
solo da test con dati scritti a mano. Il sì misurato dal vero è quello delle
famiglie di file per lingua, nella voce qui sotto.

**Trappole.**

1. **`id` e `no` sono codici ISO** (indonesiano, norvegese): l'intestazione
   `name,id,no` sembrerebbe una tabella a due lingue. Sono esclusi, insieme a
   `is` e `to`.
2. **Un file che comincia con `[` o `{` si giudica solo come JSON.** `[body]
   weight=900` è l'assetto di un'auto: letto come CSV non avrebbe lingue, ma è
   meglio non provarci nemmeno.
3. **`serde_json` ordina le chiavi.** Le lingue di un JSON escono in ordine
   alfabetico, non di comparsa: non usarne l'ordine per decidere la lingua
   sorgente.
4. **Testo in una lingua sola non è una tabella.** `achievements` di art of
   rally è l'unico TextAsset con testo per il giocatore, ed è rifiutato di
   proposito: senza conoscere il gioco non si sa quali campi tradurre.

**Nel codice.** `src-tauri/src/commands/unity_loc_tables.rs` — `recognize`,
`scan`, comando `scan_unity_loc_tables`; `translation_plan.rs` — `probe`.

### Leggere dentro `data.unity3d` (`unity_fs.rs`), e i file per lingua di Lost Host Demo

**Il fatto.** Molti giochi Unity non hanno file `.assets` sciolti: tutto sta in
un bundle UnityFS. Dall'11/11/2026 c'è un lettore scritto da zero che tiene in
memoria solo l'indice dei blocchi e decomprime, a richiesta, quelli che coprono
i byte chiesti. Il decompressore di `unity_localization.rs` carica il file
intero e decomprime ogni blocco: su un bundle di gigabyte non è usabile.
`unity_serialized::extract_text_assets_from` ora legge da una sorgente
qualunque (`ReadAt`): un file su disco o un file interno al bundle.

**Misura.** Lost Host Demo (Steam, Unity 6000.3.8f1, UnityFS v8), 11/11/2026,
sola lettura:

```bash
cd src-tauri && GS_UNITY_BUNDLES="E:/SteamLibrary/steamapps/common/Lost Host Demo/LostHost_Data/data.unity3d" \
  cargo test --bin gamestringer real_bundles -- --ignored --nocapture
cd src-tauri && GS_UNITY_SHOW=1 GS_UNITY_GAME_DIRS="E:/SteamLibrary/steamapps/common/Lost Host Demo" \
  cargo test --bin gamestringer real_games_loc_tables -- --ignored --nocapture
```

| Cosa | Risultato |
|---|---|
| Bundle su disco | 2,78 GB, flag `0x243` (indice LZ4HC, riempimento a 16 prima dei blocchi) |
| Apertura (solo indice) | 15 ms |
| Blocchi | 43.701, flusso decompresso 5.462 MB |
| File interni | 94: 9 serializzati (`globalgamemanagers`, `resources.assets`, `sharedassets0-2.assets`, `level0-2`…), i `.resS` con texture e audio, e la luce precalcolata in `GI/` |
| Versione dei file serializzati | 22 — **prima lettura di una v22 vera**, il parser la legge |
| TextAsset trovati | 20 (15 in `sharedassets0.assets`, 5 in `resources.assets`) |
| Tabelle riconosciute | 14 su 15 file lingua; art of rally resta a 0 |
| Tempo di due passate complete | 82 ms |

**Lo schema di Lost Host Demo.** La localizzazione è una **famiglia di file per
lingua**: 15 TextAsset `LOST_HOST - <Lingua>`, ognuno un CSV a due colonne
`testo inglese,traduzione`, da 288 a 300 righe. L'italiano c'è già. Il
riconoscitore cercava più lingue nello stesso file e dava zero: ora riconosce
anche le famiglie (almeno due TextAsset dello stesso file, stesso nome, lingua
diversa in coda).

**Cosa ne segue.** Per un gioco fatto così, aggiungere una lingua che manca non
è «riempire una colonna»: o si sovrascrive il file di una lingua che non serve,
o si aggiunge un TextAsset nuovo (e il gioco deve saperlo elencare). È una
scelta da prendere quando si scriverà la scrittura, non prima.

**Trappole.**

1. **`Ukranian`.** Il gioco scrive male «Ukrainian», quindi quel file non è
   riconosciuto: 14 su 15. Non ho aggiunto l'errore di battitura alla lista
   delle lingue; una famiglia già riconosciuta potrebbe però accogliere i
   membri con lo stesso nome e coda sconosciuta.
2. **Il primo campo dopo la firma non dice se un file interno è
   serializzato.** I `.resS` e i file in `GI/` hanno byte casuali dove ci si
   aspetta la versione: si saltano per nome, e per il resto decide
   `is_serialized_file`.
3. **Leggere oltre la fine di un file interno restituirebbe l'inizio del
   successivo**, senza errore, perché il flusso decompresso è unico. Il lettore
   controlla i limiti del nodo (c'è un test).
4. **Esoteric Ebb non ha né `.assets` né `data.unity3d`** nella cartella
   `_Data`: zero TextAsset in 10 ms. Probabilmente usa bundle Addressables in
   `StreamingAssets`; non verificato.

**Nel codice.** `src-tauri/src/commands/unity_fs.rs` — `Bundle::open`,
`read_stream`, `NodeReader`, tratto `ReadAt`; `unity_loc_tables.rs` —
`text_assets`, `recognize_families`, `name_language`. LZMA non è supportato
(errore esplicito).

### Scrivere dentro `data.unity3d`: `Bundle::rewrite_node`

**Il fatto.** Dall'11/11/2026 `unity_fs.rs` sa produrre un bundle nuovo in cui
un file interno è sostituito. Ricomprime solo i blocchi che contengono byte di
quel file (in blocchi LZ4 da 128 KB, la misura di Unity); tutti gli altri si
copiano dall'originale compressi come sono. I file interni successivi slittano
di un multiplo di 16 byte. L'originale non viene mai aperto in scrittura.

**Misura.** Lost Host Demo, 11/11/2026. Si sostituisce il TextAsset
`LOST_HOST - Italian` (una riga in più, con accentate) dentro
`sharedassets0.assets` e si scrive il bundle in una cartella a parte:

```bash
cd src-tauri && GS_UNITY_BUNDLE="E:/SteamLibrary/steamapps/common/Lost Host Demo/LostHost_Data/data.unity3d" \
  GS_UNITY_NODE="sharedassets0.assets" GS_UNITY_ASSET="LOST_HOST - Italian" GS_UNITY_OUT="<cartella con 3 GB liberi>" \
  cargo test --bin gamestringer real_bundle_rewrite -- --ignored --nocapture
```

| Cosa | Risultato |
|---|---|
| Tempo di scrittura | 8,5 s |
| Blocchi ricompressi | 499 su 43.702 (quelli di `sharedassets0.assets`, 63 MB) |
| Byte copiati senza decomprimere | 2.747.970.175 |
| Byte ricompressi | 36.367.265 |
| Dimensione | 2.778.817.629 → 2.784.531.472 (+5,7 MB) |
| File interni identici all'originale | 93 su 94; l'unico diverso è quello sostituito |
| TextAsset modificato, riletto dal bundle nuovo | testo nuovo presente, gli altri 14 invariati |
| Tempo del confronto completo (5,4 GB decompressi due volte) | 120 s |

**Il gioco carica il bundle riscritto: provato l'11/11/2026.** Vedi la voce
qui sotto. Le due ipotesi — blocchi LZ4 «veloce» al posto di LZ4HC, e un blocco
più corto di 128 KB in mezzo al flusso — reggono su Unity 6000.3.

**Trappole.**

1. **Il bundle cresce** di 5,7 MB perché `lz4_flex` comprime meno di LZ4HC. È
   innocuo, ma un confronto «stessa dimensione» fallirebbe sempre.
2. **Il campo dimensione nell'intestazione è la lunghezza del file**: va
   riscritto dopo aver finito, non prima.
3. **`rmdir` su una cartella temporanea fuori dal progetto** è stato bloccato
   dal controllo di sicurezza dell'ambiente. Il test cancella da sé il file che
   crea; per le prove si usa una cartella che non richieda pulizie a mano.

**Nel codice.** `src-tauri/src/commands/unity_fs.rs` — `Bundle::rewrite_node`,
`RewriteStats`, test `real_bundle_rewrite` (ignorato). Nessun comando Tauri lo
espone ancora: non è raggiungibile dall'interfaccia.

### Lost Host Demo: il bundle riscritto si carica, ma il testo che il gioco mostra NON sta nei TextAsset

**Il fatto.** Sostituire il file della lingua **lituana** con un altro non ha
cambiato quello che il gioco mostra. I 15 TextAsset `LOST_HOST - <Lingua>`
esistono, ma il lituano è **anche incorporato nella scena `level0`**: è la
lingua dello sviluppatore (GestLT) e fa da testo predefinito.

> **Due correzioni del giorno stesso.** La prima stesura diceva che il gioco
> legge sempre la copia nella scena e che i CSV sono solo materiale di partenza.
> La seconda la ritrattava: «nella scena c'è solo il lituano, le altre lingue
> passano dai TextAsset». Era sbagliata la seconda. La misura fatta con
> `unity_static` (voce «Il metodo statico dentro String it») conta i testi di
> ogni lingua negli script delle scene: **tutte e 14 le lingue sono
> incorporate**, da 271 a 285 testi ciascuna. La prima stesura era giusta.
> L'errore è nato dal guardare un solo oggetto (`path_id 3540`, la tabella
> lituana) e generalizzare.

**Prova nel gioco**, 11/11/2026, con il consenso del proprietario. Scritto nel
bundle installato il testo italiano al posto di quello lituano
(`replace_node_in_place`, originale tenuto come `data.unity3d.gs_backup`):

| Cosa | Risultato |
|---|---|
| Scrittura nel gioco | 14,7 s, 498 blocchi ricompressi su 43.701 |
| Il gioco parte con il bundle riscritto | sì: `Player.log` riporta «Loading player data from …/data.unity3d», carica le scene fino a `Chapter1` ed esce con «Exit button pressed», senza errori di archivio |
| Il lituano in gioco diventa italiano | **no** |
| Ripristino | originale rimesso, 2.778.817.629 byte come prima |

**Misura che spiega il no.** Ricerca di testo in tutti i file interni del
bundle (sola lettura):

```bash
cd src-tauri && GS_UNITY_BUNDLE="E:/SteamLibrary/steamapps/common/Lost Host Demo/LostHost_Data/data.unity3d" GS_UNITY_GREP="Nustatymai" \
  cargo test --bin gamestringer -- commands::unity_fs::real_bundle_grep::real_bundle_grep --ignored --nocapture --exact
```

| Testo cercato | Bundle originale | Bundle con il lituano sostituito |
|---|---|---|
| `Nustatymai` («Impostazioni» in lituano) | `sharedassets0.assets` 1 volta, `level0` 3 volte | solo `level0` 3 volte |
| `Žaisti` («Gioca» in lituano) | — | `level0` 2 volte |
| `Impostazioni` | — | `sharedassets0.assets` 2 volte, `level0` 1 volta |

Dopo la sostituzione il lituano è sparito dal TextAsset ma è rimasto in
`level0`: il menu continua a leggerlo da lì.

**Cosa ne segue.**

1. **Un TextAsset di localizzazione che esiste non è per forza quello che il
   gioco legge.** Il riconoscitore dice «qui ci sono tabelle», non «il gioco le
   usa». Prima di proporre un metodo statico bisogna controllare che il testo
   non compaia anche altrove (la ricerca qui sopra costa pochi secondi).
2. Per questo gioco la via statica passa dai campi stringa degli oggetti di
   scena (`level0`, `level2`), come per Fran Bow: stringhe con lunghezza in
   testa, allineate a 4 byte, dentro oggetti senza albero dei tipi. In Rust
   quel motore non esiste ancora; oggi lo fa solo `tools/unity_inject.py`.
3. Lo scrittore di bundle e il backup per rinomina sono validati dal vero e
   restano utili per quel motore: cambia cosa si riscrive, non come.

**Trappole.**

1. **Consigliare «sovrascrivi una lingua» prima di aver cercato dove sta
   davvero il testo.** È stato l'errore di questa voce: la prova in gioco è
   costata un backup da 2,78 GB e un avvio, la ricerca sarebbe costata un
   minuto.
2. **Il filtro di `cargo test` prende per sottostringa.** `real_bundle_apply`
   è anche il nome del modulo che contiene `real_bundle_restore`: senza il
   nome completo e `--exact` partirebbero insieme, applicando e ripristinando.
3. **«Il gioco è partito» si legge nel registro**, non si deduce:
   `%USERPROFILE%/AppData/LocalLow/GestLT/LostHost/Player.log`.

**Nel codice.** `src-tauri/src/commands/unity_fs.rs` — `replace_node_in_place`,
`restore_original`, test `real_bundle_apply`, `real_bundle_restore`,
`real_bundle_grep` (tutti ignorati; i primi due SCRIVONO nella cartella del
gioco).

### Tradurre le stringhe dentro gli oggetti di scena (`unity_strings.rs`)

**Il fatto.** Dall'11/11/2026 c'è un motore in Rust che trova le stringhe nel
corpo di un oggetto Unity (lunghezza in 4 byte, UTF-8, riempimento a zero fino
al multiplo di 4, cercate solo a posizioni multiple di 4) e sostituisce quelle
**esattamente uguali** a un testo da tradurre, anche con lunghezza diversa.
Dentro un oggetto i campi sono in fila, senza puntatori interni, quindi basta
spostare ciò che segue; la dimensione nuova dell'oggetto la sistema
`unity_serialized::rewrite_objects`, che ora sostituisce il corpo di un oggetto
di qualunque tipo.

**Com'è fatta la tabella incorporata di Lost Host Demo.** In `level0` l'oggetto
`path_id 3540` (MonoBehaviour, 18.592 byte) contiene 577 stringhe a coppie
`chiave, testo lituano`: `Play`, `Žaisti`, `Settings`, `Nustatymai`… Altri 31
MonoBehaviour da ~528 byte hanno una sola stringa: il testo predefinito di
un'etichetta dell'interfaccia.

**Misura.** Tutta in memoria, non scrive nulla. Si traduce il lituano
incorporato usando come dizionario i due TextAsset del gioco (lituano e
italiano, appaiati per chiave):

```bash
cd src-tauri && GS_UNITY_BUNDLE="E:/SteamLibrary/steamapps/common/Lost Host Demo/LostHost_Data/data.unity3d" \
  GS_UNITY_NODE="level0" GS_UNITY_TABLES="sharedassets0.assets" \
  GS_UNITY_FROM="LOST_HOST - Lithuanian" GS_UNITY_TO="LOST_HOST - Italian" \
  cargo test --bin gamestringer -- commands::unity_strings::real_scene_translate::real_scene_translate --ignored --nocapture --exact
```

| Cosa | `level0` | `level2` |
|---|---|---|
| Oggetti | 3.820 | 15.595 |
| Voci nelle tabelle (lituano / italiano) | 295 / 291 | idem |
| Coppie traducibili dopo le regole di sicurezza | 279 | idem |
| Oggetti toccati | 32 (uno da 274 stringhe, 31 da una) | 5 |
| Stringhe sostituite | 305 | 5 |
| Stringhe lasciate identiche | 11.221 | 6.356 |
| Stringhe sbagliate (controllo posizione per posizione) | 0 | 0 |
| Oggetti non toccati identici byte per byte | tutti | tutti |
| Dimensione del file | 1.390.912 → 1.391.088 | invariata |

In `level1` e in `sharedassets0.assets` non cambia niente: lì il lituano è
dentro il CSV, che è un'unica stringa lunga e non è uguale a nessuna voce.

**Regole di sicurezza** (`translation_map`, con test):

1. **Un testo che è anche una chiave non si traduce mai.** La tabella tiene
   chiavi e testi come stringhe una accanto all'altra: se «OK» si dice «OK»,
   sostituire quel testo cambierebbe anche la chiave.
2. **Un testo con due traduzioni diverse si lascia stare.** Se «Atgal» vale
   sia `Back` sia `Return`, non si sa quale voce si sta guardando.
3. Si sostituisce solo per uguaglianza esatta: «Play now» non è «Play».

Per queste regole 16 voci su 295 restano in lituano: è il prezzo del non
rompere il gioco.

**Provato in gioco l'11/11/2026.** Scritto `level0` tradotto nel bundle
installato (305 stringhe, 13 s, 12 blocchi ricompressi su 43.702, originale
tenuto come backup): il gioco parte, e scegliendo il lituano **il menu è in
italiano**, visto dal proprietario del gioco. `Player.log`: caricamento di
`data.unity3d` e uscita con «Exit button pressed», nessun errore. Poi
l'originale è stato ripristinato.

```bash
cd src-tauri && GS_UNITY_BUNDLE="E:/SteamLibrary/steamapps/common/Lost Host Demo/LostHost_Data/data.unity3d" \
  GS_UNITY_NODE="level0" GS_UNITY_TABLES="sharedassets0.assets" \
  GS_UNITY_FROM="LOST_HOST - Lithuanian" GS_UNITY_TO="LOST_HOST - Italian" \
  cargo test --bin gamestringer -- commands::unity_strings::real_scene_apply::real_scene_apply --ignored --nocapture --exact
```

È la prima traduzione statica di un gioco Unity fatta solo con i motori Rust
(lettore e scrittore di bundle, riscrittura di oggetti, sostituzione di
stringhe) e vista funzionare in gioco, su Unity 6000.3.

**Cosa NON è provato.**

- Un dizionario fatto da una traduzione AI: qui i testi nuovi erano
  l'italiano ufficiale del gioco. La catena tecnica è la stessa, cambia solo
  da dove arrivano i testi.
- `level2` (il gioco vero dopo «Nuova partita»): misurato in memoria, non
  scritto.
- Più file interni nella stessa passata: `replace_node_in_place` ne sostituisce
  uno e riparte sempre dall'originale, quindi una seconda chiamata su un altro
  file annullerebbe la prima. Serve una versione che ne prenda più d'uno.
- Giochi con i file `.assets` sciolti, e versioni di Unity diverse da 6000.3.
- Il motore non è collegato a nessun comando né a String it.

**Trappole.**

1. **Contare «quante stringhe sono uguali a una chiave» prima e dopo non
   verifica niente.** Dopo la traduzione ce n'erano 6 in più (4.472 → 4.478):
   non chiavi rovinate, ma parole italiane come «Audio» e «Video» che
   coincidono con chiavi inglesi. Il controllo giusto è posizione per
   posizione: stesso numero di stringhe, e la i-esima è il testo nuovo se era
   in mappa, identica altrimenti.
2. **`| head` in fondo alla misura ha tagliato di nuovo l'uscita** (la riga di
   riepilogo di `level0` non c'era). Seconda volta in un giorno: l'uscita di
   una misura si salva su file e ci si cerca dentro.
3. **Trovare stringhe è un'euristica, e non importa.** Su `level0` i candidati
   sono 11.526; fra loro ci saranno byte che per caso sembrano testo. Non si
   toccano perché non sono uguali a nessuna voce del dizionario.

**Nel codice.** `src-tauri/src/commands/unity_strings.rs` — `find_strings`,
`replace_strings`, `translation_map`, test `real_scene_strings` e
`real_scene_translate` (ignorati, sola lettura); `unity_serialized.rs` —
`list_objects`, `rewrite_objects`.

### Il metodo statico dentro String it (`unity_static.rs`, `unity-loc-tables`)

**Il fatto.** Dall'11/11/2026 String it, su un gioco Unity con tabelle di
localizzazione, prova **prima** a scrivere i testi nei file del gioco e solo
dopo XUnity. Il metodo:

1. trova la famiglia di file lingua (`chiave,testo`, uno per lingua);
2. conta, per ogni lingua, quanti suoi testi stanno negli script delle scene
   (solo MonoBehaviour, solo testi che non sono anche chiavi);
3. sceglie quale lingua **sostituire**: stesso alfabeto di quella voluta, mai
   l'inglese, la meno diffusa per prima (l'utente può imporne un'altra);
4. traduce i testi inglesi con la catena AI dell'app;
5. li scrive nelle scene al posto di quelli della lingua scelta, in tutti i
   file interni in una passata, con backup e ripristino.

Se il gioco non è fatto così il metodo lo dice (`not-applicable`) e String it
scende a XUnity. Non iniettando nulla, vale anche con un anti-cheat.

**Misura.** Lost Host Demo, sola lettura, 11/11/2026:

```bash
cd src-tauri && GS_UNITY_TARGET="nl" GS_UNITY_GAME_DIRS="E:/SteamLibrary/steamapps/common/Lost Host Demo" \
  cargo test --bin gamestringer -- commands::unity_static::real_static_probe::real_static_probe --ignored --nocapture --exact
```

| Lingua | Voci | Testi non-chiave | Ritrovati nelle scene |
|---|---|---|---|
| Coreano | 288 | 285 | 285 |
| Turco | 292 | 289 | 278 |
| Giapponese, francese, polacco | 289-292 | 284-288 | 277 |
| Portoghese, spagnolo | 289-290 | 285-286 | 276 |
| Russo | 293 | 288 | 275 |
| Lituano, tedesco | 292-295 | 285-289 | 274 |
| Arabo, italiano, cinese | 288-291 | 282-283 | 271 |
| Inglese | 292 | 268 | 252 |

Negli script delle scene ci sono 6.270 stringhe distinte.

| Lingua voluta | Risposta della sonda |
|---|---|
| Olandese (`nl`) | sostituisce il lituano (274 testi), sorgente inglese, 292 voci |
| Ucraino (`uk`) | sostituisce il russo (275 testi) |
| Italiano (`it`) | rifiuta: il gioco ha già quella lingua |
| Greco (`el`) | rifiuta: nessuna lingua del gioco ha quell'alfabeto |

Tempo della sonda in build di debug: 6 s (legge e scandisce ~340 MB di file
serializzati). In build di rilascio non è misurato.

**Il percorso intero dal pulsante (12/11/2026).** Build di sviluppo
(`npm run tauri:dev`), scheda di Lost Host Demo, lingua `NL`, profilo AI
«Gratis», pulsante String it. Sotto il pulsante il piano mostrava «Tabelle di
localizzazione (14)» al primo posto. Esito, in circa due minuti:

- tradotti 291 testi dall'inglese (TM `en → nl` vuota, quindi tutti dall'AI);
- messaggio dell'app: «In gioco scegli la lingua Lithuanian», 319 stringhe in
  2 file, 27 voci lasciate com'erano;
- `data.unity3d` riscritto (+354 KB), originale in `data.unity3d.gs_backup`;
- `real_bundle_grep`: «Instellingen» 3 volte in `level0` nel file scritto e
  zero nel backup; «Nustatymai» sparito da `level0` (resta solo nel TextAsset);
- il gioco ha caricato il bundle riscritto fino al menu, `Player.log` senza
  errori. **Il menu in olandese non è stato guardato da noi**: la finestra del
  gioco non era visibile alla prova.

Originale rimesso con `real_bundle_restore`.

Tre difetti visti durante la prova e corretti lo stesso giorno:

- la riga sotto il pulsante diceva «si traducono mentre giochi, con BepInEx +
  XUnity» anche col piano che mette prima le tabelle: ora, se il piano ha
  `unity-loc-tables`, dice che i testi si scrivono nei file del gioco;
- la scheda diceva «Italiano: assente — traducibile» benché il gioco abbia
  l'italiano fra i suoi file lingua, e con `IT` String it scendeva a XUnity.
  Il piano ora porta le lingue delle tabelle (`unity_loc_languages`): la
  scheda dice «già presente» e il pulsante si ferma con «il gioco ha già
  Italiano», senza installare nulla. Visto nell'app su Lost Host Demo;
- premuto prima che il piano fosse arrivato, il ramo Unity avrebbe saltato il
  metodo statico: ora `startAutoTranslate` aspetta il piano. Non provato a
  schermo: su Lost Host Demo la scansione dura 77 ms e la finestra non si
  riesce ad aprire a mano.

Resta da guardare: la scheda «Da tradurre» nella barra laterale prende le
lingue da un'altra fonte e per Lost Host Demo diceva «Manca italiano».

**Cosa NON è provato.**

- Che il gioco mostri bene una lingua nuova col font della lingua sostituita:
  la regola dell'alfabeto è un'ipotesi ragionevole, non una misura.
- Giochi con i file `.assets` sciolti: il metodo li rifiuta dicendolo.

**Trappole.**

1. **«Una lingua incorporata» era un'idea sbagliata, e il codice l'aveva già
   presa per vera.** La prima versione cercava LA lingua incorporata e
   pretendeva il doppio dei testi della seconda classificata: sul gioco vero
   rispondeva «nessuna», perché le lingue sono tutte lì con numeri quasi
   uguali. I test con dati finti passavano tutti. L'ha trovata solo la sonda
   sul gioco reale, prima di collegare l'interfaccia.
2. **L'inglese coincide con le chiavi.** Per questo si contano solo i testi
   che non sono chiavi: altrimenti l'inglese risulterebbe sempre incorporato
   al 100% solo perché le chiavi stanno nelle scene.
3. **`replace_node_in_place` riparte dall'originale.** Per scrivere più file
   interni serve `replace_nodes_in_place`: due chiamate separate si
   annullerebbero.

**Nel codice.** `src-tauri/src/commands/unity_static.rs` — `probe`, `apply`,
`restore`, comandi `unity_static_probe/apply/restore`; `unity_fs.rs` —
`rewrite_nodes`, `replace_nodes_in_place`; `lib/string-it/unity-static.ts` —
`runUnityStaticTranslation`; ramo Unity di `startAutoTranslate` in
`components/game-detail-client.tsx`; `translation_plan.rs` mette
`unity-loc-tables` prima di `unity-xunity`.

## Traduzione in tempo reale (IPC)

### Stato della catena — aggiornato al 21/08/2026

Questa sezione raccoglie otto voci scritte in un giorno solo, e lette in fila
raccontano anche i vicoli ciechi. Qui c'è la mappa di **dov'è arrivata la
catena**, per non doverla ricostruire leggendo tutto.

```text
tasto  →  strada statica
           ├─ incide?  → fatto
           └─ non incide (o motore non supportato)
                  ↓
              gs-hook iniettato nel processo
                  ├─ dizionario già caricato dal file convenuto
                  ├─ hook su FText::ToString (2 firme provate in ordine)
                  ├─ testo riscritto dentro la FString di UE
                  │     buffer che cresce via FMemory::Realloc se serve
                  └─ miss → pipe → coda → AI → dizionario
                              └→ hit alla sessione successiva
```

**Cosa è verificato, e su cosa.** La distinzione conta: «compila» e «gira sulla
testapp» non sono «funziona su un gioco».

| anello | dove vive | verificato su |
|---|---|---|
| iniezione DLL | `commands/gs_hook_injector.rs` + `gs-injector.exe` | Father's Day, AILA — **giochi veri** |
| dizionario pre-caricato | `preload_dictionary()` + `gs-hook/src/dllmain.cpp` | Father's Day |
| hook `FText::ToString` | `sources/source_unreal_ftext.cpp` | Father's Day (firma primaria), AILA (variante) |
| sostituzione + crescita buffer | idem | Father's Day, soak 90 s |
| pipe richiesta/risposta | `translator_pipe.rs` + `hook-dll/src/ipc.cpp` | Father's Day + testapp |
| cattura GDI | `sources/source_gdi.cpp` | **solo** `gs-hook/testapp` |
| drain loop (impara dai miss) | `lib/translation-bridge-drain.ts` | **solo** testapp |
| decisione statica→runtime | `lib/translation/runtime-fallback.ts` | **mai scattata end-to-end** |
| overlay unidirezionale | `overlay_ipc.rs` | non riverificato in questa tornata |

**Copertura delle firme UE.** Due firme, complementari: 14 giochi su 15 la
principale, ProjectAIDA la variante con `Rebuild` inlinata. **15 su 15** dei
binari Shipping installati su questa macchina — che non è l'universo UE. Quando
una build nuova non aggancia, il log dice **con quale firma** ci ha provato, e
il metodo per ricavarne una sta nelle voci qui sotto.

**Cosa NON è ancora vero**, per non lasciarlo dedurre a chi legge:

- Il percorso completo **dal bottone** non è mai stato visto scattare: serve un
  gioco installato che fallisca la strada statica, e in questa libreria non ce
  n'è (nessun RPG Maker classico; 15 UE su 16 hanno i `.locres`).
- Il file di dizionario è **uno solo per coppia di lingue**: due giochi diversi
  si sovrascrivono a vicenda all'uscita. Innocuo finché le traduzioni sono
  testo→testo.
- La cattura GDI **si attiva ma non cattura nulla** su RPG_RT: il gioco è stato
  portato fino a un testo a schermo e il log è rimasto vuoto. Il motivo è
  misurato — il hook aggancia le funzioni Unicode e RPG_RT importa solo le ANSI
  — e vale per tutto RPG Maker 2000/2003. I giochi UE non la esercitano affatto,
  perché disegnano via Slate/Direct3D. Vedi le voci dedicate.


### La Named Pipe costa ~19us a stringa, e non è sul percorso caldo

Il round trip su Named Pipe è ~20x più lento della shared memory, e non
importa: la DLL chiama l'IPC solo quando **non** ha già la stringa in cache,
cioè la prima volta che la vede. In regime la traduzione in-game non fa IPC.

**Come è stato misurato.** Stesso carico sui due trasporti — lookup in
dizionario di 16 stringhe di gioco realistiche (da `New Game` a una riga di
dialogo da 120 caratteri), una richiesta alla volta, 3000 iterazioni dopo 300 di
warmup, latenza end-to-end lato chiamante:

```text
cargo test --release --lib ipc_bench -- --nocapture --test-threads=1
```

| trasporto | p50 | p95 | p99 | max |
|---|---|---|---|---|
| Named Pipe | 9.2us | 18.9us | 30.4us | 68.2us |
| shared memory | 0.4us | 0.5us | 0.8us | 22.2us |

Due esecuzioni indipendenti sono rientrate entro il 5% su ogni percentile.

Spendendo il 10% di un frame a 60fps (1667us): ~88 stringhe/frame sulla pipe,
~3333 sulla shared memory. In debug il divario è ancora più netto (37us contro
1.0us di p50) perché la shmem beneficia dell'ottimizzazione, la pipe è
dominata dalle syscall.

**Perché non conta.** `GSTranslator::Translate()` in
`unreal-translator/hook-dll/src/translator.cpp:46` cerca prima nella cache locale
del processo, e solo su miss chiama `IPC::SendTranslateRequest`. La cache è
persistita su disco tra le sessioni (`LoadCache`/`SaveCache`), e `source_gdi.cpp`
fa dedup per riga. Quindi 88 stringhe/frame non è il budget di rendering: è il
budget di stringhe **mai viste prima**, che dopo i primi secondi di gioco tende a
zero.

**La trappola.** Sembra una scelta di architettura da fare col cronometro — pipe
o shared memory. Non lo è: con una cache davanti, il trasporto è irrilevante
per la frequenza di frame, e vince quello che è finito, non quello che è
veloce. Vedi lo stato dei due sotto.

**Stato reale dei trasporti** (misurato il 21 agosto 2026):

| pipe / regione | lato Rust | lato client |
|---|---|---|
| pipe `GameStringerOverlay` | reale, `src-tauri/src/overlay_ipc.rs` | reale, `gs-hook/src/gs_overlay_ipc.cpp` — **sola scrittura**, fire-and-forget |
| pipe `GameStringerTranslator` | reale, `src-tauri/src/translator_pipe.rs` | compilato in gs-hook (`hook-dll/src/ipc.cpp`) ma **mai acceso**: solo il dllmain di unreal-translator chiama `IPC::Initialize()`, quello di gs-hook no |
| pipe `GameStringerUETranslator` | **stub**: `start_windows_pipe_server` dorme in un loop (`ue_translator/ipc_bridge.rs:130`) | reale, `unity-translator-dll/src/ipc_client.h` |
| shmem `GameStringer_TranslationBridge_v1` | reale, `translation_bridge/shared_memory_ipc.rs` | **TODO**: `QueryBackend` ritorna `null` (`plugins/GameStringer.Satellite/Plugin.cs`) |

Nessun percorso richiesta/risposta è completo su entrambi i lati. L'unica cosa
che funziona end-to-end è l'overlay, che è unidirezionale e non ha bisogno di
round trip.

**I due nomi di pipe non sono un disallineamento**, per quanto si somiglino: sono
due canali distinti, ciascuno col suo client. Verificato leggendo le stringhe
UTF-16 dentro le DLL precompilate che il repo spedisce:

| DLL | nome incorporato | iniettata da |
|---|---|---|
| `resources/gs-hook/{x64,x86}/gs-hook.dll` | `GameStringerOverlay` + `GameStringerTranslator` | `gs_hook_injector.rs` |
| `resources/unity-translator/unity_auto_translator.dll` | `GameStringerUETranslator` | `unity_injector.rs` |

```bash
python -c "import io;b=io.open('src-tauri/resources/gs-hook/x64/gs-hook.dll','rb').read();print([n for n in ['GameStringerTranslator','GameStringerUETranslator'] if n.encode('utf-16-le') in b])"
```

Quindi `unity_injector.rs` e la DLL Unity si accordano correttamente su
`GameStringerUETranslator`. **Rinominare l'una nell'altra scollegherebbe la DLL
Unity**, che è un binario precompilato nel repo: il nome va cambiato nell'header
C++ e la DLL ricompilata, non solo in Rust.

Il server Rust per `GameStringerTranslator` esiste da agosto 2026
(`src-tauri/src/translator_pipe.rs`): message mode, header di 12 byte
`{type, requestId, dataLength}` + payload UTF-16LE, hit → risposta immediata dal
dizionario del Translation Bridge, miss → nessuna risposta (la DLL ha il suo
timeout) e il testo entra nella coda drenata da `translation_bridge_drain_misses`.
Un solo dizionario per shared memory e pipe. Il wire format è dettato dal
binario C++ già spedito e verificato con un finto client nei test
(`cargo test --lib translator_pipe`). Il lato C++ è stato acceso lo stesso
giorno: `gs-hook/src/dllmain.cpp` ora chiama `IPC::Initialize()` +
`StartReceiveThread()`, e il percorso di miss in `Translate()` è
fire-and-forget (la risposta rientra in cache dal receive thread via
`SetTranslationArrivedCallback`), perché prima bloccava fino a 2s sul thread
che disegna.

### Una pipe letta e scritta insieme richiede `FILE_FLAG_OVERLAPPED`

Accendere l'IPC in gs-hook freezava il gioco al primo miss. Non era il
timeout di 2s: era che `ipc.cpp` apriva la pipe **senza**
`FILE_FLAG_OVERLAPPED`. Su un handle sincrono il kernel serializza le
operazioni sullo stesso file object, quindi col receive thread fermo dentro
`ReadFile` la `WriteFile` del render thread si accodava dietro la lettura —
e quella lettura poteva completarsi solo quando fosse arrivata la richiesta
che stava bloccando. Attesa circolare.

**Come è stato misurato.** Iniezione reale nella testapp GDI
(`gs-hook/testapp`), sonda `SendMessageTimeout(WM_NULL, 2000ms)` sulla
finestra per distinguere "lento" da "bloccato", e log su entrambi i lati:

| | UI responsiva | log DLL | lato server |
|---|---|---|---|
| handle sincrono | **False** | 3 righe (solo attivazione) | connessione, **0 richieste** |
| handle overlapped | True | cattura intatta | 3 hit tradotti + 2 miss in coda |

La cura: handle overlapped e un **thread di invio dedicato** con coda: il
thread di rendering tocca solo un mutex e una condvar, mai l'I/O. Lo
spegnimento va in ordine `StopReceiveThread()` (cancella le overlapped in
corso e fa join) **poi** `Shutdown()` (chiude l'handle): chiudere l'handle
mentre un thread attende su un `OVERLAPPED` è use-after-free.

**La trappola.** Il freeze sembrava ovviamente colpa del timeout di 2s nel
percorso di miss, ed era la pista sbagliata: quel timeout non scattava
nemmeno, perché la richiesta non partiva. Il metodo che ha risolto è stato
bisecare per esperimento invece che per lettura — DLL di giugno (cattura
OK), HEAD ricompilato (cattura OK), mie modifiche con server **spento**
(cattura OK), mie modifiche con server **acceso** (freeze). L'ultimo passo
isola il colpevole al ramo "IPC connessa" in tre minuti.

**La trappola.** Due nomi che differiscono di due lettere sembrano un refuso da
sistemare. Prima di allinearli, leggi cosa c'è dentro i binari: qui erano due
canali sani, e l'unico difetto vero era il server che manca a entrambi.

### Un dedup senza scadenza impedisce alla catena di accorgersi di aver imparato

Il drain loop imparava le stringhe e il gioco continuava a mostrarle in inglese.
Non era il loop: era il **dedup lato DLL**. `Translate()` tiene un insieme di
richieste in volo per non rispedire la stessa stringa a ogni draw call, e quel
set veniva svuotato solo dal callback di risposta. Ma sul miss il server tace di
proposito — la traduzione ancora non esiste — quindi la voce non usciva mai:
la stringa restava "in attesa" per sempre e la DLL non la richiedeva **mai più**,
nemmeno dopo che il drain loop l'aveva imparata.

La cura è un TTL (`kPendingTtlMs`, 10s in
`unreal-translator/hook-dll/src/translator.cpp`): sopra il giro del drain loop
lato app (~3s), sotto la pazienza umana. Scaduto, la stringa si può richiedere.

**Come è stato misurato.** Server di prova con un "provider" che prefissa `[IT]`
(`cargo run --example translator_pipe_server`), iniezione reale nella testapp
GDI, e si guarda la stessa stringa attraversare i tre stati:

```text
[DEBUG] translator IPC miss: "The dragon roars from the mountain."
IMPARATA → "The dragon roars from the mountain." = "[IT] The dragon roars..."
[DEBUG] translator IPC hit:  "The dragon roars from the mountain." -> "[IT] The dragon roars..."
```

Senza TTL la terza riga non compare mai, ed è l'unica che dimostra qualcosa.

**La trappola.** Un dedup e una cache si somigliano, ma la cache ha una chiave
che prima o poi viene riempita, il dedup no: se la condizione che lo svuota può
non verificarsi mai, serve una scadenza. Qui la condizione era "il server
risponde", e sul miss il server tace per progetto.

### ~~Su Unreal la catena runtime si ferma al pattern di `FText::ToString`~~ (SUPERATA)

> **Superata il 21/08/2026, stesso giorno.** Il pattern non era solo ambiguo:
> era **sbagliato** (vedi «unicità non è correttezza»), ed è stato sostituito da
> due firme ricavate da binari con i simboli. Su Unreal la catena oggi aggancia.
> La voce resta perché il *metodo* con cui il blocco è stato diagnosticato vale
> ancora, e perché la trappola in fondo — «connesso via IPC» sembra successo ed
> è metà catena — non è invecchiata di un giorno.

**Il fatto (allora).** Il trasporto funziona su un gioco vero — la DLL si connette al
server Rust e il gioco non ne risente — ma **non arriva testo**, perché la
sorgente L1 per Unreal si rifiuta di agganciare `FText::ToString` quando il
pattern di byte è ambiguo. Le sorgenti L2 (GDI) restano attive ma non vedono
nulla: UE disegna il testo via Slate/Direct3D, non con `ExtTextOutW`. L'anello
mancante non è l'IPC, è la risoluzione del simbolo.

**Misura.** Father's Day (UE, Steam), 21 agosto 2026, iniezione reale nel
processo `Fathers_Day-Win64-Shipping.exe` con il server di prova in ascolto:

```text
cargo run --example translator_pipe_server
gs-hook\build-x64\bin\Release\gs-injector.exe <pid> <path a gs-hook.dll>
```

Lato DLL (`%TEMP%\gs-hook.log`), quattro righe in tutto:

```text
[gs-hook] connesso a GameStringer via IPC
[gs-hook/UE] pattern FText::ToString ambiguo: 4 match, hook RIFIUTATO
             (aggancerebbe la funzione sbagliata)
[gs-hook] sorgente attiva: GDI (ExtTextOutW/DrawTextW) (livello 2)
[gs-hook] sorgente attiva: GDI/GetGlyphOutline (estrazione) (livello 2)
```

Lato server: `DLL connessa`, e **zero richieste**. Il gioco resta sano —
`SendMessageTimeout(WM_NULL, 3000ms)` risponde, 103 s di CPU, 608 MB — il che
conferma su un titolo vero la correzione dell'I/O overlapped (vedi la voce
sopra): quel bug congelava il processo all'istante.

**Nel codice.** `gs-hook/src/sources/source_unreal_ftext.cpp` (livello Engine,
il rifiuto è deliberato), `gs-hook/src/sources/source_gdi.cpp` (livello
Rasterization, il ripiego universale).

**La trappola.** «connesso a GameStringer via IPC» nel log sembra il segnale
che tutto funziona, ed è solo metà della catena: dice che il *trasporto* è
vivo, non che qualcuno gli stia parlando. Il numero che conta è quante
richieste arrivano al server — se è zero, il problema sta a monte dell'IPC, e
guardare la pipe non lo troverà mai.

**La risoluzione per simbolo non salva i build monolitici (21/08/2026).**
Un simbolo esportato sarebbe deterministico — o c'è ed è quello giusto, o non
c'è — ma richiede l'engine in DLL. Father's Day è un Shipping monolitico:

| | |
|---|---|
| export nell'exe | 312, **tutti** hint per driver (`NvOptimusEnablement`, `ags*`) |
| simboli UE | nessuno |
| PDB | dichiarato nell'header (`Fathers_Day-Win64-Shipping.pdb`), non spedito |
| DLL accanto all'exe | solo `turbojpeg.dll` |
| moduli interrogati a runtime | **142**, zero hit |

`ResolveFTextToStringBySymbol()` in `source_unreal_ftext.cpp` prova comunque
per primo (`?ToString@FText@@QEBAAEBVFString@@XZ`, cercato in tutti i moduli via
Toolhelp) e cade sul pattern quando non trova. Serve ai build non monolitici e
all'editor; sui giochi commerciali no. Il numero di moduli finisce nel log
apposta: senza, uno zero non distingue «guardato ovunque, non c'è» da «lo
snapshot è fallito e non ho guardato niente». Il controllo che lo conferma è
confrontarlo con `(Get-Process ...).Modules.Count` — qui 142 contro 142.

**I quattro candidati, misurati.** Non sono un pattern che sfarfalla: sono
quattro funzioni diverse con lo stesso prologo, che divergono al **byte 13**,
cioè dentro i 17 che la firma copre.

| # | RVA | dopo il prologo |
|---|---|---|
| 1 | `0x1CADD20` | `call [rax+0x28]`, ritorna `rax+0x68` |
| 2 | `0x1D04720` | `call [rax+0x48]`, ritorna `[rbx+0x60]` (int32) |
| 3 | `0x1D047B0` | identica a #2 ma `[rbx+0x64]` — accessori gemelli |
| 4 | `0x3074940` | `mov rcx,[rax+0x90]`, chiama via `r8` |

Allungare la firma per isolarne una significa ritararla sui quattro giochi dove
oggi è già unica, senza avere una verità di riferimento con cui dire *quale*
sia quella giusta: qui non ci sono simboli da confrontare. La strada promettente
non è una firma più lunga, è un **ancoraggio a un riferimento di stringa**
(trovare un dato noto in `.rdata` e risalire al codice che lo usa), che non
dipende da come il compilatore ha disposto i byte del prologo.

**Corollario sul fallback a runtime.** Agganciare il fallback al vicolo cieco
«Unreal senza `.locres`» (PR #87) è giusto in linea di principio, ma finché
il pattern di `FText::ToString` resta ambiguo **su UE il runtime non ha testo
da tradurre**: proporrebbe una strada che non porta ancora da nessuna parte.
Per RPG_RT e i giochi GDI la sorgente funziona ed è stata vista funzionare;
per UE no. Prima di considerare chiusa quella strada, va reso non ambiguo il
pattern (o sostituito con una risoluzione per simbolo).

### Il pattern UE5 di `FText::ToString` era sbagliato: unicità non è correttezza

**Il fatto.** La firma usata per agganciare `FText::ToString` sui giochi Unreal
non descriveva quella funzione. Dove faceva «1 match unico» — e quindi dove il
codice si fidava e installava l'hook — avrebbe agganciato **una funzione
qualsiasi**. Il caso «ambiguo» di Father's Day, che veniva rifiutato, era il
meno pericoloso dei due.

**Come è stato smascherato.** Serviva una verità di riferimento, e c'era senza
saperlo: un'installazione **UE 5.8** in `C:\Program Files\Epic Games`, con 566
DLL dell'engine. Lì i simboli esistono, quindi si può chiedere *quale* funzione
sia quella giusta invece di indovinarlo:

```bash
# in UnrealEditor-Core.dll: 7632 export, fra cui
#   ?ToString@FText@@QEBAAEBVFString@@XZ  →  RVA 0x3EFA60
```

I byte a quell'indirizzo:

```text
40 53              push rbx
48 83 EC 30        sub  rsp, 0x30
48 8B D9           mov  rbx, rcx
E8 F2 EE FE FF     call <rebuild>        ← una CALL
48 8B 0B           mov  rcx, [rbx]       ← carica TextData
48 85 C9           test rcx, rcx
```

Il pattern in uso era
`40 53 48 83 EC ?? 48 8B D9 48 85 C9 74 ?? 48 8B 01`, cioè si aspettava
`test rcx,rcx` **subito** dopo `mov rbx,rcx`, poi `mov rax,[rcx]` seguito da una
chiamata attraverso `rax`: una **dispatch virtuale su `this`**. `FText` non è
polimorfico — non ha vtable — quindi quella forma non può essere il suo
`ToString` in nessuna versione UE5. La conferma numerica chiude il discorso:
il pattern compare **0 volte** in tutta `UnrealEditor-Core.dll`, che quella
funzione la contiene di sicuro.

**Numeri sui 18 Shipping installati.** Il vecchio pattern fa 1-4 match ovunque
(1 su The Skin Stapler, Greed Stays Home, Beyond Hanwell, Cooking Simulator VR,
Oneirophobia; 4 su Father's Day, Maestro, Subside). Una firma ricavata *dal
simbolo* di UE 5.8 fa 6 match sulla DLL stessa e **0** su tutti i 18 giochi:
il prologo cambia fra versioni UE, quindi una firma va ricavata **e** validata
sulla versione di quel gioco, non trasportata.

**Nel codice.** La costante è ora
`UE::Patterns::FText_ToString_UE5_CONFUTATO` (rinominata apposta: chi prova a
usarla non compila e legge il perché), e `source_unreal_ftext.cpp` non fa più
pattern-scan — resta la sola risoluzione per simbolo, che serve ai build non
monolitici. Sui giochi commerciali la sorgente ora fallisce con un messaggio
esplicito e si scende a GDI.

**La trappola.** «Un solo match» sembra la prova che il pattern è quello giusto,
e non lo è: misura l'**ambiguità**, non la **correttezza**. Le due cose si
separano solo con una verità di riferimento, e una verità di riferimento serve
averla — un binario con i simboli della stessa famiglia. Senza, si può
verificare che una firma non peschi troppo, mai che peschi la cosa giusta.
Questo pattern era nel repo dal commit iniziale con la nota «(esempio)», ed è
sopravvissuto a una revisione che ne misurò l'unicità sui giochi reali senza
poterne misurare la correttezza.

**Il metodo, per la prossima volta.** Installare l'engine UE della versione del
gioco, risolvere il simbolo nella sua `UnrealEditor-Core.dll`, leggere i byte
lì, ricavare la firma da quelli, e solo allora contarla sul gioco. Lo strumento
per contare esiste già: `scripts/ue-validate-ftext-pattern.js --exe <path> --dump`.

### La firma giusta di `FText::ToString` si ricava da un binario Shipping col PDB

**Il fatto.** UE spedisce, dentro l'installazione dell'engine,
`Engine/Binaries/Win64/UnrealGame-Win64-Shipping.exe` **con il suo PDB**
(150 MB). È Shipping e monolitico come i giochi commerciali, quindi il codice
generato è della stessa famiglia — a differenza di `UnrealEditor-Core.dll`, che
è Development. È lì che si va a leggere com'è fatta davvero la funzione.

**Come.** DbgHelp (`SymLoadModuleEx` + `SymEnumSymbols` con maschera
`FText::ToString`) la risolve a **RVA 0x1302480** su UE 5.8. I byte:

```text
40 53              push rbx
48 83 EC 20        sub  rsp, 0x20
48 8B D9           mov  rbx, rcx
E8 A2 D0 00 00     call <rebuild>            ← rel32, wildcard
48 8B 0B           mov  rcx, [rbx]           ← TextData
48 8B 01           mov  rax, [rcx]           ← vtable
48 83 C4 20        add  rsp, 0x20
5B                 pop  rbx
48 FF 60 28        jmp  [rax+0x28]           ← tail-call GetDisplayString
```

Ventinove byte, e la **tail-call finale** è ciò che li rende specifici. Firma:

```text
40 53 48 83 EC ?? 48 8B D9 E8 ?? ?? ?? ?? 48 8B 0B 48 8B 01 48 83 C4 ?? 5B 48 FF 60 ??
```

Wildcard sull'immediato di `sub`/`add`, sul `rel32` della `call` e sullo slot
della vtable — che cambia per gioco: 0x28 sul riferimento, 0x10 su Father's Day,
0x20 su The Skin Stapler.

**Misura.** 1 match esatto su **14 giochi su 15** (UE 5.5, 5.6, 5.8), unica e
all'indirizzo giusto anche sul riferimento. Verificata all'inizio di funzione
(preceduta da padding `CC`) su The Skin Stapler (UE 5.6, RVA 0x1269100) e
Father's Day (RVA 0xDD3FC0). Il conteggio che convince più di tutti lo dà
`scripts/ue-validate-ftext-pattern.js`: **397 chiamanti** su The Skin Stapler,
contro gli 1-4 dei candidati della vecchia firma, che lo script stesso bollava
«pochi per FText::ToString».

**Prova sul campo (Father's Day, 21/08/2026).** Iniezione reale con il server di
prova in ascolto:

```text
[gs-hook/UE] hook FText::ToString installato (pattern)
[gs-hook] sorgente attiva: Unreal/FText (livello 1)
```

e lato server il testo vero del menu del gioco:
`LANGUAGE SELECTION`, `English`, `Russian`, `Exit game`, `Yes`, `True`, `False`.
Gioco responsivo, 119 s di CPU, nessun crash.

**La trappola.** Non era la versione UE la variabile che contava, era la
**configurazione di build**. Una firma ricavata dalla `UnrealEditor-Core.dll`
(Development) fa 0 match su tutti i 18 Shipping installati; quella ricavata dal
binario Shipping ne fa 1 quasi ovunque, attraversando tre versioni UE. Cercare
«la stessa versione dell'engine» era la pista sbagliata: serviva la stessa
*configurazione*.

**Un controllo che ha smascherato un errore mio.** Due script indipendenti
davano risultati opposti sullo stesso file — 1 match contro 0. Avevo scompattato
l'header di sezione PE nell'ordine sbagliato (`SizeOfRawData` e
`PointerToRawData` sono in quell'ordine, non l'inverso) e leggevo dall'offset
sbagliato: sembrava «la firma non c'è», era lo script rotto. Quando due misure
della stessa cosa non concordano, prima di scegliere quale credere si cerca il
bug in entrambe.

**Un altro controllo, sul gioco.** The Skin Stapler moriva all'iniezione e stavo
per attribuirlo all'hook. Avviato **senza** iniettare, esce da solo lo stesso:
vuole Steam. Prima di dare la colpa al proprio codice, si prova il caso base.

### La traduzione rientra nel gioco: sostituzione in-place e crescita del buffer

**Il fatto.** `FText::ToString` restituisce un riferimento alla `FString` interna
di UE: sovrascriverla traduce il testo davvero, a schermo. Se la traduzione non
entra in `ArrayMax` si fa crescere il buffer con **`FMemory::Realloc`** — non con
`malloc` o `new`, perché a liberare quel puntatore sarà UE col proprio
allocatore, e un allocatore diverso corrompe l'heap alla prima free.

**Il margine di UE non è affidabile.** Misurato su Father's Day:

| stringa | ArrayNum | ArrayMax | margine |
|---|---|---|---|
| `English` | 8 | 8 | **nessuno** |
| `Russian` | 8 | 8 | **nessuno** |
| `Exit game` | 10 | 16 | 6 slot |

Due casi su tre hanno `ArrayMax == ArrayNum`. Contare sullo slack di UE non
funziona: l'italiano è mediamente più lungo dell'inglese, e senza `Realloc` una
buona parte delle traduzioni verrebbe scartata in silenzio.

**La firma di `FMemory::Realloc`.** Ricavata col metodo della voce precedente —
`UnrealGame-Win64-Shipping.exe` di UE 5.8, simbolo a RVA 0x12D29F0:

```text
48 89 5C 24 08 48 89 74 24 10 57 48 83 EC 20 48 8B F1 41 8B D8 48 8B 0D ?? ?? ?? ?? 48 8B FA 48 85 C9 75 ??
```

Il prologo iniziale da solo sarebbe generico — è quello che rese inutilizzabile
la firma UE4.27 — ma `mov rsi,rcx / mov ebx,r8d / mov rcx,[rip+GMalloc]`
discrimina. **1 match esatto su tutti e 15** gli Shipping installati, unica e
all'indirizzo giusto sul riferimento, verificata a inizio funzione su The Skin
Stapler (0x123A3A0) e Father's Day (0xD94DD0).

**Prova sul campo.** Cache pre-seedata con traduzioni deliberatamente più lunghe
del buffer, iniezione reale in Father's Day:

```text
SUBST(grow): English   -> Inglese (lingua lunga)             [len=22 ArrayNum=8  ArrayMax=8]
SUBST:       Russian   -> Russo                              [len=5  ArrayNum=8  ArrayMax=8]
SUBST(grow): Exit game -> Esci dal gioco e torna al desktop   [len=33 ArrayNum=10 ArrayMax=16]
```

22 caratteri in un buffer da 8 e 33 in uno da 16: entrambi cresciuti. Soak di
90 s campionato ogni 15: UI sempre responsiva, RAM stabile a ~350 MB, handle
fermi a ~1535. Nessun segno di heap corrotto.

**La trappola, e perché il primo tentativo sembrava un crash.** Con la cache
pre-seedata il gioco moriva e non compariva nessuna riga `SUBST`: sembrava che
la sostituzione lo uccidesse. Erano due cose diverse, entrambe da verificare
prima di concludere. (1) Il gioco esce da solo anche **senza** iniezione, a
volte: il caso base va sempre provato. (2) La cache non veniva letta affatto —
il messaggio «cache pre-seedata» lo stampa il dllmain perché la env var è
impostata, **non** perché il caricamento sia riuscito. Il magic del formato GSTC
va scritto come u32 little-endian `0x47535443`, che su disco dà i byte `CTSG`;
scrivendo `GSTC` il file viene rifiutato in silenzio. L'indizio era nel dump di
`gs-hook/testapp/test-cache.gstc`, che comincia proprio con `CTSG`.

**Il vero limite rimasto è un altro.** Su UE la stessa stringa raramente passa
due volte da `ToString`: la display string resta in cache dentro l'`FTextData`.
Il percorso fire-and-forget — che chiede la traduzione al primo avvistamento e
la usa dal secondo — quindi **non scatta**. Perché la traduzione compaia serve
che sia già nella cache locale della DLL quando il testo viene convertito: cioè
il dizionario va pre-caricato (`GS_HOOK_CACHE`, o la cache persistita da una
sessione precedente). È il motivo per cui in queste prove è stata usata una
cache seminata, e va risolto prima di poter promettere traduzione "al primo
avvio".

### Su Unreal il dizionario va consegnato PRIMA dell'iniezione, non durante

**Il fatto.** Su UE la stessa stringa passa da `FText::ToString` **una volta
sola**: la display string resta in cache dentro l'`FTextData`. Il percorso
fire-and-forget della DLL — chiedi la traduzione al primo avvistamento, usala
dal secondo — quindi non scatta mai, e il testo resta in lingua originale per
quanto bene funzionino pipe, dizionario e sostituzione. La traduzione deve
essere già nella cache locale **quando il testo viene convertito**.

**La cura.** GameStringer scrive la coppia di lingue attiva in
`%APPDATA%\GameStringer\gs-hook-cache.gstc` prima di lanciare l'injector
(`preload_dictionary()` in `commands/gs_hook_injector.rs`), e la DLL cerca quel
percorso all'avvio quando `GS_HOOK_CACHE` non è impostata
(`gs-hook/src/dllmain.cpp`).

**Perché un percorso convenuto e non una env var.** Una variabile d'ambiente
non si può impostare in un processo **già avviato**, e l'iniezione avviene per
definizione su un gioco in esecuzione. `GS_HOOK_CACHE` resta come override
esplicito per i test senza backend.

**Prova sul campo (Father's Day, 21/08/2026).** Senza `GS_HOOK_CACHE`, con il
solo file nel percorso convenuto:

```text
[gs-hook] dizionario pre-caricato: 7 voci da …\GameStringer\gs-hook-cache.gstc
[gs-hook/UE] hook FText::ToString installato (pattern)
[gs-hook/UE] SUBST:       LANGUAGE SELECTION -> SELEZIONE LINGUA  [len=16 ArrayNum=19 ArrayMax=24]
[gs-hook/UE] SUBST:       English            -> Inglese
[gs-hook/UE] SUBST:       Russian            -> Russo
[gs-hook/UE] SUBST(grow): Exit game          -> Esci dal gioco e torna al desktop
```

Quattro sostituzioni al **primo** avvistamento, una delle quali ha fatto
crescere il buffer. È la catena completa: dizionario → file → DLL → schermo.

**Il formato ha una trappola già costata tempo.** Il magic GSTC va scritto come
u32 little-endian `0x47535443`, che sul disco dà i byte **`CTSG`**. Scriverlo
come `GSTC` fa rifiutare il file **in silenzio** da `cache.cpp`: nessun errore,
cache vuota, gioco in inglese e niente che lo segnali. `export_gstc()` ha un
test che asserisce proprio i byte `CTSG` sul disco. E `len` conta **unità
UTF-16**, non caratteri Unicode: il C++ legge `len * sizeof(wchar_t)` byte.

**Il log ora dice il numero, non solo il percorso.** Prima stampava «cache
pre-seedata» per il solo fatto che un percorso fosse impostato — anche con file
assente o malformato. Diceva che era andata bene mentre la cache era vuota, ed è
esattamente come quella trappola è riuscita a nascondersi. Ora stampa quante
voci ha davvero caricato.

**Da sapere.** All'uscita del gioco `ShutdownTranslator()` **riscrive** quel
file con la cache locale (pre-caricato + imparato durante la partita). È
persistenza gratuita fra sessioni, ma il file è uno solo per coppia di lingue:
due giochi diversi si sovrascrivono a vicenda. Innocuo finché le traduzioni sono
testo→testo, da rivedere se serviranno dizionari per-gioco.

### Quando manca la verità di riferimento, il conteggio dei chiamanti la sostituisce

**Il fatto.** `FText::ToString` esiste anche nei build dove la firma validata fa
0 match: cambia il **codegen**, non la funzione. Su ProjectAIDA (il gioco AILA)
il compilatore ha **inlinato `Rebuild`** come chiamata virtuale invece di
emettere un `call rel32`, e il prologo non combacia più.

**Il problema del metodo.** Qui non c'è un binario con simboli da cui leggere i
byte: ProjectAIDA si dichiara `UE5-CL-0`, build custom, e nessuna installazione
UE corrisponde. Ricavare una firma «perché la forma sembra giusta» è esattamente
l'errore che ha prodotto la firma confutata.

**Cosa la sostituisce: i chiamanti.** Il nucleo semantico non cambia mai —
carica TextData da `[this]`, carica la vtable, **tail-call** a
`GetDisplayString`. Cercando quel nucleo (`48 8B 0B 48 8B 01`) seguito
dall'epilogo con tail-jmp (`48 83 C4 ?? 5B 48 FF 60 ??`) restano quattro
candidati; a separarli è quanto vengono chiamati:

| RVA | lunghezza | chiamanti diretti |
|---|---|---|
| **0x12847F0** | 41 byte | **429** |
| 0x12848F0 | 65 byte | 1 |
| 0x1284A80 | 65 byte | 1 |
| 0x36095A0 | 73 byte | 1 |

429 contro 1. E il numero è coerente con i ~397 della `ToString` **validata sui
simboli** su The Skin Stapler: una funzione chiamata centinaia di volte che
carica TextData e fa tail-call a uno slot di vtable non può essere altro.
Il solo nucleo, senza la coda, compare **602 volte**: non discrimina niente.

**La firma.** Identica alla principale salvo il prologo:

```text
40 53 48 83 EC ?? 48 8B D9 48 8B 09 48 8B 01 FF 50 ?? 48 8B C8 E8 ?? ?? ?? ?? 48 8B 0B 48 8B 01 48 83 C4 ?? 5B 48 FF 60 ??
```

`mov rcx,[rcx]` invece di `call <rebuild>`, poi la chiamata virtuale che è la
`Rebuild` espansa. **1 match su ProjectAIDA e 0 sugli altri 14**: è
complementare alla firma principale, che fa 0 proprio lì. Insieme coprono
**15 giochi su 15**.

**Nel codice.** `source_unreal_ftext.cpp` ora prova le firme **in ordine** e si
ferma alla prima univoca; un'ambiguità su una non ferma la ricerca, perché
sull'altra quel binario può essere univoco. Il log dice **con quale firma** ha
agganciato — serve a sapere, quando un gioco nuovo non funziona, se il problema
è una firma da estendere o una da aggiungere.

**Prova sul campo (AILA, 21/08/2026).** Iniezione reale:

```text
[gs-hook/UE] FText::ToString trovato con la firma "UE5 rebuild inline"
[gs-hook/UE] hook FText::ToString installato
[gs-hook/UE] FMemory::Realloc risolto
[gs-hook] sorgente attiva: Unreal/FText (livello 1)
```

Gioco vivo, nessuna regressione su The Skin Stapler e Father's Day, che
continuano ad agganciare con la firma principale.

**Una correzione allo strumento.** `ue-validate-ftext-pattern.js` giudicava
l'effetto a runtime guardando **una sola** firma, e su ProjectAIDA stampava
«fallback GDI» mentre la DLL aggancia. Affermava un esito che non aveva
misurato — lo stesso difetto che quello script esiste per smascherare. Ora
considera tutte le firme provate, nell'ordine in cui la DLL le prova, e dice
quale ha agganciato.

### Windows Defender mette in quarantena l'injector a 32 bit

**Il fatto.** `gs-injector.exe` **x86** viene rilevato da Microsoft Defender come
`Program:Win32/Contebrew.A!ml` e messo in quarantena. La versione **x64 non è mai
stata segnalata**. L'injector a 32 bit serve solo a iniettare in giochi a 32 bit,
cioè RPG Maker classico, RPG_RT e le vecchie VN: esattamente il caso di punta
della traduzione a runtime.

**Misura (21/08/2026, macchina con Defender di serie, protezione realtime
attiva).** Tre rilevamenti, tutti x86, nessuno x64:

```text
20:50:38  x86  Program:Win32/Contebrew.A!ml  …\GameStringer\resources\gs-hook\x86\gs-injector.exe
21:29:34  x86  Program:Win32/Contebrew.A!ml  …\gs-hook\build-x86\bin\Release\gs-injector.exe
21:31:57  x86  Program:Win32/Contebrew.A!ml  (copia in %TEMP%)
```

Rilevabile con `Get-MpThreatDetection`. Al terzo tentativo il blocco è esplicito:
«Impossibile eseguire il programma: il file contiene un virus o software
potenzialmente indesiderato».

**Il modo in cui fallisce è la parte peggiore.** La **prima** iniezione riesce —
alle 20:50:38 il test end-to-end su Yume Nikki ha funzionato davvero: log
scritto, sorgenti GDI attive, overlay aperto — e Defender rimuove il file
**subito dopo**. La seconda volta l'utente trova il componente sparito, senza
niente che colleghi le due cose. Nel mezzo, `Test-Path` sull'injector risponde
`True` e un istante dopo l'esecuzione dice «non riconosciuto come programma
eseguibile»: due misure contraddittorie sullo stesso file a secondi di distanza,
ed è la quarantena che agisce fra l'una e l'altra.

**Perché succede.** L'injector fa `OpenProcess` + `VirtualAllocEx` +
`WriteProcessMemory` + `CreateRemoteThread`: è la firma comportamentale del
malware da manuale, in un eseguibile non firmato di 11 KB. `!ml` indica
un'euristica di machine learning, e la categoria `Program:` significa
«indesiderato», non malware conclamato — ma l'effetto pratico è identico.

**Nel codice.** `gs-hook/injector/` (sorgente), `src-tauri/resources/gs-hook/x86/`
(spedito), usato da `commands/gs_hook_injector.rs`. L'helper esterno esiste
perché il backend Tauri è x64 e non può iniettare in un processo a 32 bit da
solo (vedi l'intestazione di quel file).

**Le strade, in ordine di quanto risolvono.**

1. **Firmare `gs-injector.exe`** con un certificato di code signing: risolve per
   tutti gli utenti, non solo per chi sa aggiungere un'esclusione.
2. **Ridurre la firma comportamentale**: meno API di injection in sequenza
   ravvicinata, nessuna stringa sospetta, metadati di versione presenti. Abbassa
   il punteggio euristico senza cambiare cosa fa il programma.
3. **Esclusione in Defender**: sblocca subito, ma è una scelta di sicurezza che
   deve fare l'utente consapevolmente — non un ripiego da suggerire in un
   messaggio d'errore.

**Cosa è stato fatto, e cosa ha risolto davvero (21/08/2026).**

La strada 2 — la meno promettente sulla carta — **è bastata**. Aggiungendo
`gs-hook/injector/injector.rc` (CompanyName, FileDescription, ProductName,
OriginalFilename, versione, e un Comments che dice a cosa serve il programma) e
ricompilando, la stessa macchina con lo stesso Defender **non mette più in
quarantena l'injector x86**:

```text
Start-MpScan -ScanType CustomScan -ScanPath ...\x86\gs-injector.exe
  file ancora presente: True
  esecuzione: «uso: gs-injector.exe <pid> <percorso-dll>»   -> parte
  Get-MpThreatDetection negli ultimi 10 minuti: nessuno
```

Prima erano tre rilevamenti su tre tentativi. **Non una riga di comportamento è
cambiata**: stesse API, stessa sequenza, stessa dimensione. È cambiato solo il
fatto che il binario dichiara chi è. Questo dice quanto peso ha, nel punteggio
euristico, l'anonimato di un eseguibile.

La strada 1 resta la cura definitiva ed è **pronta ma non applicata**:
`build-all.ps1` accetta `-SignThumbprint` (o `$env:GS_SIGN_THUMBPRINT`), firma con
`signtool` marca temporale inclusa, e **riverifica la firma dopo averla apposta**
— perché `signtool sign` può uscire 0 e lasciare una firma che non convalida.
Senza thumbprint la firma viene saltata con un avviso e il build prosegue.

**Un certificato auto-generato qui non serve a niente.** Non porta attendibilità
né reputazione: si otterrebbe un binario firmato messo in quarantena esattamente
come prima. Serve un certificato vero — EV se si vuole reputazione immediata, OV
se si accetta di costruirsela nel tempo. Su questa macchina non ce n'è nessuno
(`Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My -CodeSigningCert`
non restituisce nulla), quindi il percorso di firma è scritto e non è provato:
va esercitato la prima volta che un certificato esiste davvero.

**La trappola.** «L'iniezione ha funzionato» non vuol dire «l'iniezione
funzionerà». Qui ha funzionato **una volta sola**, e il fallimento successivo non
somiglia a un problema di antivirus: somiglia a un file mancante. Chiunque
diagnostichi un'iniezione che smette di funzionare dovrebbe guardare
`Get-MpThreatDetection` prima del proprio codice.

### La cattura GDI si attiva su Yume Nikki (ma non ha ancora catturato niente)

**Il fatto (21/08/2026, sera).** Con l'injector che Defender non tocca più, il
hook entra in **Yume Nikki** (RPG_RT, RPG Maker 2003, 32 bit) e **le sorgenti GDI
si attivano davvero** — è la prima volta su un gioco commerciale, dopo che su
Unreal non erano mai state esercitate perché UE disegna via Slate/Direct3D:

```text
[gs-hook] sorgente attiva: GDI (ExtTextOutW/DrawTextW) (livello 2)
[gs-hook] sorgente attiva: GDI/GetGlyphOutline (estrazione) (livello 2)
```

**Quello che ancora manca: nessuna riga catturata.** Zero `OVERLAY:`, zero
`SUBST:`. Il hook si installa ~3 s dopo l'iniezione, quando la schermata del
titolo è **già disegnata**, e RPG_RT ridisegna solo quando qualcosa cambia:
finché non succede niente a schermo, non c'è nessuna `ExtTextOutW` da
intercettare. Serve far avanzare il gioco fino a un dialogo. Il tentativo di
farlo alla cieca ha chiuso il gioco: nel menu del titolo giapponese la sequenza
di tasti è finita su «しゅうりょう» (Esci).

**Perché alla cieca.** Due ostacoli sommati, entrambi da mettere in conto domani:

- RPG_RT **parte minimizzato e fuori schermo** (rect a Y=1290 su un monitor alto
  960). Va ripristinato a mano: `ShowWindow(SW_RESTORE)` + `MoveWindow` +
  `SetForegroundWindow`.
- Gli screenshot di computer-use **escludono la finestra del gioco**: il permesso
  concesso è la voce Steam `steam://rungameid/650700`, ma il processo che gira è
  `RPG_RT.exe` e non combacia. Il desktop si vede attraverso la finestra come se
  non ci fosse. I tasti vanno mandati con `keybd_event` (livello input, lo vede
  anche DirectInput), ma senza vedere lo schermo si naviga a memoria.

**Quattro strumenti che hanno mentito, in una sera sola.** Vale più questo
elenco della scoperta:

1. **«Nessun log» letto troppo presto.** `MainThread` fa `Sleep(3000)` e poi
   tenta la pipe, che scade con calma: le prime righe compaiono ~8 s dopo
   l'iniezione. Guardare a 3 s dice «la DLL non è partita» ed è falso. Due volte.
2. **Due log, due destinazioni.** Il core scrive `gs_translator.log` accanto alla
   DLL; `gs-hook` scrive in **`%TEMP%\gs-hook.log`** (`gs_log.h`, override con
   `GS_HOOK_LOG`). Il primo conteneva solo un `[WARN]` della pipe, e sembrava che
   il hook fosse morto lì: tutto il resto era nell'altro file.
3. **Rinominare la DLL non prova che non sia caricata.** Su Windows una DLL in
   uso **si rinomina benissimo** — è *cancellarla* che fallisce. Il mio «test
   decisivo» ha concluso l'esatto contrario del vero.
4. **I moduli di un processo a 32 bit non si enumerano da 64 bit.**
   `Process.Modules`, `tasklist /m`, e perfino `SysWOW64\tasklist.exe` mostrano
   solo lo strato `wow64*.dll`: 7 moduli per un'app GUI viva. Non è una prova di
   assenza, è uno strumento che non guarda lì.

**Da fare, in ordine.** (a) Ripristinare la finestra e **vederla** — o dando il
permesso al processo giusto, o leggendo lo schermo altrimenti. (b) Arrivare a un
dialogo (nuova partita → la stanza iniziale → interagire). (c) Verificare che
compaiano righe `OVERLAY:` con testo giapponese coalescito. (d) Solo dopo, il
dizionario: la cache è a **0 voci**, quindi anche catturando, `translated`
sarebbe uguale all'originale.

**Un buco latente nell'injector, trovato guardando altro.** Il successo si
deduce da `WaitForSingleObject(thread, 15000)` + `GetExitCodeThread`: se il
thread remoto non finisse entro 15 s, l'exit code sarebbe `STILL_ACTIVE` (259) —
non zero, quindi **scambiato per un HMODULE valido** e riportato come «DLL
caricata». Non è successo (l'iniezione è istantanea), ma il caso c'è: `259` va
trattato come fallimento. **Fatto** (PR #99): ora si controlla l'esito di
`WaitForSingleObject` e un thread non terminato ritorna il codice 8, senza
liberare la memoria remota — che il `LoadLibraryW` appeso sta ancora leggendo.
### La cattura schermo non usa xcap, e prende le coordinate invece della finestra

**Come e' nata la domanda (22/08/2026).** Serviva una schermata vera di Yume
Nikki per misurare i backend VLM. Ne ho catturate diverse e sembravano nere, da
cui la conclusione: «la superficie DirectDraw di RPG_RT non si cattura coi
metodi GDI». **Era sbagliata due volte**, e il modo in cui lo era vale piu'
della domanda di partenza. La risposta vera e' in fondo, sotto «Come e' finita»:
`PrintWindow` cattura RPG_RT benissimo.

**Primo fatto: xcap non esiste in questo progetto.**
`docs/piano-vlm-contesto-visivo.md` dice che «il comando Rust screen_capture.rs
(xcap) copre gia' Windows/Linux/macOS». Falso: `xcap` compare **zero volte** sia
in `src-tauri/Cargo.toml` sia in `Cargo.lock`.

**Secondo fatto: ci sono due moduli con lo stesso nome, e quello collegato al
frontend e' uno stub.**

| Modulo | Stato |
|---|---|
| `src-tauri/src/commands/screen_capture.rs` | **stub integrale**: `capture_screen` → `Err`, `capture_window` → `Err`, `get_windows` → `[]`, `get_monitors` → un 1920×1080 inventato, `check_screen_capture_available` → `false` |
| `src-tauri/src/ocr_translator/screen_capture.rs` | reale: `BitBlt` + `SRCCOPY` dal DC **dello schermo**, alle coordinate della finestra |

`lib/ocr/screen-capture.ts:87` invoca `capture_screen`, cioe' **lo stub**: quel
percorso fallisce sempre e ripiega su `getDisplayMedia` del browser. Il percorso
Rust vivo e' l'altro, usato da `capture_screen_region`.

**Terzo fatto, quello che conta: la cattura e' delle COORDINATE, non della
finestra.** `BitBlt` dal DC dello schermo copia quello che e' composito in quel
rettangolo — compreso qualunque finestra ci stia sopra. Misurato: mentre cercavo
di catturare Yume Nikki ho catturato **un video di YouTube dentro Brave**. La
prova non e' l'immagine, e' `WindowFromPoint`:

```text
il pixel (630,460) appartiene a PID 13760 (brave)   — gioco: PID 15224
finestra del gioco secondo GetWindowRect: (300,200)-(960,720)
```

Il gioco *diceva* di essere li'. I pixel erano di un altro processo.

**E la finestra non si porta sopra a comando.** `SetForegroundWindow` fallisce
(Windows non lascia rubare il primo piano), e `SetWindowPos(HWND_TOPMOST)` non
basta contro un browser a schermo intero. Il primitivo giusto sarebbe
`capture_window`, che mira alla finestra invece che all'area — ed e' quello che
ritorna `Err("Window capture not available")`.

**Perche' e' grave per il prodotto.** Una cattura dipendente dall'occlusione fa
tradurre il testo dell'applicazione sbagliata **senza nessun segnale**: una
notifica, un overlay, un browser davanti, e l'OCR legge quelli. Non c'e' errore,
non c'e' log: ci sono pixel plausibili e una traduzione di qualcos'altro. Prima
di investire sul contesto visivo (VLM) conviene sistemare questo, che sta a
monte: un VLM alimentato dai pixel sbagliati risponde benissimo alla domanda
sbagliata.

**La trappola, a due strati.** Una cattura che restituisce pixel non e' una
cattura di cio' che hai chiesto. Ho concluso dai contenuti dell'immagine («e'
nera, quindi DirectDraw non si cattura») quando la domanda vera era *di chi sono
questi pixel*. Il controllo che chiude la questione costa una riga —
`WindowFromPoint` sul punto che stai per copiare — e va fatto **prima** di
interpretare l'immagine.

Ma il secondo strato e' peggiore: anche dopo aver scoperto che i pixel erano di
Brave, ho continuato a credere alla spiegazione DirectDraw, e l'ho **scritta nel
codice** come commento. Una spiegazione sbagliata committata e' peggio di
nessuna spiegazione: sembra conoscenza acquisita e qualcuno ci costruisce sopra.
A smontarla e' bastato enumerare l'albero delle finestre del processo — una cosa
che avrei potuto fare all'inizio, e che nessuna delle immagini catturate avrebbe
mai potuto dirmi.

**Come e' finita (stessa sera, PR #102).** Enumerando le finestre del processo
con titoli e classi corretti, RPG_RT ne espone **due di primo livello con lo
STESSO titolo**:

```text
TApplication      client 0x0     <- fantasma di Delphi/VCL
TFormLcfGameMain  client 644x484 <- il gioco
```

`list_windows` le restituiva entrambe, e la ricerca per titolo poteva risolvere
sul fantasma. Quella cattura non fallisce: restituisce un riquadro vuoto — il
«nero» da cui era partita tutta la storia.

Puntando alla finestra vera, **`PrintWindow` con `PW_RENDERFULLCONTENT` rende la
schermata del titolo per intero**: logo, `ver. 0.10a`, il menu New Game / Dream
Diary / Quit, la firma di KIKIYAMA. Leggibile, pronta per l'OCR. In numeri:
12,1% di pixel accesi sulla finestra vera contro 6,6% sul fantasma, e quel 6,6%
era **tutta barra del titolo**, cioe' la cornice che `PrintWindow` disegna
sempre anche quando il contenuto manca.

Quindi **DirectDraw non c'entrava niente**, e le superfici accelerate non erano
il problema. La cura e' in due punti: `list_windows` scarta le finestre senza
area client (ogni app Delphi ne ha una, non e' una stranezza di un gioco), e
`capture_window` chiede alla finestra di disegnarsi invece di copiare
dallo schermo.


### Il hook GDI aggancia le funzioni Unicode, e RPG_RT chiama solo quelle ANSI

**Il fatto (22/08/2026).** Con il gioco portato fino a un testo vero — Yume
Nikki, stanza di Madotsuki, «Adjusting Sound Levels / Please Wait...» a schermo —
il hook GDI ha catturato **zero righe**. Non un problema di tempi, di cache o di
schermata sbagliata: le due sorgenti risultano attive nel log e non vengono
chiamate mai.

**Perche', misurato sulla tabella degli import di `RPG_RT.exe`:**

```text
ExtTextOutA          PRESENTE      ExtTextOutW          assente
TextOutA             PRESENTE      TextOutW             assente
DrawTextA            PRESENTE      DrawTextW            assente
CreateFontIndirectA  PRESENTE      CreateFontIndirectW  assente
GetGlyphOutlineA/W   assenti entrambe
```

`gs-hook/src/sources/source_gdi.cpp` aggancia **`ExtTextOutW`** e **`DrawTextW`**;
`source_gdi_glyph.cpp` aggancia `GetGlyphOutline`. Il gioco non chiama nessuna
delle tre. Il hook e' installato su funzioni che questo processo non usa.

**E le A non passano dalle W.** E' l'assunzione che rende l'errore invisibile:
in `gdi32.dll` `ExtTextOutA` e `ExtTextOutW` sono implementazioni **separate**,
che scendono entrambe al kernel senza passare l'una per l'altra. Agganciare solo
la W non intercetta un'applicazione ANSI, mai, in nessun caso.

**Non e' un caso particolare di un gioco.** RPG_RT e' un binario Delphi
pre-Unicode: vale per **tutta** la famiglia RPG Maker 2000/2003 — cioe'
esattamente i giochi per cui la sorgente GDI di livello 2 esiste, visto che i
titoli Unreal e Unity non passano da GDI.

**Un dubbio sul commento nel codice.** `source_gdi.cpp` dice: «Scoperta sul
campo (Ib, RPG Maker 2000): RPG_RT disegna i dialoghi via ExtTextOutW in modo
INCREMENTALE». Ma **Ib gira sullo stesso RPG_RT**, quindi anche li' dovrebbero
essere chiamate ANSI. O la misura su Ib riguardava un motore diverso, o la W
c'e' finita per analogia invece che per misura. Prima di costruirci sopra, va
riverificata con la tabella degli import di quel gioco.

**La cura.** Agganciare anche `ExtTextOutA` / `TextOutA` / `DrawTextA` e
convertire la stringa in ingresso con la codepage giusta — che per i giochi
giapponesi non e' quella di sistema ma quella implicata dal charset del font nel
DC (Shift-JIS). La conversione e' la parte delicata: interpretare byte Shift-JIS
come ANSI occidentale produce testo plausibile e sbagliato, cioe' il tipo di
errore che questo documento esiste per evitare.

**La trappola.** «La sorgente e' attiva» non vuol dire «la sorgente vede
qualcosa». Il log stampa `sorgente attiva: GDI (ExtTextOutW/DrawTextW)` perche'
`MH_CreateHook` e' riuscito — cioe' perche' le funzioni **esistono in gdi32**,
non perche' il gioco le chiami. Un hook installato su una funzione mai invocata
e' indistinguibile, nel log, da un hook che funziona e non ha ancora visto
testo. La domanda che scioglie il dubbio non si fa a runtime: si fa sul file,
guardando cosa il binario importa davvero.
### Il testo di RPG Maker 2000/2003 non passa da GDI — dimostrato, non dedotto

**Cosa e' stato aggiunto.** Il hook GDI ora aggancia anche le varianti **ANSI**
(`ExtTextOutA`, `TextOutA`, `DrawTextA`), convertendo i byte con la codepage
implicata dal **charset del font nel DC** e non con quella di sistema: un gioco
giapponese disegna Shift-JIS, e leggerlo come CP1252 darebbe testo plausibile e
sbagliato. E' stata aggiunta anche una **diagnostica di esercizio**: le prime 24
chiamate viste, con porta d'ingresso e testo grezzo, **prima di ogni filtro**.

**Cosa dice la misura.** Yume Nikki portato in partita (menu del titolo, New
Game, stanza di Madotsuki, interazioni): **zero chiamate**, né W né A, né
ExtTextOut né TextOut né DrawText.

**Il controllo positivo, che e' la parte che rende quello zero una prova.** La
stessa DLL iniettata in `charmap.exe`:

```text
[gs-hook/GDI] #0 DrawTextW "Carattere selezionato:"
[gs-hook/GDI] OVERLAY: Carattere selezionato:
[gs-hook/GDI] #1 DrawTextW "U+0021: Exclamation Mark"
[gs-hook/GDI] OVERLAY: U+0021: Exclamation Mark
```

Hook, diagnostica, coalescer e inoltro all'overlay **funzionano tutti**. E' la
prima volta che la catena GDI si dimostra completa da capo a fondo. Quindi il
silenzio su RPG_RT non e' uno strumento rotto: e' il gioco che non chiama.

**Conseguenza pratica.** Per RPG Maker 2000/2003 la traduzione a runtime via GDI
e' una **strada chiusa**. La strada giusta per quei giochi e' quella sui file —
`.ldb`/`.lmu`, gia' supportata (il rilevamento e' arrivato con la PR #95). Le
varianti ANSI restano comunque utili: valgono per qualunque altro binario
pre-Unicode che il testo lo disegni davvero con GDI.

**Cosa NON e' stato misurato.** *Come* RPG_RT disegni il testo. Gli import
mostrano `BitBlt` e `StretchBlt`, il che e' compatibile con un font bitmap
blittato dalla grafica System — ma e' un'inferenza, non una misura, e va
verificata prima di costruirci sopra.

**La trappola.** Il silenzio non e' una prova finche' non hai un controllo
positivo. Un log vuoto vuol dire «il gioco non chiama» oppure «il mio strumento
non funziona», e le due cose sono indistinguibili dall'interno. Costa poco
separarle — un'applicazione di cui conosci gia' la risposta — e senza quel passo
avrei scritto «RPG Maker non usa GDI» avendo in mano soltanto un hook rotto.

### RPG Maker compone il fotogramma in memoria e lo presenta con una sola StretchBlt

**La domanda.** Appurato che RPG Maker 2000/2003 non chiama nessuna funzione di
testo GDI, restava da capire **come** disegni. L'ipotesi era un font bitmap
blittato glifo per glifo: in quel caso il rettangolo sorgente identificherebbe
il carattere, e da li' si risalirebbe al testo.

**La misura (22/08/2026, Yume Nikki in partita, `GS_HOOK_DIAG_BLIT=1`).**
Quattrocento blit registrati. **Tutti uguali:**

```text
[gs-hook/BLIT] #0 StretchBlt src=E3011337 (0,0) 320x240 -> (0,0)
[gs-hook/BLIT] #1 StretchBlt src=BB0113C8 (0,0) 320x240 -> (0,0)
[gs-hook/BLIT] #2 StretchBlt src=ED011337 (0,0) 320x240 -> (0,0)
...
[gs-hook/BLIT] ... 1000 blit finora
```

Distribuzione: **400 su 400 sono `StretchBlt` di 320x240 dall'origine
all'origine**. Zero `BitBlt`. Zero blit piccoli. Le DC sorgente si alternano fra
due famiglie (`…1337` e `…13C8`): doppio buffer.

**Cosa vuol dire.** Il motore disegna **tutto** — tile, sprite, finestre di
dialogo, testo — dentro una propria bitmap in memoria, scrivendo i pixel
direttamente, **senza una sola chiamata di disegno GDI**. Poi presenta il
fotogramma finito con una StretchBlt per frame.

**Prima conseguenza: l'intercettazione del testo a runtime e' impossibile per
questa famiglia di motori.** Non «difficile»: impossibile per questa via. Il
testo non esiste mai come testo in nessuna chiamata di sistema — ne' come
stringa, ne' come glifo. Per RPG Maker 2000/2003 la traduzione va fatta **sui
file** (`.ldb`/`.lmu`), ed e' la strada che il progetto ha gia'.

**Seconda conseguenza, e qui c'e' un guadagno.** Quella StretchBlt e' un punto
di aggancio **ideale per la cattura**: una volta per fotogramma passa il
fotogramma COMPLETO, gia' composto, 320x240, dentro il processo. Confrontata con
la cattura dallo schermo:

| | dallo schermo | alla StretchBlt |
|---|---|---|
| finestra coperta | prende i pixel di chi copre | indifferente |
| overlay/notifiche | finiscono nel fotogramma | non esistono |
| ridimensionamento | scala della finestra | risoluzione nativa 320x240 |
| sincronia | asincrona, prende quel che c'e' | esattamente un fotogramma |

Per i giochi che presentano cosi', questo aggira **tutto** il problema della
cattura per coordinate — non lo mitiga, lo elimina. Vale la pena tenerlo a mente
per il percorso OCR/VLM.

**La trappola.** Il primo filtro guardava solo i blit con sorgente piccola
(<= 32 px), perche' «i glifi sono piccoli». Ha prodotto **zero righe**, e zero
righe li' non distingue «nessun glifo» da «nessuna chiamata»: sono due risposte
opposte e il filtro le rendeva identiche. Tolto il filtro, lo stesso identico
esperimento ha prodotto 400 dati. **Un filtro che non produce risultati risponde
a una domanda diversa da quella che hai fatto** — prima si guarda se la funzione
viene chiamata, solo dopo si sceglie cosa tenere.

### La cattura al present: il fotogramma preso dove il gioco lo consegna

**Cos'e'.** `GS_HOOK_FRAME_DUMP=<prefisso>` fa salvare al hook i primi
fotogrammi come `.bmp`, presi **dentro l'hook sul blit di present** — quello con
cui il gioco consegna il frame finito alla finestra. Si riconosce da
`WindowFromDC(destinazione)`, non dalle dimensioni: 320x240 e' di questo gioco,
mentre «la destinazione e' una finestra» vale per qualunque motore che presenti
con un blit.

**La prova che i pixel non vengono dallo schermo.** Non basta catturare e vedere
il gioco: se la finestra e' in primo piano, anche la cattura dallo schermo
darebbe la stessa immagine, e le due ipotesi restano indistinguibili. Serve una
condizione in cui lo schermo NON puo' avere quei pixel.

Primo tentativo: coprire la finestra con un'altra. Fallito due volte — il gioco
si riprende il primo piano, e lo script l'ha detto («il gioco NON e coperto, il
test non prova niente») invece di spacciare per riuscito un test che non lo era.

Secondo tentativo, decisivo: **spostare la finestra fuori dallo schermo**.

```text
schermo virtuale: 2293x960 da (0,0)
finestra a (2343,100)-(3003,620)  interseca lo schermo: False
[gs-hook/FRAME] #0 320x240 -> ...fuori-0.bmp (ok)
[gs-hook/FRAME] #1 320x240 -> ...fuori-1.bmp (ok)
[gs-hook/FRAME] #2 320x240 -> ...fuori-2.bmp (ok)
```

I tre BMP contengono la schermata del titolo **completa e corretta**, mentre di
quella finestra non c'era **un solo pixel** sul monitor. Nessuna cattura dallo
schermo puo' produrre quel risultato.

**Cosa vale.** Confrontata con la cattura dallo schermo, su cui questo progetto
ha perso una serata:

| | dallo schermo | al present |
|---|---|---|
| finestra coperta | prende i pixel di chi copre | indifferente |
| finestra fuori schermo | impossibile | **misurato: funziona** |
| overlay, notifiche, cursore | finiscono nel fotogramma | non esistono ancora |
| risoluzione | quella della finestra, scalata | nativa, 320x240 |
| sincronia | «quello che c'era» | esattamente un fotogramma |

**Cosa NON fa, di proposito.** Non consegna i fotogrammi all'applicazione: salva
un numero limitato di file e si ferma. Quel ponte va costruito con **entrambi i
lati insieme** — questo progetto ha gia' collezionato IPC a meta', ed e' il
motivo per cui la catena in-game e' rimasta ferma tanto tempo. Qui si dimostra
il punto d'aggancio; il trasporto e' un passo successivo e deliberato.

**La trappola.** Un test che non riproduce la condizione da provare non prova
niente, per quanto il risultato sembri buono. Catturare un gioco in primo piano
e vedere il gioco e' compatibile con entrambe le spiegazioni. Il test vale solo
quando la spiegazione sbagliata e' **impossibile**: fuori dallo schermo, i pixel
dello schermo non ci sono, e resta una sola lettura.

### Il trasporto dei fotogrammi, con i due lati costruiti insieme

**Cos'e'.** `GS_HOOK_FRAME_SHARE=1` fa pubblicare a gs-hook l'ultimo fotogramma
in memoria condivisa (`Local\gs-hook-frame-<pid>`); il backend lo legge col
comando Tauri `read_game_frame(pid)`. Il contratto sta in
`gs-hook/include/gs_frame_share.h`, il lettore in
`src-tauri/src/commands/game_frame.rs`.

**Perche' memoria condivisa e non una pipe.** Un fotogramma va sempre
SOSTITUITO, mai accodato: al consumatore interessa l'ultimo, non la storia. Una
pipe accumulerebbe fotogrammi che nessuno vuole, e un lettore lento
riempirebbe il buffer bloccando il gioco. Un buffer che si sovrascrive non puo'
ingolfarsi: se il lettore e' lento salta dei fotogrammi, che e' il
comportamento giusto. Per lo stesso motivo **non c'e' un canale di richiesta**:
il thread di rendering del gioco non deve mai aspettare nessuno.

**Il ritmo.** Copiare 300 KB a 60 fotogrammi al secondo sono 18 MB/s di memcpy
dentro il rendering, per un OCR che ne usera' dieci. Si pubblica al massimo ogni
100 ms (`GS_HOOK_FRAME_MS`). Misurato: il contatore avanza di 8 in 400 ms, e
avanza di **2 per fotogramma** (vedi sotto), quindi 4 fotogrammi in 400 ms —
esattamente il ritmo dichiarato.

**Il contatore in stile seqlock.** Il produttore lo porta a dispari prima di
scrivere e a pari dopo; il lettore accetta la copia solo se il valore era pari
ed e' rimasto identico. Senza, si prende meta' fotogramma vecchio e meta' nuovo:
il risultato **sembra un'immagine**, quindi non si nota. Nessun lock, cosi' un
consumatore che muore non puo' bloccare il gioco — cosa che un mutex condiviso
farebbe.

**I due lati nascono insieme, ed e' il punto.** Questo repository ha gia'
collezionato IPC monchi — memoria condivisa senza lettore, pipe di richiesta
senza risposta — ed e' il motivo per cui la catena in-game e' rimasta ferma a
lungo. Qui il produttore C++, il lettore Rust, nove test e una prova a due
processi arrivano nello stesso cambiamento.

**Due difetti trovati SOLO dalla prova a due processi**, entrambi della stessa
famiglia: risultato plausibile, contenuto sbagliato. I nove test unitari
passavano in entrambi i casi.

1. **Il quarto byte non e' alpha.** Le DIB a 32 bit di GDI sono BGR**X**: quel
   byte resta a zero. Copiarlo come alpha dava un PNG **interamente
   trasparente**. La misura che l'ha inchiodato: `5180 pixel con RGB non nero,
   0 pixel con alpha non zero` — l'immagine era corretta e invisibile. E il
   test che avrebbe dovuto vederlo passava un alpha di 255 in ingresso, quindi
   **concordava col codice invece di verificarlo**. Ora passa zero, come fa GDI.
   Lo stesso difetto era in `capture_window` (PR #102), scritto poche ore prima:
   corretto anche li'.
2. **Le righe erano capovolte.** `GetDIBits` con altezza positiva le
   restituisce dal basso — il verso del BMP, sbagliato per tutto il resto. Il
   fotogramma arrivava specchiato in verticale. Ora il contratto dichiara
   **top-down**, il produttore chiede altezza negativa, e il BMP di diagnostica
   si adegua (il formato ammette altezze negative).

**La trappola.** «Il trasporto funziona» sembrava provato da tre segnali
concordi: sequenza che avanza, uscita 0, PNG di 16 KB. Erano tutti veri, e
l'immagine consegnata era un rettangolo vuoto. Un canale si verifica guardando
**cosa e' arrivato**, non se e' arrivato qualcosa — e conviene guardarlo con
occhi, non con un conteggio di byte.

### Il percorso OCR prende i fotogrammi dal gioco, e una env var che non poteva funzionare

**Cosa e' collegato.** `captureScreen` accetta ora `gameProcess`: se valorizzato,
il fotogramma arriva da dentro il gioco (`read_game_frame`) invece che dallo
schermo, e si ripiega sullo schermo — dicendolo — quando il gioco non pubblica.
Il motore live risolve il gioco da solo all'avvio con `list_publishing_games`,
che prova ad aprire `Local\gs-hook-frame-<pid>` per ogni processo vivo.

**Con due giochi non si sceglie.** `detectGameProcess` ritorna `null` sia con
zero candidati sia con due o piu': prendere il primo tradurrebbe in silenzio il
gioco sbagliato, che e' il difetto da cui e' nata tutta questa parte del codice.
Stessa regola gia' applicata ai titoli ambigui in `capture_window`.

**Il difetto trovato dopo aver scritto la funzione: una variabile d'ambiente
che l'applicazione non puo' impostare.** La pubblicazione era accesa da
`GS_HOOK_FRAME_SHARE=1`, letta dentro il processo del gioco. Ma l'iniezione
avviene in un processo **gia' avviato**, e in un processo avviato una variabile
d'ambiente non si puo' piu' impostare. Funzionava solo nelle prove da riga di
comando, dove il gioco lo lanciavo io con la variabile gia' pronta: la
funzione era irraggiungibile dal flusso vero, e ogni prova fatta fin li' lo
confermava senza mostrarlo.

Il progetto **aveva gia' incontrato e risolto lo stesso problema**: il
dizionario usa un percorso convenuto proprio per questo, e il commento che lo
spiega e' in `gs_hook_injector.rs` da settimane. Non l'ho letto prima di
ripetere l'errore. La cura e' la stessa: una sentinella,
`%APPDATA%\GameStringer\gs-hook-frame-share`, che il backend crea PRIMA di
iniettare (`inject_gs_hook(share_frames)`). La env var resta, ma solo per le
prove.

**Verificato senza env var**, che e' l'unico modo che conta:

```text
sentinella creata: ...\GameStringer\gs-hook-frame-share
[gs-hook/FRAME] pubblicazione attiva: Local\gs-hook-frame-18368 (320x240, 307264 byte)
letto 320x240 seq=148 -> sentinella.png (16162 byte PNG)
seq avanzata 148 -> 156: il gioco sta pubblicando
```

E il PNG e' la schermata del titolo, guardata — non dedotta dai contatori.

**Il percorso caldo, gia' che c'era.** Gli hook sui blit passano a ogni tile di
ogni fotogramma. Due sprechi tolti: il contatore della diagnostica non si
incrementa piu' quando la diagnostica e' spenta, e il freno temporale viene
PRIMA di `WindowFromDC` — nella stragrande maggioranza dei blit la risposta e'
«non ora», e va data con un confronto fra interi invece che con una chiamata di
sistema.

**La trappola.** Una funzione puo' essere corretta, compilata, provata e
irraggiungibile. Tutte le mie prove passavano perche' riproducevano una
condizione che l'applicazione non puo' creare — il gioco lanciato da me con la
variabile impostata. Provare una funzione nel modo in cui NON verra' usata non
la prova: prima di dire «funziona» conviene chiedersi chi, nel flusso vero,
mette quell'interruttore su acceso.

### A risoluzione nativa l'OCR non legge niente, e il preprocessore retro e' codice morto

**La domanda.** La catena consegna il fotogramma giusto. Ma consegnare
un'immagine non e' tradurre: l'OCR riesce a leggere il font bitmap di RPG Maker?

**Prima misura, sbagliata di percorso.** Ho scritto una sonda in Rust e ho
ottenuto una risposta incoraggiante — l'OCR di Windows legge 3-4 righe dal
fotogramma nativo, con errori sistematici (`NUME` per YUME, `PROOUCEO` per
PRODUCED). Poi mi sono accorto che **il loop live non usa quel motore**:
`lib/ocr/ocr-service.ts` chiama **Tesseract.js**. Avevo misurato una strada che
non e' quella percorsa.

**Seconda misura, con controllo positivo.** La prima versione della sonda
Tesseract dava zero righe sul fotogramma di gioco. Prima di concludere, l'ho
puntata su uno screenshot dell'applicazione, pieno di testo: **zero righe anche
li'**. Era la sonda a essere rotta — `tesseract.js` non popola righe e parole
senza `{ blocks: true }`. Corretta: 26 righe sullo screenshot. Solo allora la
misura sul gioco vale qualcosa.

**Il risultato, su Tesseract.js, cioe' sul motore vero:**

| ingrandimento | righe lette | testo |
|---|---|---|
| nessuno (320x240) | **0** | niente |
| x3 (960x720) | 8 | `Mew Game 3` (79), `PRODUCED EY KIKIMAMA` (49) |
| x6 (1920x1440) | 8 | **`New Game 3`** (65), `VUME ~~ MIKKI` (55) |

**A risoluzione nativa Tesseract non aggancia il font: zero righe.** Non e' una
questione di qualita', e' la differenza fra nessun testo e del testo. Il loop
live non ingrandiva: `captureAndTranslate` passava la cattura direttamente
all'OCR. Ora ingrandisce con un fattore INTERO e nearest-neighbour —
sull'interpolazione un font bitmap peggiora, non migliora — e **riporta in scala
i riquadri**, che tornano nello spazio ingrandito e altrimenti posizionerebbero
l'overlay a distanza multipla dal testo.

**E c'era gia' in casa la cura migliore, mai collegata.**
`src-tauri/src/ocr_translator/retro_preprocessor.rs` e' un preprocessore
completo per font pixelati — preset 8-bit/16-bit/DOS/PC-98, upscale, contrasto,
soglia, sharpen, rimozione del dithering, rilevamento automatico del tipo di
gioco. Ha `#![allow(dead_code)]` in cima e **zero chiamanti in tutto il
progetto**: un `grep` su Rust, TS e TSX trova solo la riga che lo dichiara
modulo. Sul fotogramma di Yume Nikki, con l'OCR di Windows, trova **4 righe
contro 3** e recupera `New Game` che le altre strade perdevano del tutto.

Stesso schema gia' visto stasera: `commands/screen_capture.rs` era uno stub, gli
IPC erano a meta', e qui un preprocessore finito aspetta un chiamante. Il
progetto ha piu' pezzi giusti scollegati che pezzi mancanti.

**La trappola, due volte nella stessa indagine.** La prima: misurare il motore
sbagliato e concludere sul percorso vero. La seconda: leggere «zero righe» come
un risultato invece che come un possibile difetto della sonda. Sono la stessa
trappola con due facce, e la separa una cosa sola — un controllo di cui conosci
gia' la risposta, fatto PRIMA di interpretare il numero.

### Il preprocessore retro NON va collegato: misurato sul motore giusto, peggiora

**La proposta sembrava ovvia.** `retro_preprocessor.rs` e' un preprocessore
completo per font pixelati, senza un solo chiamante. Sul fotogramma di Yume
Nikki, con l'OCR di Windows, trovava **4 righe contro 3** e recuperava
`New Game`: collegarlo pareva il passo successivo naturale.

**Sul motore vero l'esito si rovescia.** Il loop live usa Tesseract.js e scarta
le righe sotto confidenza **40** (`LiveTranslationConfig.minConfidence`).
Contando cio' che passa quel filtro, non le righe grezze:

| variante | righe totali | **passano il filtro** |
|---|---|---|
| grezzo 320x240 | 1 | **0** |
| x6 nearest | 8 | **6** |
| preprocessore retro (preset 8-bit) | 9 | **2** |

Il preprocessore ne trova **di piu'** e ne fa passare **un terzo**: le sue righe
escono con confidenze 19-34, sotto la soglia. Contare le righe grezze diceva
«meglio»; contare quelle utilizzabili dice «tre volte peggio».

**Non e' colpa del preset.** Provate otto preparazioni sullo stesso fotogramma,
misurando sempre le righe sopra soglia:

```text
 6 passano /  8 tot  x6 nearest
 6 passano /  8 tot  x6 + negato
 4 passano /  6 tot  x6 + grigi
 4 passano /  6 tot  x6 + grigi + normalizza
 4 passano /  6 tot  x6 + grigi + negato
 4 passano /  9 tot  x6 + grigi + soglia 64
 4 passano /  9 tot  x6 + grigi + soglia 64 + neg
 1 passano /  5 tot  x6 + grigi + soglia 128
```

**Il semplice ingrandimento vince su tutto.** Grigi, normalizzazione,
negazione e soglia sono tutte pari o peggio, e la soglia a 128 — quella che il
preset 8-bit sceglie, dopo aver correttamente rilevato `Bit8` — e' la peggiore
in assoluto. Su un font gia' ad alto contrasto, binarizzare toglie informazione
invece di pulirla.

**Decisione: non si collega.** Il modulo resta dov'e', con questa misura scritta
in testa cosi' che nessuno debba rifarla per scoprire la stessa cosa. Non e'
codice sbagliato — e' codice pensato per DOS/PC-98 a bassissima palette, dato a
un motore diverso su un gioco diverso.

**Limite dichiarato.** La misura e' su UNA schermata (il titolo di Yume Nikki:
fondo nero, testo chiaro) e UN motore. Una finestra di dialogo, o un gioco con
testo scuro su fondo chiaro, potrebbe rovesciare di nuovo l'esito. Quello che
NON cambia e' il metodo: contare le righe che superano il filtro vero, non
quelle che l'OCR emette.

**La trappola.** Un preprocessore che «trova piu' testo» puo' peggiorare il
risultato, se il testo in piu' arriva sotto la soglia che qualcun altro
applica a valle. La metrica giusta non e' quella della funzione che stai
guardando: e' quella dell'ultimo anello che decide. E l'avevo gia' quasi
sbagliata una volta, misurando il motore OCR che il loop non usa.

### La prova dentro l'app: dove arriva, e dove si ferma

**Cosa e' stato verificato sul sistema vero**, con l'applicazione in esecuzione
(dev build) e Yume Nikki agganciato:

- il gioco pubblica: `[gs-hook/BLIT] hook blit installati (diag=0 dump=0
  condivisione=1)` e `pubblicazione attiva: Local\gs-hook-frame-26552`;
- il backend lo trova da solo: `list_publishing_games` restituisce **un solo**
  candidato, `RPG_RT.exe`, che e' esattamente cio' che `detectGameProcess`
  userebbe;
- l'applicazione si avvia, serve le sue pagine e apre la finestra.

**Dove si e' fermata: il profilo chiede una password.** Per arrivare alla pagina
di traduzione live bisogna autenticarsi su un profilo, e una password non si
inserisce per conto dell'utente. Il giro completo — avvia traduzione →
fotogramma dal gioco → OCR → traduzione → overlay — resta **non percorso**, e va
detto invece di darlo per riuscito perche' tutti i pezzi funzionano
singolarmente.

Chiunque provi ad automatizzare un test end-to-end dell'app trovera' lo stesso
cancello: e' la prima cosa da risolvere (un profilo di prova senza password, o
un percorso di avvio che lo salti in modalita' test).

**Una tecnica che e' servita e conviene ricordare.** Gli screenshot di
computer-use **escludono le finestre non concesse**, e il permesso si aggancia
al percorso dell'eseguibile: la build di sviluppo (`target/debug`) non combacia
con quella installata, quindi l'app risultava invisibile — desktop attraverso la
finestra, esattamente come era successo col gioco.

La soluzione e' arrivata dal lavoro di oggi: `capture-window-probe`, che usa il
nostro `capture_window`, **non passa dallo schermo** e quindi non e' soggetto a
quel filtro. Ha catturato l'applicazione senza problemi. Uno strumento nato per
i giochi si e' rivelato il modo per vedere la nostra stessa applicazione quando
il livello screenshot la nasconde.

**La trappola.** «Tutti i pezzi funzionano» non e' «la catena funziona». Qui
ogni anello e' verificato singolarmente e il giro completo non l'ha ancora fatto
nessuno: l'unico modo di sapere se regge e' percorrerlo, e finche' non e' stato
percorso va scritto cosi'.

### Windows OCR: la lingua sorgente, il ripiego per scrittura e il panic di `block_on`

**Il fatto.** Fino alla Fase 0 l'OCR Rust di Windows ignorava la lingua sorgente:
il motore nasceva sempre da `OcrEngine::TryCreateFromUserProfileLanguages()`, il
parametro di `recognize_text_async` si chiamava `_language` e nessuno lo leggeva
(`recognize_text` lo scriveva nel `log::debug!` e lo passava avanti), quindi si
otteneva il riconoscitore del profilo Windows qualunque lingua si scegliesse. E
ogni riga usciva con `confidence: 0.9` scritto a mano, perché Windows OCR una
confidenza per riga non la fornisce: il cursore «confidenza minima» di
`/ocr-translator` (30–90%, default 50%) non scartava mai niente, e il badge di
`/live-ocr` avrebbe mostrato 90% su qualunque testo, se quella pagina avesse mai
ricevuto una risposta (vedi il panic più sotto). Ora:

- il motore si crea per la lingua chiesta: `Language::CreateLanguage` →
  `OcrEngine::IsLanguageSupported` → `OcrEngine::TryCreateFromLanguage`.
  `"auto"` (o vuoto) resta sulle lingue del profilo, che è l'unico automatico
  che Windows OCR offre;
- se il riconoscitore esatto manca, si ripiega sul primo riconoscitore
  installato con la **stessa scrittura** (`Language.Script`, quattro lettere).
  Le scritture indeterminate (`Z…`: `Zyyy`, `Zzzz`, `Zxxx`) non combaciano con
  niente;
- se manca anche quello, l'errore è onesto: comincia col marcatore
  `OCR_LANGUAGE_NOT_INSTALLED` e dice di installare il language pack con il
  riconoscimento ottico dei caratteri. `start_ocr_translator` lo verifica
  **prima** di accendere il loop, perché dentro `run_ocr_loop` un errore
  finisce solo in `log::warn!` e la pagina resterebbe «avviata» e muta;
- `confidence` è sparito da `DetectedText` e `OcrTextResult`, e
  `min_confidence` da `OcrConfig`.

**Misura (01/10/2026, questa macchina: Windows 11, unico riconoscitore OCR
installato `it-IT`).** Le lingue si interrogano da Windows PowerShell 5.1
(`powershell.exe`), che sa caricare i tipi WinRT:

```powershell
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
[Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | % { "$($_.LanguageTag) $($_.Script)" }
foreach ($t in 'en','en-US','it','ja','zh','zh-Hans','ko','ru') {
  $l = [Windows.Globalization.Language]::new($t)
  "$t supportata=$([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($l)) scrittura=$($l.Script)"
}
```

`AvailableRecognizerLanguages` restituisce solo `it-IT Latn`. Il resto, con
accanto cosa ne fa `create_engine` (letto dal codice, non eseguito in Rust):

| richiesta | `IsLanguageSupported` | scrittura | `create_engine` |
|---|---|---|---|
| `it` | True | `Latn` | motore `it-IT` |
| `en`, `en-US` | **False** | `Latn` | ripiego su `it-IT` |
| `ru` | False | `Cyrl` | errore language pack |
| `ja` | False | `Jpan` | errore language pack |
| `ko` | False | `Kore` | errore language pack |
| `zh-Hans` | False | `Hans` | errore language pack |
| `zh` | False | **`Zyyy`** | errore, senza nemmeno tentare il ripiego |

Che il riconoscitore italiano legga l'inglese è stato provato, non dedotto: un
PNG sintetico (Segoe UI 28, nero su bianco, 900x160) con due righe inglesi, dato
a `RecognizeAsync` del motore `it-IT` dalla stessa PowerShell (sonda non
committata: `System.Drawing` per il disegno, `BitmapDecoder` per la
`SoftwareBitmap`):

```text
richiesta: en  IsLanguageSupported=False  script=Latn
riconoscitore usato: it-IT
  riga: The quick brown foxjumps over the lazy dog
  riga: New Game Load Game Options Quit
```

Due righe su due, un solo difetto (`foxjumps`, uno spazio perso). È testo di
sistema pulito, non un fotogramma di gioco: dice che il ripiego ha senso, non
quanto legga un font bitmap.

**Il panic di `block_on`.** Prima `recognize_text` costruiva un runtime Tokio
(`new_current_thread()`) e ci faceva `block_on` sull'`.await` di
`RecognizeAsync`. Dal loop di `/ocr-translator` funzionava, perché
`run_ocr_loop` gira in un `std::thread::spawn`, fuori da ogni runtime. Ma
`ocr_recognize` è un comando Tauri `async` e chiamava `recognize_text`
direttamente, cioè da un thread del runtime di Tauri; e `ocr_recognize_png`,
quello che invoca `/live-ocr` (`components/tools/live-ocr-overlay.tsx`), passa da
`ocr_recognize`. Lì Tokio va in panic con «Cannot start a runtime from within a
runtime» (`tokio/src/runtime/context/runtime.rs`): la chiamata moriva invece di
restituire un risultato o un errore. Ora l'attesa è `IAsyncOperation::get()` di
`windows-future`, che blocca il thread su un evento Win32 senza nessun runtime
(`windows-future-0.2.1/src/get.rs` e `waiter.rs`: `CreateEventW`, poi
`WaitForSingleObject`), e `ocr_recognize` chiama `recognize_text`
dentro `tauri::async_runtime::spawn_blocking`, così ad aspettare non è un thread
del runtime async.

**Nel codice.**

- `src-tauri/src/ocr_translator/ocr_engine.rs` — `create_engine()`,
  `engine_with_same_script()`, `check_language()`, `recognize_text()`; costante
  `OCR_LANGUAGE_NOT_INSTALLED`.
- `src-tauri/src/ocr_translator/mod.rs` — `start_ocr_translator` chiama
  `ocr_engine::check_language` prima di partire; `ocr_recognize` usa
  `spawn_blocking`.
- `src-tauri/Cargo.toml` — feature `"Globalization"` del crate `windows` 0.61:
  senza, `windows::Globalization::Language` non esiste e `ocr_engine.rs` non
  compila.
- `lib/ocr-overlay-payload.ts` — lo stesso marcatore e `isOcrLanguageMissing()`,
  con cui `app/ocr-translator/page.tsx` e `components/tools/live-ocr-overlay.tsx`
  mostrano l'indicazione tradotta. `live-ocr-overlay.tsx` passa `zh-Hans` al
  posto di `zh`, proprio per la scrittura indeterminata.

**Le trappole.**

1. **Un parametro col trattino basso è il compilatore che te lo dice.**
   `_language` era una promessa della firma che il corpo non manteneva: la UI
   faceva scegliere la lingua, la funzione la buttava. Nessun errore, solo un
   riconoscitore diverso da quello chiesto.
2. **Una costante al posto di una misura fa sembrare vivo un filtro.** 0.9 è
   ≥ di ogni valore che il cursore permetteva: il cursore si muoveva, la soglia
   non scartava mai niente, e il 90% era un numero inventato. Se il motore non
   fornisce un dato, il dato non si mostra.
3. **`IsLanguageSupported("en") == False` non vuol dire «l'inglese non si
   legge».** Conta la scrittura, non il tag. Ma il ripiego vale solo per una
   scrittura vera: `zh` da solo è `Zyyy`, e farlo combaciare con qualcosa
   vorrebbe dire leggere il cinese con un riconoscitore a caso.
4. **La stessa funzione era giusta da un chiamante e rotta dall'altro.**
   `block_on` da un `std::thread` funziona, da un comando `async` va in panic.
   Provarla dal loop di `/ocr-translator` non avrebbe mai mostrato il difetto di
   `/live-ocr`: una funzione bloccante si prova da **ogni** contesto che la
   chiama.

---

## Scelta del metodo: il pianificatore di String it

**Stato all'11/11/2026: il piano ordina, blocca e guida la cascata
nativo → runtime → OCR. Non ancora provato su giochi veri.**

Prima la scelta era una catena di `if` sul nome del motore dentro
`startAutoTranslate` (`components/game-detail-client.tsx`), con il motore
ricalcolato 11 volte e l'anti-cheat mai controllato prima di installare
BepInEx.

Ora c'è un comando Rust, `plan_translation` (`src-tauri/src/commands/translation_plan.rs`),
che per un gioco installato restituisce:

- il motore e **da dove lo sappiamo**: `files` (marcatori nella cartella,
  fiducia 90), `hint` (nome/PCGamingWiki, 50), `none` (0);
- l'anti-cheat trovato nella cartella, se c'è;
- i metodi **in ordine**: quello nativo del motore, poi `runtime-hook`, per
  ultimo `ocr-overlay`, che c'è sempre.

Regole che il piano applica (coperte da test in fondo al file Rust):

- con un anti-cheat ogni metodo che inietta (`unity-xunity`, `runtime-hook`)
  ha `blocked_by` e non va eseguito; i metodi statici e l'OCR restano;
- RPG Maker dipende dalla variante letta dal disco: MV/MZ → `rpgmaker-json`,
  XP/VX/Ace → `generic-workflow`, 2000/2003 → nessun metodo statico;
- Godot, Wolf RPG, Bethesda, CRI e Telltale sono metodi `page`: rinviano allo
  strumento dedicato, non sono ancora automatici;
- Unity con tabelle di localizzazione: `unity-loc-tables` (statico, vedi la
  voce «Il metodo statico dentro String it») viene prima di `unity-xunity`.

Nel frontend (`lib/string-it/plan.ts`): `resolveEngine` è l'unico punto che
decide il motore per tutti i rami; il ramo Unity e `tryRuntimeFallback` si
fermano se il piano blocca l'iniezione; sotto il pulsante compare il piano.

**Cascata (11/11/2026).** Quando il metodo nativo non scrive nulla si chiama
`tryRuntimeFallback`, che ora segue il piano: prova `runtime-hook` (la regola
`planRuntimeFallback` riceve finalmente `antiCheatBlocked`) e, se il runtime
non va — bloccato, DLL assente, gioco chiuso, iniezione fallita — propone il
metodo che il piano mette dopo (`methodAfterRuntime`), oggi l'OCR con un
pulsante «Apri OCR». Anche i rami Unity e RPG Maker MV/MZ, che prima si
fermavano all'errore, ora entrano nella cascata. Verificato solo con test
della regola: **non provato su giochi veri**.

**Cosa manca.** L'OCR si propone, non parte da solo (serve il gioco a
schermo). Il piano non ha ancora un secondo metodo statico per nessun motore,
e non sonda quante stringhe troverebbe ogni metodo: su Unity non sa preferire
le tabelle di localizzazione a XUnity. I rami di `startAutoTranslate` restano
`if` in sequenza: portare un metodo nuovo nel piano richiede ancora un ramo
scritto a mano.

### Il banco di prova del piano sui giochi installati (12/11/2026)

**Il fatto.** Un test `#[ignore]` fa il piano per ogni gioco che Steam dà per
installato e lo confronta con `src-tauri/bench/string-it-plan.tsv`: motore,
da dove lo sappiamo, primo metodo automatico, anti-cheat, tabelle Unity. Se
una riga cambia il test fallisce; un gioco nuovo è segnato `+`, uno non più
installato si salta. È in sola lettura e misura la SCELTA del metodo, non se
poi il metodo riesce.

```bash
cd src-tauri && GS_BENCH_LIBRARIES="C:/Program Files (x86)/Steam/steamapps;E:/SteamLibrary/steamapps;F:/SteamLibrary/steamapps" \
  cargo test --bin gamestringer -- commands::translation_plan::real_bench::real_games_plan_bench --ignored --nocapture --exact
```

`GS_BENCH_WRITE=1` riscrive il file con quello che si vede ora: va usato dopo
aver installato un gioco o aver cambiato la regola di proposito.

**Misura.** 15 giochi installati al 13/11/2026 (erano 8 il giorno prima),
1,1 s in tutto, motore letto dai file in 13 su 15:

| Gioco | Motore | Fonte | Primo metodo automatico |
|---|---|---|---|
| AILA, DREAD FLATS, Fobia, Townfall | Unreal Engine | file | `unreal-locres` |
| Lost Host Demo | Unity | file | `unity-loc-tables` (14 tabelle) |
| art of rally, Mouthwashing | Unity | file | `unity-xunity` |
| Danganronpa Trigger Happy Havoc | Spike Chunsoft | file | `danganronpa-wad` |
| Foolish Mortals | Visionaire Studio | file | `visionaire-vis` |
| Look Outside | Hendrix Localization | file | `hendrix-csv` |
| Scarlet Hollow | Ren'Py | file | `renpy-tl` |
| The Incident at Galley House | Godot | file | `runtime-hook` |
| Resident Evil Requiem | RE Engine | file | `generic-workflow` |
| Gabriel Knight 2, The Dig | Unknown | nessuna | `generic-workflow` |

Su Godot il primo metodo del piano è `godot-pck`, che è una pagina e non parte
da solo: per questo il primo AUTOMATICO risulta l'aggancio a runtime.

**Cosa NON è provato.** Che il metodo scelto riesca: il banco dice solo quale
è. In particolare `generic-workflow` su RE Engine, Gabriel Knight 2 e The Dig.
Senza un gioco installato restano RPG Maker MV/MZ puro, GameMaker, Tyrano e
Wolf RPG.

**Trappole.**

1. **Le cartelle in `steamapps/common` non sono i giochi installati.** La
   prima versione le contava tutte: 45 «giochi», 33 col motore sconosciuto.
   Erano resti di giochi disinstallati (salvataggi, backup `.gs_bak`,
   BepInEx). I giochi veri sono gli `appmanifest_*.acf` con `StateFlags` 4.
2. **`F:/SteamLibrary` non è in `libraryfolders.vdf`** e non ha manifest: solo
   resti. Non conta.

**Nel codice.** `src-tauri/src/commands/translation_plan.rs` — `plan_for`
(il piano per una cartella, usato anche dal comando) e il modulo `real_bench`.

### Il pulsante sui giochi del banco: tre provati, uno scriveva inglese (13/11/2026)

**Il fatto.** String it premuto nella build di sviluppo su tre giochi appena
installati, profilo AI «Gratis», backend cloud. Ogni cartella è stata
fotografata prima (percorso e dimensione di ogni file) e confrontata dopo.

| Gioco | Metodo | Esito |
|---|---|---|
| Foolish Mortals | `visionaire-vis` | interrotto a 2.000/33.221: 540 tradotte, **262 scritte** |
| Look Outside | `hendrix-csv` | «finito» in 10 min: **23.322 righe su 23.532 uguali all'inglese** |
| Mouthwashing (`nl`) | `unity-xunity` | installato; nel gioco 49 testi tradotti dopo 75 s |

**Foolish Mortals.** Scansione ed estrazione riuscite, ~660 stringhe/min
(un'ora per tutto). Backup `data.vis.gs_bak` e checkpoint
`gamestringer_ckpt_it.json` creati; l'annullamento funziona. Dal log di
`visionaire_patcher`: «Patch a parità di offset: 262 applicate, 278 NON entrano
nello spazio dell'originale (tenuto l'inglese)». **Metà delle traduzioni
italiane è più lunga dell'originale e viene scartata**: il gioco esce a
macchia di leopardo. Dopo l'annullamento i passi restano segnati con la spunta
verde, con scritto «interrotta dall'utente».

**Look Outside.** La barra è arrivata al 100% e non è comparso alcun
riepilogo. Nel CSV la colonna `it` conteneva l'inglese: le 142 righe
«diverse» differivano solo per gli spazi ai bordi. Causa: quando tutti i
provider falliscono `translateWithFallback` restituisce i testi sorgente con
`success: false`; `runHendrixTranslation` non guardava `success` e accettava
un testo uguale all'originale, quindi il freno dei tre batch a vuoto non
scattava mai. Danganronpa, RPG Maker e Ren'Py lo scartavano già; Hendrix no.
Corretto: uguale all'originale (a meno degli spazi ai bordi) non è una
traduzione, e senza nemmeno una traduzione il gioco non si tocca. Riprovato:
«Operazione fallita», cartella intatta.

**Mouthwashing.** BepInEx 5 + XUnity 5.6.3.1 installati, `Language=nl`,
`Endpoint=GoogleTranslateV2`. Avviato il gioco: `LogOutput.log` dice «Loaded
XUnity.AutoTranslator into Unity [2022.3.15f1]» e
`_AutoGeneratedTranslations.txt` aveva 49 righe («New Game=Nieuw spel»). Un
solo errore di batch su un testo lungo. La traduzione la fa Google dentro
XUnity, non la catena AI dell'app.

**Cosa NON è provato.** AILA, Danganronpa, Scarlet Hollow e The Incident at
Galley House: i provider gratuiti avevano smesso di rispondere e senza
traduzione la prova non dice nulla. Perché abbiano smesso non è accertato
(limite di richieste è l'ipotesi): gli errori stanno nella console della
webview, che il log di `tauri:dev` non raccoglie. Nessuno dei tre giochi è
stato guardato a schermo.

**Trappole.**

1. **Una barra al 100% non dice che è stato tradotto qualcosa.** L'unica
   prova è confrontare la colonna scritta con l'originale.
2. **«Italiano: già presente» su Look Outside è falso.** Il gioco ha solo le
   colonne `en, fr, sp, cn`. La scansione delle lingue conta i file
   `locales/it.pak` di Chromium che NW.js porta con sé (32 «lingue»).
   Corretto il 13/11: una cartella `locales` che contiene `en-US.pak` è
   l'interfaccia di Chromium (NW.js, Electron, CEF) e la scansione la salta
   (`game_lang_scan.rs`, due test). Non riguardato nell'app.
3. **Su Mouthwashing l'italiano c'è davvero e il pulsante procede lo stesso.**
   Il blocco «il gioco ha già la lingua» copriva solo le tabelle Unity; qui con
   `IT` avrebbe installato XUnity per niente. Corretto il 13/11 **solo nel
   ramo Unity**: ora si ferma anche quando la lingua è fra quelle dichiarate
   dallo store. La scansione dei file non conta, perché è un'euristica e un
   falso positivo fermerebbe il pulsante. Gli altri motori traducono ancora un
   gioco che la lingua ce l'ha. Non riprovato nell'app.
4. **HowLongToBeat dà gli stessi numeri a ogni gioco** (19h / 22h / 26h / 24h
   per Lost Host Demo, Foolish Mortals, Look Outside, Mouthwashing). Non
   corretto.
5. **Il traduttore Hendrix toglie gli spazi iniziali**, che in Look Outside
   servono a centrare i cartelli. Corretto il 13/11: `withOriginalEdges`
   rimette attorno alla traduzione gli spazi ai bordi dell'originale.
6. **Dopo la reinstallazione di un gioco Steam lascia i file che non
   conosce**: backup `.gs_bak`, checkpoint, BepInEx. Una prova pulita parte da
   una cartella senza resti.

**Il motivo del fallimento AI ora si vede (13/11/2026).** Quando nessun
provider traduce, `translateWithFallback` restituiva solo `success: false`: il
perché restava nella console della webview. Ora raccoglie un motivo per ogni
provider della catena (`senza chiave`, `in pausa dopo un errore`, `limite di
richieste`, `testo restituito invariato`, oppure il messaggio d'errore, con le
chiavi censurate) e lo mette in tre posti: nel campo `error` del risultato,
accanto all'errore sotto il pulsante String it, e nel log di Tauri con il
prefisso `[frontend] [AI]` (comando `log_frontend_warning`). Coperto da un
test; **non ancora visto nell'app con provider che falliscono davvero**, quindi
il perché del 13/11 resta da accertare alla prossima prova.

**Visto nell'app lo stesso giorno, su Scarlet Hollow (Ren'Py).** Estrazione
riuscita: 83.530 stringhe da `GameStringer/rpa_src` (199 file `.rpy`). La
traduzione si è fermata dopo tre blocchi a vuoto e il motivo è comparso sotto
il pulsante e nel log. **Con il profilo «Gratis» e backend cloud non c'era un
solo provider utilizzabile:**

| Provider | Motivo |
|---|---|
| groq-gptoss, groq, cerebras, openrouter | senza chiave |
| hymt, translategemma, ollama | cercato su `127.0.0.1:11500`, dove non risponde nessuno |
| lmstudio | non raggiungibile |
| nllb, mymemory | `Failed to fetch` |
| libretranslate | testo restituito invariato |

**Ollama era acceso.** Rispondeva su `127.0.0.1:11434` con cinque modelli
(fra cui `translategemma:12b`, `gemma4:e4b` e `hy-mt1.5`), ma l'app lo cercava
sulla porta 11500 e lo dava per «spento, 0 modelli». Nel codice 11500 non
compare: viene dall'indirizzo Ollama salvato nelle Impostazioni
(`translation.ollamaUrl`), non verificato a schermo. Con l'indirizzo giusto i
tre provider locali sarebbero partiti. Non corretto: è un'impostazione.

MyMemory e NLLB chiamano `fetch` dalla webview, che verso domini esterni
fallisce: nell'app Tauri **non possono funzionare mai**. La traduzione della
chat usa già il giro giusto (`fetch_url_content`, lato Rust); questi due no.
MyMemory corretto il 13/11 (`myMemoryGet`, due test); NLLB no. **Non
riprovato nell'app.** Come abbia fatto la corsa del 12/11 su Lost Host Demo a tradurre
291 testi con lo stesso profilo non è accertato.

Nella cartella del gioco restano `GameStringer/rpa_src/` e
`gs_renpy_progress_it.json` (24 MB, senza traduzioni); nessun file del gioco è
stato modificato e `game/tl/` non è stata creata. Danganronpa, AILA e The
Incident at Galley House non sono stati provati: senza un provider avrebbero
dato lo stesso esito.

Dopo la prova fallita la scheda diceva **«Italiano: già presente»**: la
scansione delle lingue leggeva `it` nel nome del nostro
`gs_renpy_progress_it.json`. Corretto il 13/11: la scansione salta i file e
le cartelle che scriviamo noi (`gs_*`, `gamestringer*`, `*.gsprogress_*`).

**Seconda corsa, con Ollama raggiungibile (13/11/2026).** Nella build di
sviluppo l'indirizzo salvato era ancora `:11500`; svuotato il campo, Ollama è
risultato attivo con 5 modelli. Lotto di prova da 200, backend cloud: la
catena è scesa sui modelli locali, ~1,2 stringhe/s, finita in 3 minuti.
L'app dichiara «136 stringhe scritte nei file del gioco (25% riuscito)» e
«150 errori»; sul disco ci sono `game/tl/it/screens_it.rpy` con **50** coppie
`old`/`new` e `game/gs_language.rpy` (`config.language = "it"`). Perché 136
contro 50 non è accertato. Il gioco non è stato avviato.

**Trappola: `byte as char` nell'estrazione Ren'Py.** `extract_first_quoted`
leggeva la riga byte per byte e spingeva ogni byte come carattere: il pallino
`•` (E2 80 A2) usciva come tre caratteri Latin-1 e nel file `tl` finiva
`C3 A2 C2 80 C2 A2`. Un `old` così non combacia col testo del gioco, quindi
**ogni riga con un carattere non ASCII restava in inglese**, e il modello
riceveva testo sporco (nelle traduzioni compaiono `Â¢` e `Â�•`). I sorgenti
`.rpy` erano UTF-8 validi (199 su 199): il danno nasceva solo lì. Corretto il
13/11 leggendo per caratteri, con un test. Il checkpoint e il file `tl` già
scritti in Scarlet Hollow contenevano gli originali sporchi. **Riprovato lo
stesso giorno a cartella pulita**: 65 coppie in due file (`screens_it.rpy`,
`01virtual_keyboard_it.rpy`), tutti gli `old` compaiono identici nel sorgente,
nessun carattere sporco né negli `old` né nei `new`, i pallini restano
pallini. Il lotto ha impiegato circa 2 minuti. Altri difetti di qualità visti
nel campione: «Duke» tradotto «Il Duca», la persona del verbo che cambia da
una riga all'altra,
vengono tradotti identificatori (`forced_short`, `default_choice`) e i nomi
dei tasti (`Enter` → «Inserisci»).

**Perché è lento: misurato (13/11/2026).** Nell'app ~1,2-1,7 stringhe/s: per
83.530 stringhe la stima era 19 ore. Misure fatte fuori dall'app, contro
Ollama, con 40 stringhe vere di `screens.rpy` (74 caratteri e ~30 token di
uscita in media), RTX 4080 con 8,3 GB di memoria video già occupati da altro:

| Modello | Slot Ollama | Concorrenza 1 | Concorrenza 4 | Concorrenza 8 |
|---|---|---|---|---|
| `hy-mt1.5` 7B | 1 (com'è oggi) | 1,22 str/s | 1,29 | 1,28 |
| `gemma4:e4b` | 1 (com'è oggi) | 1,57 | 1,61 | 1,60 |
| `hy-mt1.5` 7B | 4 | 1,18 | **3,24** | 3,36 |
| `gemma4:e4b` | 4 | 2,42 | **3,65** | 2,80 |

- Il tempo è quasi tutto generazione: ~0,55 s a stringa, più ~0,1 s di prompt.
  Il modo in cui l'app chiama il modello costa poco: Ollama da solo, in
  sequenza, fa 1,9 str/s con lo stesso prompt.
- **Mandare più stringhe in una richiesta non serve**: 30 righe numerate in una
  chiamata impiegano quanto 30 chiamate (i token da generare sono gli stessi).
- **Le richieste parallele non servono se Ollama ha uno slot solo**: si mettono
  in coda. Con `OLLAMA_NUM_PARALLEL=4` lo stesso modello rende 2,7 volte, al
  prezzo di memoria video (hy-mt: 5,3 → 7,0 GB).
- `translategemma:12b` qui fa 19 token/s: non entra nella memoria libera.

Corretto il 13/11: quando è GameStringer ad avviare Ollama lo avvia con 4 slot
(se l'utente non ha già scelto un valore), e `translateWithHYMT` manda 4
richieste alla volta invece di 3. **Riprovato nell'app** con Ollama riavviato
a 4 slot (variabile utente `OLLAMA_NUM_PARALLEL=4`): il lotto da 200 di
Scarlet Hollow è passato da ~120 s a **~87 s** (2,3 str/s). Ollama da solo ne
farebbe ~66: i ~20 s di differenza sono dell'app (pause fra i gruppi, ricerche
prima di ogni lotto), non ancora scomposti. L'avvio da GameStringer con 4 slot
non è stato provato: qui Ollama l'ha avviato la sua icona. Un Ollama già
avviato da altri (l'icona di Ollama all'accesso a Windows) resta a uno slot:
serve la variabile d'ambiente `OLLAMA_NUM_PARALLEL=4` e un riavvio di Ollama.
Anche a 3,2 str/s Scarlet Hollow chiede ~7 ore: per un gioco di quelle
dimensioni la via pratica resta un provider cloud.

**Trappola della misura.** Due istanze di Ollama insieme riempiono la memoria
video (15,2 GB su 16) e i numeri escono senza senso: la prova con più slot va
fatta su un'istanza sola, con i modelli dell'altra scaricati.

Altri due difetti visti: con «Lotto di prova (200)» spuntato il contatore
mostrava 0/83.530, e in alto compare «Errore sconosciuto» mentre il motivo
vero sta nel pannello. Non corretti.

**Nel codice.** `lib/hendrix-translate.ts` — il controllo nel ciclo dei batch
e il blocco prima di applicare. `lib/ai/ai-translate-direct.ts` —
`recordChainFailure` e `getChainFailureSince`.

### Il pulsante sugli altri tre giochi del banco (13/11/2026, pomeriggio)

**Il fatto.** String it premuto nella build di sviluppo, backend cloud senza
chiavi: la catena scende sul modello locale `hy-mt1.5` 7B, Ollama a 4 slot.
Cartelle fotografate prima e confrontate dopo.

| Gioco | Metodo | Esito |
|---|---|---|
| Danganronpa | `danganronpa-wad` | fermato a mano dopo ~1 min: **192 scritte**, WAD ricostruito |
| AILA | `unreal-locres` | finito in 19 min: **3.317 tradotte su 3.518** |
| The Incident at Galley House | `godot-pck` | **il pulsante si ferma subito**, cartella intatta |

**Danganronpa.** 47.999 stringhe da 1.509 file `.lin`, ~3 str/s, stima 4 h
48 min. Lo Stop salva il checkpoint e ricostruisce comunque il WAD con quanto
c'è: «192 scritte · 0 mismatch · 23 tag interni · 7 senza traduzione ·
verifica 4/4». `dr1_data_us.wad` passa da 1.306.210.055 a 1.306.212.357 byte;
restano i backup `dr1_data_us.wad.gsbackup` e
`dr1_data_keyboard_us.wad.gsbackup` e `GameStringer_Translation/`.

**AILA.** 3.518 stringhe da 8 `.locres` dentro il pak (v11, Oodle). Scritta la
tripletta `ProjectAIDA_GameStringer_it_P.pak` + `.utoc` + `.ucas` con
`Game/it/Game.locres` e la cultura `it` aggiunta al `locmeta`; i file del
gioco non sono toccati. 201 stringhe sono uguali all'originale, a campione
legittime (nomi, «No»). L'app dichiara «3321 scritte (94% riuscito)». Un
solo lotto è rimasto senza traduzione, col motivo nel log. Su Unreal il
pannello non mostra un contatore, solo una barra.

**The Incident at Galley House.** «Godot non ha una pipeline automatica in
String it!: usa il Godot Translator dedicato». Il piano elenca dopo
l'aggancio a runtime e l'OCR, ma il pulsante non ci scende: su Godot String it
oggi non fa nulla.

**Cosa NON è provato.** Nessuno dei giochi è stato avviato: che il WAD
ricostruito e la tripletta Unreal si carichino e mostrino l'italiano non è
verificato. La corsa completa di Danganronpa non è stata fatta.

**Trappole.**

1. **`translategemma` risponde 404**: è installato come `translategemma:12b`,
   ma la catena lo chiama con un nome che Ollama non trova. Non corretto.
2. **La ricerca in Libreria con i punti non trova il gioco**: «A.I.L.A» dà 20
   risultati senza AILA in cima, «AILA» lo trova. Non corretto.
3. **MyMemory ora raggiunge il server dall'app** (risponde, anche se col testo
   invariato): la correzione del mattino è confermata.

### AILA avviato: la tripletta si carica, ma i `.locres` non sono tutto il testo (13/11/2026)

**Il fatto.** AILA avviato da Steam (`steam://rungameid/2695430`) con la
tripletta `ProjectAIDA_GameStringer_it_P.*` nella cartella `Paks`. È la prima
volta che una patch scritta dal pulsante viene guardata dentro il gioco.

**Cosa si vede.**

- Menu principale in italiano: «GIOCO NUOVO», «OPZIONI», «ESCI», «Regola le
  opzioni di gioco.», «Naviga», «Conferma». Sono le nostre stringhe: stanno
  identiche in `GameStringer/translation_session.json`.
- In Opzioni la voce TESTI è su **ENGLISH** e il gioco mostra l'italiano: la
  patch copre i testi inglesi, non aggiunge una decima lingua da scegliere.
- In partita l'intestazione «OBIETTIVI» è italiana, l'obiettivo sotto resta
  **«Go to the dinner»** (visto dal proprietario giocando).

**Perché l'obiettivo resta inglese.** La frase non è in nessuno degli 8
`.locres`: 0 occorrenze nella sessione delle 3.518 stringhe. Decomprimendo
tutti i 601.660 blocchi di `ProjectAIDA-Windows.ucas` (17,5 GB) compare **una
volta sola**, nell'asset `Content/Blueprints/AP/Trash/UI_PercentMission.uasset`
(chunk `823cb2deef3dcc1e00000001`). Lì è un `FText` **senza chiave**: flag `2`
(`CultureInvariant`), storia `-1`, poi la stringa. Un testo invariante non ha
namespace né chiave, quindi **nessuna voce di `.locres` può tradurlo**:
l'ipotesi «basta aggiungere la chiave» era sbagliata.

**Il metodo che funziona: sostituire l'asset.** Provato su questa sola frase.

```bash
# retoc vuole solo i contenitori del gioco: con la nostra tripletta nella
# stessa cartella rifiuta («different header versions»). Servono copie o
# collegamenti fisici di ProjectAIDA-Windows.utoc/.ucas e global.utoc/.ucas.
retoc to-legacy -f UI_PercentMission --no-shaders <cartella-collegamenti> legacy
# nel .uexp: «Go to the dinner» -> «Vai alla cena   » (stessa lunghezza)
retoc to-zen --version UE5_5 legacy ProjectAIDA_GameStringer_assets_P.utoc
```

La tripletta `ProjectAIDA_GameStringer_assets_P.pak/.utoc/.ucas` (347 + 483 +
31.599 byte) copiata in `Paks`: il gioco parte, carica il salvataggio e
l'inventario (TAB) mostra **«Vai alla cena»** sotto «OBIETTIVI».

**Cosa NON è provato.**

- Una traduzione di **lunghezza diversa**: qui la frase è stata riempita di
  spazi per non spostare nessun offset. Con lunghezze libere vanno riscritte le
  dimensioni dentro l'asset.
- Che il metodo regga su altri asset e altri giochi: un asset, un gioco.

**Quanti sono (misura sull'intero archivio).** Decompressi i 38.850 chunk
`ExportBundleData` e cercata la forma di «Go to the dinner» (flag u32, storia
`-1`, bool `1`, FString):

| | |
|---|---|
| occorrenze | 2.222 in 269 asset |
| testi distinti | 518 |
| distinti con almeno due lettere | 444 |
| distinti con uno spazio (frasi) | 234, per 806 occorrenze |
| di queste frasi, già presenti come testo nei `.locres` | 17 |

Contro le 3.518 stringhe dei `.locres` il tetto è quindi **234 frasi (6,7%)**,
444 contando le parole singole (12,6%). È un tetto, non il numero dei testi che
il giocatore vede: dentro ci sono etichette di lavoro degli sviluppatori
(«Lock» 332 volte, «Unlock» 286, «Disable Player Input» 237, soprattutto in
`Content/Map/Experiences`), appunti in portoghese, segnaposto dei widget
(«File name.txt») e testi veri («Kill 10 enemies silently», «Main Menu»,
«Initializing A.I.L.A. System...»). **La forma del dato non distingue un
testo a schermo da un'etichetta di lavoro.**

Limite della misura: conta una sola forma di serializzazione. Testi salvati
come stringhe semplici (`FString`) o in tabelle dati non sono contati.

**Trappole.**

1. **«Tradotto al 94%» è il 94% dei `.locres`, non del gioco.** Il riepilogo
   non sa dei testi rimasti negli asset.
2. **La nostra tripletta `_it_P` ha un'intestazione più nuova del gioco**
   (`SoftPackageReferencesOffset`, scritta come UE5_7; il gioco è
   `SoftPackageReferences`, cioè UE5_5). Il gioco la carica lo stesso perché è
   vuota, ma `retoc` si rifiuta di leggere le due insieme. Per un contenitore
   con asset veri la versione va presa dal gioco, non fissata.
3. **Errori del modello passati senza controllo**, visti a schermo:
   «LINGUAGUE» per Language, «MAUS/TASTIERA» per Mouse/Keyboard, «CAMMINA
   DRITTO» sul tasto D (era «muovi a destra»).

### Scarlet Hollow e Danganronpa avviati (13/11/2026)

**Il fatto.** I due giochi avviati da Steam con i file scritti dal pulsante al
mattino, guardati a schermo.

| Gioco | Si avvia? | Italiano a schermo? |
|---|---|---|
| Scarlet Hollow (Ren'Py) | sì, `log.txt` senza traceback | sì, dove il lotto di prova è arrivato |
| Danganronpa (WAD ricostruito) | sì | sì, con due difetti |

**Scarlet Hollow.** Le due schermate nere iniziali restano inglesi (non erano
nel lotto). Menu principale tutto italiano: «Prosegui», «Inizia», «Carica»,
«Preferenze», «Accessibilità», «Controlli», «Fine». Nelle Preferenze sono
italiane solo «Finestra» e «Modalità a schermo intero»; il resto è inglese,
coerente con le 128 coppie scritte. `config.language = "it"` di
`gs_language.rpy` basta: nessun menu lingua da toccare.

**Danganronpa.** Nuova partita, lingua English: dopo il filmato il prologo
(`e00_001_000.lin`) esce in italiano, sette righe guardate. Apostrofo tipografico
e puntini di sospensione si vedono corretti.

**Trappole.**

1. **Il font di Danganronpa ha solo «à» e «é» fra le accentate italiane**:
   «E lì,» esce come «E l≡,». Letto dal font stesso, non dedotto dallo schermo.
   Sta in `Dr1/data/us/font/font.pak` dentro `dr1_data_us.wad`: un PAK di 4
   voci, due immagini dei glifi e due tabelle `tFpS`. Nella tabella: `u32`
   numero glifi a +8, `u32` inizio dati a +12, `u32` codice massimo a +16, poi
   **da +32** un `u16` per ogni codice Unicode (`0xFFFF` = glifo assente).
   Leggere da +28 sposta tutto di due codici: è l'errore fatto al primo colpo.

   | Font | Glifi | Latin-1 | Punteggiatura tipografica |
   |---|---|---|---|
   | voce 1 (dialoghi) | 323 | × à é ó | — ― ’ “ ” • … ※ |
   | voce 3 | 179 | nessuna | — … ※ |

   Controprova: ogni carattere dei 47.999 testi inglesi originali risulta
   presente nella voce 1. Mancano invece **è (47 volte), ì (30), È (21),
   ò (18), ù (9)**: **96 righe tradotte su 215 (45%)** hanno almeno un
   carattere senza glifo. Il rebuild dichiara «0 mismatch · verifica 4/4» e
   non controlla i glifi. A schermo è stata vista rotta solo la «ì».

   **Corretto nel rebuild** (`gs_font_safe` in `danganronpa_patcher.rs`): prima
   dell'a-capo automatico il rebuild legge la tabella del font dal WAD stesso e
   sostituisce ogni carattere senza glifo con un ripiego che il font ha
   («è» → «e'», «È» → «E'», «…» → «...»). «à» ed «é» restano, perché ci sono.
   Se il WAD non ha il font, o il ripiego non è nel font, il testo resta
   com'è. Provato con i test su una tabella sintetica e **rivisto a schermo
   il 15/11**: WAD ricostruito dal backup (192 scritte, +234 byte rispetto al
   rebuild del 13/11), nuova partita, la riga che usciva «E l≡,» ora è
   «E li', in piedi all’ingresso…»; «già» nella riga prima tiene la «à».
   Guardate nove righe del prologo; le righe con «è», «È», «ò», «ù» non sono
   capitate a schermo.

   Per rifare il solo rebuild senza passare dal pulsante (che farebbe
   ripartire la traduzione): un esempio Cargo di poche righe che chiama
   `rebuild_danganronpa_wad(cartella)` dentro
   `tauri::async_runtime::block_on`. Riparte sempre dal `.gsbackup`.
2. **Le righe con parole colorate restavano inglesi.** La riga 6 del prologo
   aveva la traduzione nella sessione ma nel gioco era inglese: era una delle
   «tag interni» che il rebuild saltava. Non sono poche: contando le forme dei
   tag nei 1.871 `.lin` del gioco, 15.978 righe hanno un solo colore attorno
   a tutto il testo (`#T#`, già gestite) e **circa 3.200 hanno tag nel
   mezzo** (1.742 `T#T#T`, 948 `#T##T##T#`, più varianti). I tag sono sempre
   a coppie: `<CLT n>` apre, `<CLT>` chiude.

   **Corretto nel rebuild** (`gs_rewrite_inner_clt`): la riga si scrive
   sempre. La traduzione prende il colore di base; una parola evidenziata
   tiene il colore solo se compare identica nella traduzione, come parola
   intera (in pratica i nomi propri), altrimenti lo perde. Sul gioco: 215
   scritte invece di 192, **6 evidenziazioni tenute e 24 perse** nelle 23
   righe. Rivisto a schermo il 15/11: la riga 6 è italiana, il nome
   dell'accademia resta giallo, «speranza» è senza colore.

   Strada sbagliata da non rifare: scegliere il colore di base come «quello
   che copre più testo». Se la parola evidenziata è più lunga del resto della
   frase, tutta la riga prende il colore dell'evidenziazione. Il colore di
   base è quello con cui la riga comincia e finisce; il conteggio serve solo
   se i due non coincidono.

   Non provato: se nei dibattiti in classe un colore ha un ruolo nel gioco e
   non solo di enfasi. Le quattro file tradotte sono tutte di dialogo.
3. **In Scarlet Hollow una voce lunga esce dal riquadro**: «Informazioni
   generali sul gioco» (era «About») si sovrappone al pannello delle
   Preferenze.
4. **Nel lotto di Scarlet Hollow sono stati tradotti nomi interni** («who» →
   «chi», «default_choice» → «opzione_predefinita»). Il gioco parte lo stesso,
   ma sono identificatori, non testo.
5. **Per chi guida il gioco da fuori:** in Danganronpa il testo avanza col
   pulsante sinistro del mouse, e i clic sintetici non arrivano; Ctrl («salta
   testo») sì. Non scambiare un dialogo fermo per un blocco della patch. I
   tocchi brevi dei tasti spesso non vengono letti: servono pressioni tenute
   (0,2 s nei menu; 0,1 s di Ctrl avanza una riga, 0,2 s ne salta due).
6. **Le traduzioni lunghe escono dal riquadro.** Il riquadro del dialogo
   mostra tre righe da 40 caratteri; l'a-capo automatico ne produce una
   quarta quando l'italiano è più lungo, e quella si vede tagliata sul bordo
   (viste due righe così nel prologo). Non corretto.

**Cosa NON è provato.** Oltre il prologo di Danganronpa e oltre il menu di
Scarlet Hollow non è stato guardato niente; nessun dialogo di Scarlet Hollow è
tradotto, quindi lì i dialoghi a schermo non sono verificati.

## Come si aggiunge una voce

Quando trovi un modo nuovo di estrarre o reiniettare testo, o capisci perché un
gioco resiste:

1. Aggiungi la voce qui sotto l'engine giusto, col formato sopra.
2. Se la scoperta è lunga, falle un documento suo e lascia qui il riassunto.
3. Se la scoperta nasce da una misura, **scrivi i numeri**, non «funziona» o «è
   lento». I numeri sopravvivono, le impressioni no.
4. Se hai sbagliato strada prima di trovarla, scrivi anche quella: la trappola
   evitata vale quanto il metodo trovato.
