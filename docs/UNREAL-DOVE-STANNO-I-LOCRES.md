# Unreal: dove stanno davvero i `.locres`

Misurato il 19/08/2026 su **The Skin Stapler** (Steam, UE5 IoStore), partendo da
un caso in cui l'app dichiarava «questo gioco non espone testi estraibili».
**Era falso: il gioco ha 1007 stringhe traducibili.**

Questo documento esiste perché la diagnosi è costata mezz'ora di misure e la
conclusione non è intuitiva. Serve a chi (persona o agente) deve capire da solo
perché un gioco Unreal "senza localizzazione" in realtà ce l'ha.

## Il fatto centrale

> Nei giochi UE5 IoStore i `.locres` **non stanno nel container `.utoc`/`.ucas`**.
> Stanno nel `.pak` legacy affiancato, che il gioco spedisce insieme al container.

I `.locres` non sono asset: non passano dalla cosversione in Zen. Restano file
normali dentro il pak. Il container contiene asset, shader e bulk data.

Corollario operativo: **una catena di rilevamento che guarda solo i file sciolti
e il container IoStore trova zero, sempre, su ogni gioco UE5 moderno.**

## Le misure

Cartella: `…/steamapps/common/TheSkinStapler/TheSkinStapler/TheSkinStapler/Content/Paks/`

| Cosa | Esito |
|---|---|
| `.locres` sciolti su disco | **0** |
| `TheSkinStapler-Windows.utoc` / `.ucas` (674 MB) | 12601 chunk, **0 `.locres`** |
| `TheSkinStapler-Windows.pak` (638 MB) | 1662 file, **4 `.locres`** |
| DLL Oodle spedita dal gioco | **nessuna** |
| `oo2core_9_win64.dll` in `%APPDATA%/GameStringer/tools/` | **presente** |

I quattro `.locres` nel pak:

```
Engine/Content/Localization/Engine/en/Engine.locres
Engine/Plugins/Online/OnlineSubsystem/Content/Localization/OnlineSubsystem/en/OnlineSubsystem.locres
Engine/Plugins/Online/OnlineSubsystemUtils/Content/Localization/OnlineSubsystemUtils/en/OnlineSubsystemUtils.locres
TheSkinStapler/Content/Localization/Game/en/Game.locres   ← quello del gioco
```

`Game.locres`: 149.767 byte, versione 3, **1007 stringhe, 51.938 caratteri**.
Campioni reali: `"Breaks pretty much over. I'd better head inside and talk to Lucas."`,
`"View Objective"`, `"A bedroom, sir."` — dialoghi e UI, non stringhe di sistema.

## Come riprodurre la misura

Con i tool che l'app già scarica in `%APPDATA%/GameStringer/tools/`:

```bash
# 1. Il container NON serve a rilevare i locres: `list` stampa chunk ID, non nomi.
retoc.exe list "<gioco>/Content/Paks/<Nome>-Windows.utoc"

# 2. Il pak SÌ: stampa i path veri.
repak.exe list "<gioco>/Content/Paks/<Nome>-Windows.pak" | grep locres

# 3. Estrazione mirata del solo file che serve.
repak.exe unpack "<pak>" -o <dest> -f -i "<Gioco>/Content/Localization/Game/en/Game.locres"
```

**Trappola da non ripetere:** `retoc list` su questo container stampa
`ExportBundleData` / `BulkData` / `ShaderCode` e nessun nome di file, perché
l'indice directory non porta i nomi. Concludere «nessun `.locres`» da quell'output
è un errore: non è una prova d'assenza, è assenza di prova.

## Perché l'app falliva

La catena di rilevamento in `game-detail-client.tsx` (percorso Unreal di
`startAutoTranslate`) fa due tentativi e nessuno dei due guarda il pak sorgente:

1. `get_unreal_localization_status` → `find_loose_locres()` → solo file sciolti → **0**
2. `extract_iostore_localization` → solo `.utoc`/`.ucas` → **0**
3. → messaggio «non espone testi estraibili»

**Manca il terzo anello: leggere il `.pak` affiancato.**

La cosa importante: **il lettore esiste già.**
`unreal_iostore.rs::extract_locres_from_pak()` (e il più generale
`extract_files_by_ext_from_pak`) apre il pak, decomprime i blocchi con Oodle e
restituisce i `.locres`. Oggi è chiamato solo da `count_pak_translated_entries()`,
cioè per contare le stringhe della patch **GameStringer già applicata** — mai per
leggere il pak **originale del gioco**. È lo stesso codice, puntato sul file
sbagliato.

## Il bug secondario: il pulsante promette e l'esecutore nega

`get_unreal_localization_status` calcola:

```rust
let has_locres = !loose_locres.is_empty() || paks_dir.is_some();
let locres_count = loose_locres.len();
```

`has_locres` è **vero appena esiste una cartella `Paks/`**, indipendentemente dal
contenuto. Il sottotitolo del pulsante STRING IT! si basa su `has_locres` e
annuncia «.locres trovati — traduzione AI disponibile»
(`game-detail-client.tsx:763`), mentre l'esecutore richiede
`has_locres && locres_count > 0`. Da qui la contraddizione a schermo: il pulsante
promette, due righe sotto il pannello nega.

Due flag distinti servono: «c'è una cartella Paks» non è «ci sono testi».

## Cosa serve per «un pulsante che traduce tutto»

Il lato **scrittura** è già completo e collaudato: `auto_translate_unreal()` crea
il `_P.pak` e `retoc_wrapper` genera la coppia `_P.utoc`/`_P.ucas` che lo fa
montare (la tripletta — vedi l'intestazione di `retoc_wrapper.rs`).

Manca solo il lato **lettura**:

1. Inserire uno step `extract_locres_from_pak()` sui pak del gioco tra il
   tentativo «file sciolti» e quello «IoStore».
2. Scartare i `.locres` di Engine e dei plugin Online: tradurre `Engine.locres`
   sposta stringhe di sistema, non il gioco. Tenere il `Content/Localization/Game/`.
3. Separare `has_locres` (esiste `Paks/`) da `has_text` (stringhe > 0) e far
   parlare il pulsante del secondo.

Con questi tre punti The Skin Stapler passa da «non traducibile» a 1007 stringhe
tradotte dallo stesso pulsante di tutti gli altri giochi.

## Generalizzazione

Il pattern non è specifico di questo gioco: vale per **ogni** titolo UE5 che usa
IoStore e non spedisce `.locres` sciolti, cioè la maggioranza dei giochi UE5
recenti su Steam. Ogni volta che l'app dice «non espone testi estraibili» su un
Unreal con un `.pak` accanto al `.utoc`, la prima cosa da verificare è
`repak list <pak> | grep locres`.
