# ADR-004 — Rebuilder `data.win` GameMaker (crescita delle stringhe)

**Stato:** design a confronto · implementazione **gated su un `data.win` reale** · **Data:** 25/07/2026

## Problema

`patch_data_win` chiama sempre `rebuild_same_size`: la traduzione viene scritta
nello spazio byte dell'originale. Se è più lunga, **viene tagliata**. Dal 22/07
i tagli sono *reportati* onestamente (`GmTruncatedString` + pannello ambra in
`gamemaker-translator.tsx`), ma non risolti — ed è l'unico punto dell'app in cui
segnaliamo un problema che non sappiamo riparare.

Le lingue di destinazione peggiorano il caso: IT/FR/ES/DE sono tipicamente
15–30% più lunghe dell'inglese, quindi il taglio non è un caso limite ma la
norma su frasi lunghe.

## Formato (come lo legge il codice oggi)

`data.win` è un contenitore IFF-like (cfr. `parse_chunks`, `extract_strings`):

```
FORM | size
  CHUNK(4B nome) | size(u32) | dati…      ← chunk contigui, nessun allineamento
  …
  STRG | size
     count(u32)
     count × u32  → puntatore ASSOLUTO (offset da inizio file) alla entry
     entry: len(u32) + char data + NUL     ← i puntatori esterni puntano a entry+4
```

Il punto critico: **gli altri chunk (CODE, VARI, FUNC, OBJT, ROOM…) referenziano
le stringhe con `u32` assoluti che puntano ai *char data* (`entry+4`)**. Far
crescere una stringa sposta i dati successivi → ogni puntatore a valle diventa
sbagliato. È il motivo per cui `rebuild_same_size` esiste.

## Le tre opzioni

### A — Rilocazione generica dei puntatori

Ricostruisci STRG con le nuove dimensioni, calcola per ogni vecchio offset il
delta, poi **riscrivi ogni sito `u32` del file** che conteneva un offset noto.

- **Pro:** implementazione compatta, indipendente dalla conoscenza dei singoli chunk.
- **Contro:** si basa su un'euristica — un `u32` che *sembra* un offset potrebbe
  essere una costante numerica nel bytecode CODE. Un solo falso positivo
  riscritto = gioco che non parte.
- **Ammissibile solo se** il censimento su file reali dà falsi positivi
  ~0 (vedi criteri sotto).

### B — Parsing per-chunk (stile UndertaleModTool)

Parsa la struttura nota di ogni chunk e riscrivi **solo i campi che sono
davvero puntatori**.

- **Pro:** corretto per costruzione, nessuna euristica.
- **Contro:** costo alto e ricorrente — va implementato per ogni tipo di chunk e
  per ogni generazione di formato (GMS1 / GMS2 / 2.3+ hanno layout diversi).
  È di fatto riscrivere UndertaleModTool.

### C — Append-only fuori dai chunk esistenti (blast radius minimo)

Non spostare **nulla** di ciò che esiste. Per le sole stringhe che crescono,
scrivi i nuovi char data **in coda al file** (dopo l'ultimo chunk, aggiornando
solo `FORM.size`), poi aggiorna:

1. la entry nella tabella STRG di quella stringa;
2. i siti puntatore esterni **di quella specifica stringa**.

- **Pro:** tutti gli offset esistenti restano validi → nessuna cascata di delta.
  L'errore è **contenuto**: si tocca solo ciò che riguarda le stringhe cambiate,
  tipicamente poche decine su decine di migliaia. Le stringhe non tradotte
  restano byte-identiche.
- **Contro:** dipende dal fatto che il runtime GameMaker risolva i puntatori come
  **offset assoluti nel file caricato in memoria**, senza validare che cadano
  dentro STRG. **Da verificare su un gioco reale** — è l'unica incognita, ma è
  un'incognita binaria e testabile (il gioco parte o no).
- Richiede comunque il censimento per trovare i siti puntatore, ma con una
  soglia di rischio molto più bassa di A: un falso positivo qui riguarda una
  singola stringa, non l'intero file.

## Criteri di decisione (già implementati nell'harness)

`scripts/validation/validate_real_samples.py` misura su un `data.win` vero:

- `ref_ratio` = quante stringhe risultano referenziate da almeno un `u32` diretto;
- `fp_rate` = quanti indirizzi-**esca** (`entry+5`, mai referenziabili
  legittimamente) risultano "colpiti" → stima dei falsi positivi.

| Esito censimento | Design scelto |
|---|---|
| `ref_ratio > 0.6` **e** `fp_rate < 1%` | **C** in prima battuta (più sicuro a parità di dato); **A** accettabile se serve semplicità |
| `ref_ratio > 0.3` | **C**, mai A — il segnale non basta per una riscrittura globale |
| `ref_ratio ≤ 0.3` | **B**: le stringhe non sono referenziate con puntatori diretti, l'euristica non regge |

In tutti i casi il rebuilder deve produrre un **backup `.backup`** e ri-parsare
il file prodotto prima di considerarlo valido (stesso schema di
`rewrite_unity_text_assets`).

## Decisione

**Non implementare il rebuilder finché il censimento non gira su almeno un
`data.win` reale.** Stesso principio di ADR-001/002/003: nessun parser binario
*che scrive* basato su un layout supposto. La preferenza di design, a parità di
dato favorevole, è **C** — perché è l'unica che lascia intatto tutto ciò che non
traduciamo, e un suo fallimento è diagnosticabile (il gioco non parte) invece
che silenzioso (stringhe casualmente corrotte a run-time).

Fino ad allora resta `rebuild_same_size` **con il report dei tagli**, che è
onesto: l'utente sa esattamente quali righe sono state accorciate e di quanti byte.

## Stato dei campioni (25/07/2026)

Nessun `data.win` disponibile: la libreria contiene Core Keeper (Unity Mono),
Mouthwashing (Unity Mono) e Hotline Miami — che è GameMaker **8.x**, con i dati
incorporati nell'`.exe`, non in un `data.win` (per HM vale il percorso
`patch_exe` già esistente).

Vie gratuite per ottenere un campione: un gioco GameMaker gratuito da itch.io,
oppure un progetto di test esportato con GameMaker (gratuito per uso non
commerciale) — quest'ultimo permette di **controllare le stringhe di partenza**,
utile per validare la crescita con lunghezze note.

## Conseguenze

- La voce roadmap "GameMaker da parziale a pieno" resta aperta con design e
  criteri espliciti: quando arriva il campione, l'implementazione è meccanica.
- Nessun rischio nuovo per l'utente nel frattempo.
- Se il censimento dovesse dare `ref_ratio ≤ 0.3`, va messo in conto che il
  rebuilder è un progetto di dimensioni proprie (opzione B) e va ripianificato,
  non incastrato in una sessione.
