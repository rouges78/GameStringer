# ADR-003 — Profondità Unity IL2CPP

**Stato:** rilevamento e gate rafforzati · **estrazione string literal FATTA (read-only)** · scrittura/patch rimandata (serve gioco reale) · **Data:** 23/07/2026 · **agg.** 25/07/2026
**Contesto:** voce roadmap P2 "Unity IL2CPP di profondità + versioni recenti".

## Problema

Unity ha due backend di scripting:

- **Mono**: il C# resta in assembly .NET (`Assembly-CSharp.dll`) modificabili.
  BepInEx 5.x + XUnity.AutoTranslator funzionano bene.
- **IL2CPP**: il C# è compilato in C++ nativo dentro `GameAssembly.dll`, con i
  metadati (nomi, string literal) in `il2cpp_data/Metadata/global-metadata.dat`.
  Il testo hardcoded **non** vive in un assembly .NET.

Tradurre giochi IL2CPP è molto più difficile: o si aggancia un hook runtime
(BepInEx 6 IL2CPP + XUnity IL2CPP), oppure si estraggono/riscrivono le stringhe
dal binario + metadata, oppure — ciò che GameStringer fa già — si traducono solo
gli **asset serializzati** (TextAsset, CSV SimpleLocalization) che sono comuni a
Mono e IL2CPP.

## Stato reale del codice (verificato)

- **Rilevamento IL2CPP** era solo `GameAssembly.dll` esiste? — un singolo check
  di presenza file, nessuna lettura del metadata.
- **Traduzione IL2CPP effettiva** = percorso asset (Unity CSV + `unity_serialized`
  TextAsset v16–22 + `unity_inject.py`). Cattura solo il testo che vive negli
  asset in formati noti; **non** tocca `global-metadata.dat`.
- **BepInEx 6 IL2CPP** esiste nel backend (`install_il2cpp_patch`) ma la UI lo
  scoraggia (instrada al CSV) — scelta prudente, tenuta.
- **Nessun parser di `global-metadata.dat`.**
- **Gate Unity 6**: `install_il2cpp_patch` rifiutava se la stringa Unity iniziava
  con `6000`/`6.` — un blocco grezzo sulla versione *Unity*, non su quella dei
  *metadata* (che è ciò che conta per BepInEx).

## Cosa è stato fatto ora (23/07)

Interventi **read-only, a basso rischio, testabili con fixture sintetiche**:

1. **Reader header `global-metadata.dat`** (`il2cpp_metadata.rs`): legge magic
   `0xFAB11BAF` + campo `version` (major: 24/27/29/31…). Non estrae né riscrive
   stringhe — legge solo 8 byte. Trova il file sotto `*_Data/il2cpp_data/Metadata`.
2. **Gate version-aware**: `install_il2cpp_patch` ora rifiuta in base alla
   **versione di metadata** (`MAX_SUPPORTED_METADATA_VERSION = 29`, cioè fino a
   Unity 2022; v31/Unity 6 oltre) e riporta la versione **reale**, non più uno
   `starts_with("6000")`. Il vecchio guard sulla stringa Unity resta solo come
   rete di sicurezza quando il metadata non è leggibile.
3. **Rilevamento IL2CPP più robusto**: `check_game_engine` conferma IL2CPP con
   `GameAssembly.dll` **o** un `global-metadata.dat` valido, e produce un
   messaggio onesto (se il metadata è oltre la soglia, indirizza al percorso
   asset invece di promettere l'hook).
4. **Comando `get_il2cpp_metadata_version`** per esporre versione + verdetto
   BepInEx al frontend.
5. **Test sintetici**: magic valido/errato, buffer corto, endianness su disco
   (AF 1B B1 FA), soglia che scarta v31, rilevamento da cartella `_Data`.

## Cosa è stato fatto ora (25/07) — blocco 1: estrazione read-only

`il2cpp_metadata.rs` legge ora la **StringLiteral table** e ne estrae il testo,
senza mai scrivere sul binario:

1. **`extract_string_literals(bytes)`**: parsa i campi header (offset 8/12/16/20
   → `string_literal_offset`/`_count`/`_data_offset`/`_data_count`), itera le
   entry `Il2CppStringLiteral` (8 byte: `length` + `data_index`) e decodifica le
   stringhe UTF-8 dal blob dati. Layout stabile su tutte le versioni 24..=31
   (sono i primi campi dell'header, non si spostano — cfr. Il2CppDumper).
2. **Robustezza**: ogni offset è bounds-checked; entry incoerenti (data_index
   fuori dal blob, `count` non multiplo di 8) vengono **saltate**, mai un panico
   o una lettura fuori range. Errore globale solo se magic errato o header che
   punta fuori dal file.
3. **Comando `get_il2cpp_string_literals`** (path + versione + totale + entry),
   con `only_translatable` (euristica prudente: scarta namespace/path/identificatori)
   e `limit` per la UI. Registrato in `main.rs`.
4. **Test sintetici** (10): ordine/indici, UTF-8 multibyte, euristica
   translatable, magic errato, offset fuori file, entry corrotta saltata,
   `table_size` non multiplo di 8, tabella vuota. Logica byte-level verificata
   anche con reimplementazione Python di controllo (14/14 casi verdi).

Nota: `string_literal_count` nell'header è la **dimensione in byte** della
tabella, non il numero di entry (numero entry = count / 8) — punto classico di
errore, coperto dai test.

## Cosa manca per "profondità" (rimandato, con piano)

In ordine di valore/rischio:

1. ~~**Estrazione degli string literal da `global-metadata.dat`**~~ → **FATTO
   25/07** (vedi sopra). Resta l'integrazione nella pipeline di traduzione
   (mostrare/esportare le literal estratte accanto al testo degli asset).
2. **Scrittura/patch degli string literal** con gestione della crescita (le
   stringhe UTF-8 possono allungarsi → offset da rilocare), oppure override via
   file di traduzione runtime.
3. **Sotto-versioni metadata** (24.1/24.2/…): l'header dà solo il major; le
   sotto-versioni si deducono euristicamente (dimensioni struct) come fa
   Il2CppDumper. Serve per un parsing preciso della StringLiteral table.
4. **Hook nativo IL2CPP** (`gs-hook/source_unity_il2cpp.cpp`, oggi TODO) via
   `il2cpp_*` exports / Il2CppInterop, per non dipendere solo da BepInEx esterno.
5. **Write-path asset oltre SerializedFile v22** (`unity_inject.py` è vincolato
   a v22; il read-path Rust copre v16–22).
6. **Corpus di test reale** con un `global-metadata.dat` di gioco (i test sono
   sintetici; nessuna fixture reale).

## Decisione

**L'estrazione (read-only) è sicura e la implementiamo**: legge solo, è testabile
con fixture sintetiche e non può danneggiare i file dell'utente. **La
scrittura/patch resta gated su un gioco IL2CPP reale** per il collaudo, stesso
principio di ADR-001/002: mai un parser binario che *scrive* in modo "plausibile
ma sbagliato" che l'utente non può verificare. Nel frattempo il percorso di
traduzione IL2CPP resta l'**iniezione asset (Unity CSV)**, ora scelto in modo
**informato** (versione metadata nota) e affiancabile all'elenco delle string
literal estratte.

## Conseguenze

- Il rifiuto Unity 6 è **onesto e preciso** (versione metadata reale), non un
  euristica sulla stringa Unity; se BepInEx pubblicherà una pre-release che
  aggancia v31, basterà alzare `MAX_SUPPORTED_METADATA_VERSION`.
- La voce roadmap resta aperta con blocchi e ordine espliciti.
- Nessun rischio nuovo per l'utente: tutto ciò che tocca il binario è read-only
  (8 byte di header); niente scrittura su `GameAssembly.dll`/`global-metadata.dat`.
