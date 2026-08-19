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

### UE5 IoStore: i `.locres` stanno nel `.pak`, non nel container

**Il fatto.** Nei giochi UE5 che usano IoStore, i `.locres` non sono dentro
`.utoc`/`.ucas`: stanno nel `.pak` legacy affiancato. I `.locres` non sono asset,
quindi non passano dalla conversione in Zen e restano file normali nel pak.

**Misura.** The Skin Stapler, 19/08/2026: container da 674 MB con 12601 chunk e
zero `.locres`; pak affiancato da 638 MB con 1662 file e 4 `.locres`, di cui
`TheSkinStapler/Content/Localization/Game/en/Game.locres` con **1007 stringhe,
51.938 caratteri**. L'app dichiarava «non espone testi estraibili».

```bash
repak.exe list "<gioco>/Content/Paks/<Nome>-Windows.pak" | grep locres
```

**Nel codice.** `unreal_iostore.rs::extract_locres_from_pak()` sa già leggerli, ma
è chiamato solo da `count_pak_translated_entries()` — cioè sul pak della patch GS
già applicata, mai sul pak originale del gioco.

**Trappola.** `retoc list` su questi container stampa chunk ID
(`ExportBundleData`, `BulkData`, `ShaderCode`) e nessun nome di file, perché
l'indice directory non porta i nomi. Concludere «nessun `.locres`» da lì è un
errore: non è prova d'assenza, è assenza di prova. Serve `repak list` sul pak.

Dettaglio completo: [UNREAL-DOVE-STANNO-I-LOCRES.md](UNREAL-DOVE-STANNO-I-LOCRES.md).

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
