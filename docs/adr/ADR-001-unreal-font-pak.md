# ADR-001 — Sostituzione font per Unreal via `_P.pak`

**Stato:** proposto / bloccato su prerequisiti · **Data:** 13/07/2026
**Contesto:** completamento del font auto-patching (`docs/FONT_CHECK.md`).

## Problema

Per gli engine file-based (Ren'Py, RPG Maker) sostituire un font è semplice:
si *aggiunge* un TTF Noto e si punta la config su di esso
(`font_installer.rs`). Per **Unreal Engine** non funziona così: il testo del
gioco referenzia uno **specifico asset font** per package path (es.
`/Game/UI/Fonts/MainFont.MainFont`). Non si può "aggiungere" un font: bisogna
**sostituire l'asset esatto** che il gioco usa, mantenendo lo stesso path,
dentro un mod `_P.pak` (che UE monta con priorità sui pak base).

## Perché non è un fix one-shot come gli altri

Tre blocchi reali, verificati sul codice:

1. **Nessuna serializzazione `.uasset` nel progetto.** Ricerca ripo-wide:
   zero occorrenze di `FontFace`/`UFont`/`.ufont` codegen. Generare un asset
   `FontFace` valido significa scrivere l'header `.uasset` + `.uexp`
   (name map, import/export table, bulk data del TTF) nel formato **specifico
   della versione UE del gioco** — formato in gran parte non documentato e che
   cambia tra versioni. Spedire un `.uasset` "plausibile ma sbagliato"
   produrrebbe pak che l'utente crede funzionanti: **peggio di niente**.

2. **Il reader PAK attuale è parziale.** `unreal_localization.rs`:
   `extract_file_from_pak` gestisce **solo entry non compresse**, versioni
   **v1–v9** (v10+ PathHash index esplicitamente rifiutato), **nessuna
   decrittazione**. Per *identificare* quale asset font sostituire bisogna
   prima elencare/estrarre gli asset dai pak del gioco — cosa che oggi fallisce
   sui pak compressi o UE5. (Il backend IoStore `unreal_iostore.rs` è più
   completo — zlib/lz4/oodle — ma è un percorso separato.)

3. **Serve un gioco UE reale per il collaudo.** A differenza di locres/CPK/BSA,
   una fixture "minima" di asset font non basta: la correttezza si vede solo
   quando UE monta il `_P.pak` e rendera il testo col font nuovo. Senza un
   target reale non si può validare, e il rischio (pak rotto, o peggio gioco
   che non parte) ricade sull'utente.

## Cosa è già riutilizzabile

- `repak_wrapper::create_pak(files, out, Some(11))` — writer pak affidabile
  (repak.exe, v4–v11, mount point, compressione). Il flusso locres
  (`create_translation_pak`) già impacchetta `<Project>_GameStringer_<lang>_P.pak`.
- `find_paks_dir` + `find_project_name` per posizionamento e naming.
- `font_installer::font_pack_for_lang` per la sorgente del font Noto per lingua.
- IoStore: `create_iostore_container` + `create_empty_pak_companion` per i
  giochi `.utoc` (un `_P.pak` sciolto non verrebbe scoperto da UE5).

## Opzioni valutate

- **A. Generare da zero un `FontFace.uasset`** che punta al TTF Noto, con path
  = quello del font del gioco. *Massima resa, massimo rischio*: richiede la
  serializzazione uasset versione-specifica (blocco #1). Scartata per ora.
- **B. Byte-swap del TTF embedded** nell'asset font esistente del gioco
  (estrai il FontFace, sostituisci i byte del font in `.uexp`/`.ubulk`
  aggiustando gli offset, ripacchetta). Più trattabile di A perché non genera
  la struttura da zero, ma richiede comunque il reader completo (blocco #2) e
  un target reale (blocco #3).
- **C. Guida assistita (nessuna generazione automatica).** La FontCheckCard
  già mostra il consiglio per Unreal; si può arricchire con i passi esatti e i
  link a una community font-fix. Zero rischio, valore limitato.

## Decisione

**Rimandare A/B** finché non ci sono i prerequisiti; **non spedire un
generatore non testato** (principio: mai "plausibile ma sbagliato" su formati
binari che l'utente non può verificare). Nel frattempo resta la **guida per
engine** (opzione C, già in `fontCheck.adviceUnreal`).

## Prerequisiti per sbloccare (in ordine)

1. Estendere il reader PAK a: entry **compresse** (zlib), indice **v10/v11**
   PathHash — oppure incanalare tutto sul percorso IoStore già più completo.
2. Un **gioco UE di test** con font che non copre una scrittura target (es. un
   indie UE4 senza cirillico) per validare end-to-end.
3. Solo allora, implementare **B** (byte-swap) come primo target, con un test
   d'integrazione che monta il pak e verifica l'asset sostituito.

## Conseguenze

- La voce roadmap "Generazione `_P.pak` con font sostitutivo per Unreal" resta
  aperta, ma con un **piano concreto** e i blocchi identificati, invece di un
  TODO vago. Il costo di un'implementazione affrettata (pak rotti in mano agli
  utenti, supporto, sfiducia) è esplicitamente evitato.
- Per l'utente finale il divario è coperto onestamente: la card dice cosa fare,
  invece di offrire un bottone che a volte rompe il gioco.
