# ADR-002 — Write-back IoStore/Zen per Unreal Engine 5

**Stato:** parziale in produzione · correttezza rafforzata · pieno rimandato con piano · **Data:** 23/07/2026
**Contesto:** voce roadmap P2 "UE5 IoStore/Zen loader completo" (rif. issue #52).

## Problema

Dalla UE 4.27/5.0 molti giochi non spediscono più asset dentro `.pak`
classici ma dentro **container IoStore** (`.utoc` = indice, `.ucas` = dati),
spesso con compressione **Oodle**. Tradurre questi giochi richiede due metà:

- **Lettura**: aprire `.utoc`/`.ucas`, elencare gli asset, estrarre `.locres`
  e le stringhe dai `.uasset`/DataTable.
- **Scrittura**: rimettere le stringhe tradotte in modo che il gioco le carichi.

## Stato reale del codice (verificato)

**La lettura funziona.** `unreal_iostore.rs` parsa header UTOC (magic,
directory index, compressed block), decomprime **Zlib / LZ4 / Oodle** (DLL
`oo2core` caricata dinamicamente), ed estrae `.locres` + stringhe FText/
StringTable/DataTable dai `.uasset`.

**La scrittura esiste ma è grezza e ristretta.** `apply_datatable_translation`:

- Patcha in binario i `.uasset` DataTable cachati (`patch_uasset_binary`, che
  *sa* far crescere le stringhe e aggiorna `SerialSize`), poi **sintetizza un
  container di override** `<Progetto>_GameStringer_<lang>_P.{utoc,ucas}` +
  un `_P.pak` companion vuoto (senza il quale UE5 non monterebbe il container).
- **Non riscrive i container originali** (approccio overlay, reversibile).
- Funziona **solo per i giochi DataTable `.uasset`**; i giochi con `.locres`
  dentro IoStore passano ancora dall'overlay `_P.pak` sciolto
  (`apply_unreal_translation` → `repak`).
- Scrive i blocchi **non compressi**, con `ContainerFlags=0` e **ChunkHash a
  zeri**.

Un terzo percorso — il **translator runtime a DLL injection**
(`unreal_patcher.rs` + tool `/unreal-translator`) — è l'unica cosa marcata
`experimental: true` (`lib/tools-registry.ts`), e la sua injection è ancora un
TODO. **Non** è il percorso IoStore e resta fuori da questo ADR.

## Cosa è stato corretto ora (23/07)

Interventi a **rischio zero di regressione**, senza bisogno di un gioco reale:

1. **Rimosso il marker fasullo `[IT] `.** Se nessuna traduzione differiva
   dall'originale, il write path iniettava `"[IT] " + originale` "per test
   override" — testo finto che finiva nel container consegnato all'utente. Ora
   `apply_datatable_translation` **fallisce con un errore chiaro** e non produce
   nulla. Le voci non tradotte vengono saltate anche quando ce ne sono altre
   valide (una traduzione identica non deve sovrascrivere il `.uasset`).
2. **Versioni UTOC ignote esplicite.** `UTOC_MAX_KNOWN_VERSION = 5` (UE 5.3);
   oltre, lettura best-effort **con warning** invece di silenzio, così un
   fallimento su UE 5.4+ è diagnosticabile invece di apparire come "container
   vuoto".
3. **ChunkHash documentato, non indovinato** (vedi sotto).
4. **Test sintetici sul write path** (prima zero): `patch_uasset_binary`
   (crescita stringa + prefisso di lunghezza; no-op su mappa vuota), layout di
   `create_iostore_container` (header, ChunkMeta 33B, ChunkHash a zeri), e
   lettura best-effort di una UTOC v7.

### Perché il ChunkHash resta a zeri (deliberato)

`FIoChunkHash` in UE5 è calcolato con **BLAKE3**, non con SHA-1/SHA-2 (le uniche
hash già linkate nel progetto). Il container che generiamo è **non compresso,
non cifrato e non firmato** (`ContainerFlags=0`): in questa configurazione
l'engine non verifica l'integrità del chunk e gli zeri vengono accettati.
Scrivere un hash con l'algoritmo **sbagliato** sarebbe peggio degli zeri: se una
build validasse, romperebbe il mount di un percorso che oggi funziona. Il vero
BLAKE3 va introdotto **insieme** alla compressione/signing (fase sotto), con un
gioco reale per validare.

## Cosa manca per "completo" (rimandato, con piano)

In ordine di valore/rischio:

1. **Compressione Oodle in scrittura.** Oggi l'UCAS di override è non compresso:
   funziona ma è grosso e alcune build potrebbero aspettarsi blocchi compressi.
   Serve l'**encoder** Oodle (non solo il decoder) + un gioco reale.
2. **ChunkHash BLAKE3 reale** (dipende da 1: hash e signing vanno insieme).
   Aggiungere la crate `blake3`.
3. **Write-back `.locres`-dentro-IoStore.** Oggi i `.locres` in IoStore tornano
   solo via `_P.pak` sciolto; portarli nel container di override come per le
   DataTable.
4. **Copertura scrittura UTOC v8/v9** + companion pak oltre il v8 hardcoded;
   sul lato lettura, decidere se rifiutare o leggere le versioni oltre la nota.
5. **Parser Zen package-store / export-bundle.** Oggi il reader lavora a livello
   container + scansione FString grezza: non c'è un vero parser dello Zen store.
   È il pezzo più grosso e la vera parte "loader completo".
6. **Corpus di test reale `.utoc`/`.ucas`.** I test attuali sono tutti
   sintetici; non esiste una fixture da gioco reale. Prerequisito per validare
   1–5 senza rischio per l'utente.

## Decisione

**Mantenere il percorso di override così com'è**, ora **onesto** (niente testo
finto) e **diagnosticabile** (versioni ignote segnalate). **Non** implementare
compressione, hash reale o Zen store senza un **gioco UE5 reale** per il
collaudo: stesso principio dell'ADR-001, mai spedire un writer binario
"plausibile ma sbagliato" che l'utente non può verificare.

## Conseguenze

- La voce roadmap resta aperta ma con blocchi e ordine espliciti, non un TODO
  vago. Il write path non spedisce più marker di test.
- Il tool `/unreal-translator` (DLL injection) resta `experimental` per motivi
  suoi (anti-cheat, injection non implementata): è separato da questo percorso e
  va deciso a parte.
- Nessun nuovo rischio per l'utente: gli interventi di oggi tolgono un bug
  (testo finto) e aggiungono trasparenza, senza toccare il formato su disco dei
  container che già montano.
