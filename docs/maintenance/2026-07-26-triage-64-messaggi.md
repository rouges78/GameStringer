# I 64 messaggi, letti tutti — 26/07/2026

Seguito del triage del 25/07, che aveva chiuso i quattro gruppi più grossi. Qui la
coda residua, letta riga per riga da `public.community_messages` (64 righe, dal
28/04 al 21/07).

Le lingue: **russo in netta maggioranza**, poi inglese, cinese, arabo, ungherese,
italiano. Il pubblico reale del prodotto non parla italiano — il che dà alla
lamentela «metà del programma è in italiano» un peso diverso da quello che sembrava.

## Cosa c'era dentro, per frequenza

| Gruppo | Msg | Stato |
|---|---:|---|
| Aggiungere un gioco non in libreria («non trova i pirata», «come aggiungo») | 8 | funzione esiste dal 23/06 — ma **non la trovano** |
| Ollama non rilevato | 7 | chiuso 25/07 |
| Lingua sbagliata: italiano forzato, spagnolo nella UI | 6 | chiuso 25/07 |
| Deltarune / giochi GameMaker | 4 | **aperto** — vedi sotto |
| «Tradotto al 100%», ma il gioco resta in inglese / «e adesso?» | 4 | **aperto, il più grave** |
| Impostazioni che non si salvano (LM Studio, DeepSeek) | 3 | **parzialmente aperto** |
| Pulsante Sfoglia dell'iniettore | 2 | chiuso 25/07 |
| Lingue disponibili? (arabo, ungherese) | 2 | **c'erano già, nessuno ha risposto** |
| Forum: non si crea un thread | 1 | chiuso 25/07 |
| Casi singoli (EA account, PoE 2, Sinking City 2, icaria, Wuthering Waves, .locres) | 6 | vedi sotto |
| Saluti, insulti, spam | ~21 | — |

## Le tre cose che il triage di ieri non aveva visto

### 1. Deltarune è il `data.win` che manca da un mese

Quattro utenti chiedono di tradurre **Deltarune** (24/06, 25/06, 01/07 ×2). È un
gioco **GameMaker**, e il lavoro su GameMaker è fermo dal 22/07 per un motivo
preciso, scritto in ADR-004: *nessun `data.win` reale in libreria su cui provare il
rebuilder*.

Deltarune Chapter 1 & 2 è **gratuito** e scaricabile da itch.io e Steam (Chapter 1
dal 2018, Chapter 2 dal 2021), e usa `data.win`. Il blocco tecnico e la richiesta più
ripetuta degli utenti si risolvono con lo stesso download.

### 2. Nessun provider AI ha un endpoint configurabile

Un utente cinese, il 30/06: *«non riesco a salvare le impostazioni API
personalizzate di DeepSeek; l'annuncio dice che è stato risolto, ma il problema
persiste»*.

Verificato: in `lib/ai/ai-translate-direct.ts` **tutti** gli endpoint sono
hardcoded — `api.deepseek.com`, `api.openai.com`, `api.groq.com`, `api.anthropic.com`
e gli altri sette. Si può salvare la chiave, non l'indirizzo. La funzione che
l'utente cercava non è rotta: non esiste.

Il fix annunciato (23/06, «persistenza affidabile settings/API key») riguardava le
chiavi. L'utente lo ha letto, ha riprovato, e il suo problema era un altro: la
fiducia si perde due volte.

Perché conta più di quanto sembri: un endpoint configurabile è quello che serve a chi
sta dietro un proxy, in Cina, o vuole usare un servizio compatibile OpenAI. È lo
stesso identico problema che il 25/07 abbiamo risolto per Ollama, e per gli altri
provider è rimasto aperto.

### 3. «Traduzione completata al 100% con 0 errori» — e il gioco è ancora in inglese

Il messaggio più utile dei 64 arriva da un solo utente il 01/07, in tre parti. Ha
lanciato String It, ha ricevuto *«Traduzione completata al 100% con 0 errori»*, e poi:

- il pulsante «prova il gioco» **apriva un'altra istanza di GameStringer** invece del
  gioco — ha capito da solo che partiva il primo eseguibile in ordine alfabetico
  nella cartella, e l'ha aggirato rinominando la propria copia portable con una `z`
  davanti. *Questo è chiuso: è il fix `afec75ad` di ieri sera.*
- una volta avviato il gioco vero, **era ancora in inglese**, pur avendo il russo
  impostato;
- ha provato ogni strada dell'interfaccia, OCR incluso, su un altro gioco (`icaria`):
  nessuna produce traduzione.

Il 03/07 un altro utente: *«ho premuto traduci, ha tradotto, e poi?»*.

Due difetti distinti, entrambi aperti: il messaggio di successo **non verifica di
aver prodotto un effetto** (dice 100% e 0 errori anche quando l'utente non vede
nulla cambiare), e dopo la traduzione **non c'è un passo successivo** che spieghi
cosa fare. È il cuore del prodotto, ed è dove si perdono gli utenti che hanno già
superato antivirus, SmartScreen e configurazione AI.

## Le due domande più facili del mondo, rimaste senza risposta

- 04/05, in arabo: «c'è l'arabo?»
- 10/06: «magyar?» (ungherese)

Sono **entrambe supportate** — `ar` e `hu` sono in `lib/translation/target-languages.ts`.
Due utenti se ne sono andati con un no implicito, per due mesi, perché nessuno
leggeva la chat. È la miglior sintesi del perché serve un canale presidiato.

## Casi singoli, con verdetto

- **Wuthering Waves** (27/06): risposta corretta già data nel thread — è un online con
  anticheat, il launcher ripristina i file. Nessun bug.
- **`.locres` non trovati** (09/07): l'utente riceve un errore che elenca alternative
  («usa il pannello Unreal o l'OCR») e chiede *«e adesso che faccio?»*. Il messaggio è
  tecnicamente corretto ma non è azionabile.
- **Path of Exile 2** (30/06), **The Sinking City 2** (14/06), **icaria** (01/07):
  segnalazioni senza log, non riproducibili così come sono. Sono esattamente i casi
  che il database di compatibilità raccoglierebbe da solo — ora che scrive davvero.
- **Account EA** (25/06): «dice che è impossibile». Da riprodurre.

## Cosa cambia nel modo di lavorare

Il triage di ieri aveva chiuso quattro gruppi in un giorno perché erano bug con una
causa tecnica. Questa seconda passata dice qualcosa di diverso: **la maggioranza dei
messaggi rimasti non sono bug, sono persone che non trovano una funzione che esiste**
(aggiungere un gioco, le lingue disponibili) **o che non sanno cosa fare dopo**
(traduzione completata, e poi?).

Non si risolve con il codice: si risolve rispondendo. Il che riporta al punto già
noto — il Discord, e qualcuno che legge.
