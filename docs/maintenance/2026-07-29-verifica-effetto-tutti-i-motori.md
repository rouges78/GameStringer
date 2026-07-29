# La verifica dell'effetto verificava sé stessa (29/07/2026)

Seguito diretto del [triage dei 64 messaggi](2026-07-26-triage-64-messaggi.md), voce
*«Tradotto al 100%, ma il gioco resta in inglese»* — 4 segnalazioni, la più dettagliata
delle quali arriva da un utente il 01/07 in tre parti.

## Cosa era stato fatto il 28/07, e perché non bastava

Il wizard di fine traduzione aveva smesso di dichiarare il verde d'ufficio: prima di
mostrarlo controllava, con `check_path_exists`, che i file dichiarati dai motori
esistessero davvero su disco.

Il controllo passava **sempre**. Guardando che cosa dichiarano i motori in
`prediction_tool.rs`:

| Deliverable | `file_path` dichiarato | Esiste anche a patch inefficace? |
|---|---|---|
| GameMaker Patch | cartella del gioco | sì |
| RPG Maker Patch | cartella del gioco | sì |
| TyranoScript Patch | cartella del gioco | sì |
| Visionaire Patch | cartella del gioco | sì |
| Modified game files | cartella del gioco | sì |
| Execution Report (×2) | file scritto da noi nel run | sì |
| Smart Backup | cartella creata da noi nel run | sì |
| TyranoScript Backup | file creato da noi nel run | sì |
| Translations | cartella di lavoro creata da noi | sì |

Cinque motori su sette dichiaravano la **cartella del gioco**, e il resto erano
sottoprodotti del nostro stesso run. Il risultato è che si era sostituito un
messaggio ottimistico con un controllo che dava sempre lo stesso esito: la
verifica non poteva fallire, quindi non verificava.

## La prova esisteva già, e la buttavamo via

Ogni patcher restituisce il conteggio reale di ciò che ha scritto —
`patched_count`, `strings_replaced`, `total_applied`, `entries_count` — ma quel
numero finiva solo dentro la *stringa* del nome del deliverable
(`format!("GameMaker Patch ({} strings)", …)`), dove nessuno poteva leggerlo in
modo strutturato.

## Che cosa è cambiato

**Rust — `prediction_tool.rs`**

Nuovo enum `EffectProof` con tre valori, e due campi in `ExecutionDeliverable`:

- `Patched` — scritture reali nei file del gioco; `strings_written` le conta.
- `Runtime` — BepInEx/XUnity: la traduzione avviene giocando. Zero stringhe
  scritte è il comportamento corretto, non un fallimento.
- `None` — report, backup, cartelle di lavoro. Non provano nulla.

I 12 punti che creavano deliverable passano dai literal ai costruttori
`::patched()`, `::runtime()`, `::neutral()`, che rendono l'intenzione leggibile
sul posto. `#[serde(default)]` sui campi nuovi: i report salvati prima di oggi
si rileggono come `None`, cioè "non prova nulla", che è la lettura prudente.

**Frontend**

Il verde richiede ora `stringsWritten > 0` (oppure `runtimeOnly`), non
l'esistenza di un percorso. Il titolo dice quante stringhe sono finite nel
gioco; con la traduzione a runtime quel numero non esiste e non viene inventato.
Aggiunta la riga «e adesso?», diversa nei tre casi — l'altra metà della
segnalazione del 01/07, rimasta senza risposta.

## Tre difetti trovati dalla revisione, non dalla scrittura

1. **`del_injection` veniva registrato prima della validazione.** Lo stage 7
   ripristina dal backup i file risultati invalidi e decrementa `injected_count`
   (fix issue #46), ma il deliverable era già stato creato con il conteggio
   pre-ripristino. Nel caso peggiore il wizard mostrava il verde con «N stringhe
   scritte» mentre il report diceva, due righe sotto, che il gioco NON era stato
   tradotto. Ora il deliverable si registra **dopo** lo stage 7.

2. **`injected_count` conta file, non stringhe.** Mostrato come «{n} stringhe
   scritte» faceva leggere «3 stringhe» a chi ne aveva appena tradotte 1200.
   Aggiunto `injected_strings`, che conta le sostituzioni vere.

3. **Visionaire dichiarava un numero che nessuno aveva verificato.**
   `patch_success` era cablato a `true` e il conteggio era `translated_count`
   (le stringhe *tradotte*), mentre `patch_vbin_strings` può saltarne in
   silenzio quando non entrano nello spazio disponibile. Ora la funzione
   restituisce `(payload, applied)` e il successo dipende da `applied > 0`.
   I quattro test esistenti asseriscono anche il conteggio.

E un difetto **introdotto** dalla correzione stessa, sempre trovato in revisione:
i quattro percorsi rapidi (Ren'Py, Visionaire, TyranoScript, RPG Maker) non
popolavano `verification`, e con la nuova logica finivano nel ramo "non
verificato" — dicendo «il gioco è rimasto com'era» dopo una patch riuscita. Una
bugia pessimistica al posto di una ottimistica. Ora popolano il campo.

## Da verificare con la compilazione

Le modifiche Rust non sono state compilate (sandbox senza toolchain). Prima del
commit, da Git Bash nella radice del repo:

```
cd /g/dev/Gamestringer
cd src-tauri && cargo check && cargo test --lib visionaire && cd ..
npm run typecheck
npm test
```

Il test `visionaire` è quello che conta: la firma di `patch_vbin_strings` è
cambiata da `Result<Vec<u8>>` a `Result<(Vec<u8>, u32)>` e i quattro test sono
stati adeguati a mano.

## Quello che ancora non c'è

Nessun test copre `EffectProof`, `stringsWritten` o la scelta verde/ambra. È una
logica che decide che cosa l'utente crede sia successo, ed è già stata sbagliata
due volte in due giorni: merita un test suo.
