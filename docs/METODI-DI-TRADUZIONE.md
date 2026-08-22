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
- La cattura GDI **si attiva** su RPG_RT (Yume Nikki): entrambe le sorgenti di
  livello 2 si installano. Non ha però ancora **catturato** una riga: serve
  portare il gioco fino a un dialogo. I giochi UE non la esercitano affatto,
  perché disegnano via Slate/Direct3D — vedi la voce dedicata.


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
trattato come fallimento.

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
