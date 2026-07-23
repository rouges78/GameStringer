# .samples — file reali per il collaudo dei parser (MAI committare)

Questa cartella è **gitignorata**: contiene file estratti dai TUOI giochi
installati, usati solo in locale per validare i parser binari su dati veri
(prerequisito di ADR-002 e ADR-003 — "corpus di test reale").

## Cosa copiare qui

Da giochi che possiedi, bastano questi file (copia, non spostare):

### Unity IL2CPP (per l'estrazione string literal — ADR-003)
- `<Gioco>_Data/il2cpp_data/Metadata/global-metadata.dat`
  (tipicamente 10–40 MB; se hai più giochi IL2CPP copiane più d'uno in
  sottocartelle, es. `.samples/gioco1/global-metadata.dat`)

### Unity (per l'estrazione TextAsset — unity_serialized.rs)
- `<Gioco>_Data/resources.assets` (o il più piccolo dei `sharedassets*.assets`)

### UE5 IoStore (per il read/write path — ADR-002)
- un file `.utoc` PICCOLO dalla cartella `Paks` del gioco
  (es. `pakchunk0-optional-Windows.utoc`, di solito KB–MB;
  il `.ucas` gemello NON serve per la validazione dell'header/TOC)

### GameMaker (per il rebuilder data.win — roadmap "da parziale a pieno")
- il `data.win` di un gioco GameMaker installato (es. Undertale, Deltarune…)
  L'harness fa un censimento dei puntatori alle stringhe: il risultato dice
  se la rilocazione generica è sicura o se serve il parsing per-chunk.

### Unreal classico (per il font _P.pak — ADR-001 prerequisito 1)
- un `.pak` dalla cartella `Paks` di un gioco UE4/UE5 (anche grande: viene
  letto solo l'indice in coda al file). L'harness ne decodifica l'indice
  (classico v1-v9 o PathHash/FullDirectory v10-v11, che il reader Rust oggi
  rifiuta) ed elenca i CANDIDATI FONT (.ufont / Font*.uasset) — il bersaglio
  esatto dell'opzione B (byte-swap) dell'ADR-001.

## Come lanciare la validazione

```
python3 scripts/validation/validate_real_samples.py
```

Output: PASS/WARN/FAIL per ogni file con i numeri letti. Un PASS sul layout
string-literal di `global-metadata.dat` sblocca il port Rust dell'estrazione
(ADR-003 punto 1); un PASS sull'header `.utoc` conferma il parser IoStore
sulla versione UE del tuo gioco.

## Nota legale

I file restano sul tuo computer e non vanno mai committati né condivisi:
sono contenuti dei giochi, coperti da copyright (vedi docs/ANTI_PIRACY.md).
