# DMCA / Takedown Policy — GameStringer Patch Hub

GameStringer rispetta i diritti di proprietà intellettuale. I pacchetti di
traduzione (`.gspack`) condivisi sul Patch Hub devono contenere **solo
traduzioni**, mai testo originale redistribuibile (vedi
[`ANTI_PIRACY.md`](ANTI_PIRACY.md)). Se ritieni che un contenuto violi i tuoi
diritti, segui la procedura qui sotto.

## Come inviare una segnalazione (takedown)

Invia una notifica all'agente designato includendo **tutti** questi elementi
(requisiti tipici di una notifica DMCA 17 U.S.C. §512(c)(3)):

1. **Identificazione dell'opera** protetta da copyright che ritieni violata.
2. **Identificazione del materiale** da rimuovere: l'ID del pack o l'URL sul
   Patch Hub, sufficiente a localizzarlo.
3. **I tuoi dati di contatto** (nome, email, e se applicabile l'organizzazione
   che rappresenti).
4. Una **dichiarazione in buona fede** che l'uso non è autorizzato dal titolare,
   dal suo agente o dalla legge.
5. Una **dichiarazione di veridicità**, sotto pena di falsa attestazione, che sei
   il titolare dei diritti o autorizzato ad agire per suo conto.
6. La tua **firma** (fisica o elettronica).

**Agente designato / contatto:** `dmca@gamestringer.ai`
_(⚠️ **non ancora configurata** — verificato il 10/08/2026. Finché non esiste,
una notifica inviata a quell'indirizzo non arriva a nessuno e l'SLA di 72 ore
qui sotto non è misurabile: nel frattempo vale il canale contatti del sito.)_

**Come si esegue materialmente un takedown:** vedi il runbook
[`runbooks/dmca-takedown.md`](runbooks/dmca-takedown.md) — comandi verificati
sullo schema reale del database.

## Cosa succede dopo (SLA)

1. **Ricezione e triage** entro **72 ore** lavorative.
2. Se la notifica è completa e valida, il pack viene **messo in stato
   *pending* / rimosso dalla vista pubblica** e registrato nel
   `moderation_log` (già presente lato server, riuso dell'infrastruttura pack).
3. **Notifica all'autore** del pack, con la ragione e la possibilità di
   contro-notifica.
4. Il takedown viene annotato nel **registro pubblico** (vedi sotto).

## Contro-notifica (counter-notice)

L'autore del pack può inviare una contro-notifica se ritiene che la rimozione
sia un errore o un'identificazione errata, includendo: identificazione del
materiale rimosso, dichiarazione in buona fede sotto pena di falsa attestazione,
dati di contatto e consenso alla giurisdizione competente. In assenza di azione
legale del segnalante entro i termini di legge, il materiale può essere
ripristinato.

## Abuso delle segnalazioni

Le notifiche palesemente pretestuose o ripetutamente infondate possono portare a
**ignorare** future segnalazioni dello stesso mittente. I titolari verificati
possono essere aggiunti come **trusted flaggers** (corsia rapida) o richiedere
l'inserimento di un titolo in **whitelist** (es. quando esiste una
localizzazione ufficiale).

## Registro pubblico dei takedown

Per trasparenza manteniamo un registro pubblico delle rimozioni (data, titolo/ID
del pack, esito), senza dati personali del segnalante. È alimentato dal
`moderation_log` del Patch Hub.

## ⚠️ Stato di attuazione (10/08/2026)

Onestà su cosa è pronto e cosa no — un documento che descrive una capacità che
non esiste è peggio di un documento assente, perché ci si conta sopra:

| Pezzo | Stato |
|---|---|
| Tabelle `moderation_log` e `pack_reports` | ✅ esistono in produzione (verificate) |
| Trigger su `translation_packs` | ✅ `publish_guard` + `enforce_pack_status` |
| Nascondere un pack riportandolo a `pending` | ✅ possibile, reversibile |
| Runbook operativo coi comandi | ✅ [`runbooks/dmca-takedown.md`](runbooks/dmca-takedown.md) |
| **Takedown mai eseguito, nemmeno di prova** | ⛔ `moderation_log` ha 0 righe |
| **Email `dmca@`** | ⛔ non configurata |
| **Registro pubblico** dei takedown | ⛔ nessuna pagina lo mostra |

_Questo documento descrive un processo operativo e non costituisce consulenza
legale. Ultimo aggiornamento: 2026-08-10._
