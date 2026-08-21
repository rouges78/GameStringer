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

## Traduzione in tempo reale (IPC)

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
| pipe `GameStringerTranslator` | **nessun server** | reale, `unreal-translator/hook-dll/src/ipc.cpp` |
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
`GameStringerUETranslator`; a gs-hook manca un server e in Rust non esiste
nemmeno una costante per `GameStringerTranslator`. **Rinominare l'una nell'altra
scollegherebbe la DLL Unity**, che è un binario precompilato nel repo: il nome
va cambiato nell'header C++ e la DLL ricompilata, non solo in Rust.

**La trappola.** Due nomi che differiscono di due lettere sembrano un refuso da
sistemare. Prima di allinearli, leggi cosa c'è dentro i binari: qui erano due
canali sani, e l'unico difetto vero era il server che manca a entrambi.

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
