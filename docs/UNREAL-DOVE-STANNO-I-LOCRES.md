# Unreal: perché un gioco con 1679 stringhe risultava «senza testo»

Misurato il 19/08/2026 su **The Skin Stapler** (Steam, UE5 IoStore), partendo da
un caso in cui l'app dichiarava «questo gioco non espone testi estraibili».
**Era falso.** Dopo la correzione l'estrazione ne restituisce **1679**.

## La causa: profondità di annidamento assunta, non cercata

`find_utoc_files` e `find_pak_files` in `unreal_iostore.rs` guardavano
esattamente **un** livello di sottocartella:

```
<gioco>/<sottocartella>/Content/Paks
```

The Skin Stapler ne ha **due**:

```
<install>/TheSkinStapler/TheSkinStapler/Content/Paks/
```

Quindi i finder tornavano vuoti, `extract_iostore_localization` usciva subito con
«Nessun file .utoc trovato», il frontend faceva `.catch(() => null)` e l'utente
leggeva «non espone testi estraibili». Il testo non è mai stato nascosto: non
siamo mai arrivati alla cartella.

**La contraddizione a schermo aveva la stessa radice.** `find_paks_dir` in
`unreal_localization.rs` cercava invece **ricorsivamente fino a 5 livelli** e la
cartella la trovava. Da lì `has_locres` risultava vero e il pulsante STRING IT!
annunciava «.locres trovati — traduzione AI disponibile», mentre l'esecutore,
che passava dagli altri due finder, negava. Tre funzioni per la stessa domanda,
due profondità diverse, in due file diversi.

## La correzione

`find_all_paks_dirs()` (in `unreal_localization.rs`) è ora l'unico modo di
trovare le cartelle `Paks`, ricorsivo fino a 5 livelli e con verifica che la
cartella contenga davvero `.pak`/`.utoc`. `find_paks_dir` ci si appoggia,
`find_utoc_files` e `find_pak_files` pure, tramite `files_in_paks_dirs()`.

Regola generale: **la profondità di annidamento va cercata, mai assunta.** Gli
autori impacchettano come vogliono, e un livello in più non è un caso limite.

## Cosa NON era il problema

Tre ipotesi verificate e scartate, per non farle rifare a nessuno:

1. **«Manca il codice che legge i `.pak`.»** Falso: `extract_iostore_localization`
   ha già un fallback che scandaglia i pak classici, filtra Engine e plugin,
   preferisce la cartella `/en/` e aggrega. Funziona. Semplicemente non veniva
   mai raggiunto, per via del return anticipato sui .utoc.
2. **«La DLL Oodle non viene cercata nella cartella del gioco.»** Vero come
   difetto (vedi la nota aperta nel registro), ma irrilevante qui: il gioco non
   spedisce Oodle, e la DLL era già nella cache tool di GameStringer.
3. **«I `.locres` non stanno mai nel container IoStore.»** Falso. Su The Skin
   Stapler stanno nel `.pak`, ma sul gioco di collaudo del 02/08/2026 stavano nel
   container (752 voci). Vanno provati entrambi — ed è esattamente ciò che il
   codice fa.

## Le misure

Cartella: `…/steamapps/common/TheSkinStapler/TheSkinStapler/TheSkinStapler/Content/Paks/`

| Cosa | Esito |
|---|---|
| `.locres` sciolti su disco | 0 |
| `TheSkinStapler-Windows.utoc` / `.ucas` (674 MB) | 12601 chunk |
| `TheSkinStapler-Windows.pak` (638 MB) | 1662 file, **4 `.locres`** |
| `…/Content/Localization/Game/en/Game.locres` | 149.767 byte, LocRes v3 |
| Stringhe uniche nella tabella | **1007** |
| Voci namespace/key estratte dall'app | **1679** |

I due numeri non sono in contrasto: la tabella stringhe è deduplicata, più chiavi
possono puntare allo stesso testo.

Campioni reali: `"Breaks pretty much over. I'd better head inside and talk to Lucas."`,
`"View Objective"`, `"A bedroom, sir."` — dialoghi e UI, non stringhe di sistema.

## Come riprodurre

Verifica end-to-end senza far partire nessuna traduzione (quindi senza spendere
chiamate API), con il test di integrazione a env var:

```bash
GS_UE_GAME_PATH="C:/…/steamapps/common/TheSkinStapler" \
  cargo test --manifest-path src-tauri/Cargo.toml --lib -- \
  --ignored estrazione_su_gioco_reale --nocapture
```

Ispezione manuale del pak, con i tool che l'app già scarica in
`%APPDATA%/GameStringer/tools/`:

```bash
repak.exe list "<gioco>/Content/Paks/<Nome>-Windows.pak" | grep locres
repak.exe unpack "<pak>" -o <dest> -f -i "<percorso del Game.locres>"
```

**Trappola.** `retoc list` su questi container stampa chunk ID
(`ExportBundleData`, `BulkData`, `ShaderCode`) e nessun nome di file, perché
l'indice directory non porta i nomi. Concludere «nessun `.locres`» da lì è un
errore: non è prova d'assenza, è assenza di prova. Per i nomi serve `repak list`
sul pak.

## Il pulsante che prometteva senza sapere

`get_unreal_localization_status` calcola `has_locres` come
«esiste una cartella `Paks/`», contenuto ignoto. Il sottotitolo del pulsante ci
si basava e annunciava traduzione disponibile. Ora si basa su `locres_count`,
cioè su qualcosa che è stato **contato**; con la sola cartella `Paks/` dichiara
il motore e non promette nulla.

Principio: **annunciare solo ciò che è stato misurato.** Un pulsante che promette
e un pannello che nega, nella stessa schermata, costano più fiducia di un
pulsante che dice meno.

## Regressioni coperte

`unreal_iostore.rs`, modulo test:

- `find_utoc_files_trova_paks_annidata_due_livelli`
- `find_pak_files_trova_annidati_ed_esclude_i_nostri`
- `estrazione_su_gioco_reale` (`#[ignore]`, a env var)
