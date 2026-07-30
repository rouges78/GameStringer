# Fixture Unreal — `.locres` autentici

## `below-rusted-gods-Game-es.locres`

**La prima fixture `.locres` del progetto che NON è stata generata da noi.**

Perché è importante: tutte le altre fixture `.locres` le produce il nostro
stesso writer, quindi dimostrano che parser e writer sono coerenti *fra loro* —
non che siano coerenti con Unreal. È esattamente per questo che il magic
inventato in `unreal_localization.rs` (4 byte `0x0E14DA7A` invece del GUID a 16)
è sopravvissuto a tutti i test fino al 30/07/2026: le fixture su cui veniva
verificato erano scritte dal codice sbagliato. Un test che non può fallire non è
un test.

Questo file viene da Unreal. È il metro.

### Provenienza

*Below, Rusted Gods* (From South Games, Steam 2895680), estratto il 30/07/2026
da un dump di memoria del processo preso subito dopo aver cambiato lingua dal
menu Opzioni — il cambio cultura fa RICARICARE i `.locres`, quindi il blob
serializzato è vivo in una finestra temporale che si può scegliere.

Strumenti: `scripts/ue-locres-from-dump.js` (`--ispeziona`, `--estrai`).

### Cosa contiene, e cosa NON contiene

| | |
|---|---|
| versione | **3** (`Optimized_CRC32_Utf16`) — oltre l'ultima versione documentata da CUE4Parse |
| offset array stringhe | 37920 |
| voci dichiarate | 811 |
| namespace | 8 — `""` (714), `MainMenu` (46), `ST_Ending` (9), `ST_Meassurements` (9, typo loro), `ST_MemberStatus` (4), `ST_Monitor` (16), `ST_SquadStatus` (12), `UMG` (1) |
| **indice** | ✅ **COMPLETO** — 811 chiavi su 811, la lettura atterra esatta su 37920 |
| **array stringhe** | ⚠️ **PARZIALE: 204 su 752** |
| lingua | spagnolo (`es`) |

⚠️ **Il file è TRONCATO di proposito a 66302 byte**, cioè dove finiscono i dati
`.locres` validi. Oltre quel punto, nel dump, ci sono byte ad alta entropia che
NON appartengono a questa risorsa.

**Non usare questa fixture per verificare la lettura completa dell'array
stringhe**: fallirebbe, e correttamente. Serve per:

- il layout dell'header di una `versione 3` reale
- la struttura dell'indice namespace/chiavi (l'unica parte integra)
- il GUID magico vero, contro cui misurare il writer
- il comportamento del parser su input troncato (deve recuperare il recuperabile
  e DICHIARARE quanto manca, non buttare tutto)

### Sul perché è troncato: due diagnosi sbagliate, a verbale

Vale la pena scriverle perché sono state proposte con sicurezza e demolite dai
dati nel giro di un'ora.

1. **«Memoria liberata e riciclata dall'allocatore.»** Smontata da: due dump
   presi in momenti diversi sono risultati byte-identici fino allo stesso punto
   di rottura, con lo stesso valore. Il riciclo non si ripete uguale.
2. **«Il `.locres` attraversa il confine fra due regioni del dump, che nel file
   non sono adiacenti.»** Plausibile — un `.DMP` è davvero un elenco di regioni,
   ed è per questo che è nato `scripts/minidump.js`. Smontata da: rileggendo per
   indirizzo virtuale, la rottura cade allo stesso byte. Quella regione era già
   contigua nel file.

   (Nel motivare la (2) avevo anche liquidato la (1) osservando che l'offset non
   era multiplo di 4096. Anche quello era sbagliato: allineato alle pagine è
   l'indirizzo virtuale, non la posizione nel file.)

Causa vera: **non ancora determinata.** L'unico fatto è che i byte oltre 66302
hanno entropia alta e sono deterministici fra dump — il che in un gioco UE5 con
IoStore *suggerisce* dati ancora compressi, ma è un'ipotesi non misurata e va
trattata come tale.

`scripts/minidump.js` resta valido e testato: non serviva a questo problema.
