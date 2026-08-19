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

## Come si aggiunge una voce

Quando trovi un modo nuovo di estrarre o reiniettare testo, o capisci perché un
gioco resiste:

1. Aggiungi la voce qui sotto l'engine giusto, col formato sopra.
2. Se la scoperta è lunga, falle un documento suo e lascia qui il riassunto.
3. Se la scoperta nasce da una misura, **scrivi i numeri**, non «funziona» o «è
   lento». I numeri sopravvivono, le impressioni no.
4. Se hai sbagliato strada prima di trovarla, scrivi anche quella: la trappola
   evitata vale quanto il metodo trovato.
