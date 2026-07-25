# Archivio messaggi Lobby community — estratti il 25/07/2026

64 messaggi, 28/04/2026 → 21/07/2026, tabella `community_messages`.
Archiviati **prima** di qualsiasi eliminazione delle tabelle chat.

**Non erano chiacchiere.** Sono in larga maggioranza richieste di supporto e
segnalazioni di bug, mai lette né risposte (l'unica risposta in tutto il periodo
è quella di Davide del 02/07 su Wuthering Waves). Vale la pena leggerli tutti:
sono la voce degli utenti reali dell'app.

---

## I temi ricorrenti (in ordine di gravità)

### 1. La lingua dell'interfaccia non viene rispettata — SEGNALATO DA 7 UTENTI

Il problema più ripetuto in assoluto, da maggio a luglio, in 4 lingue diverse:

- 11/05 `Man`: «why is it in italian languange. when i already select english»
- 02/06 `X4Tz1S`: «how can change italian language?»
- 08/06 `GlassOfMilk`: «Выбрал интерфейс русский — внутри каждой вкладки любой
  игры все на испанском» *(scelto il russo, dentro ogni scheda è tutto in spagnolo)*
- 13/06 `tamagotchiboy`: «половина проги на итальянском» *(metà del programma in italiano)*
- 13/07 `Tony_Vulcano`: «у меня пытается все переводить на испанский»
  *(prova a tradurre tutto in spagnolo)*
- 21/07 `user_216c3047_364`: «перечисляет методы на испанском, если ввести путь
  вручную. Прикольно придумано, что софт для перевода надо переводить»
  *(elenca i metodi in spagnolo… il software di traduzione va tradotto)*

Ricorre lo **spagnolo** come lingua che compare a sproposito, in punti diversi
(schede gioco, elenco metodi). Sembra un fallback sbagliato, non una traduzione
mancante.

### 2. Ollama / LM Studio non vengono rilevati — 6 UTENTI

- 10/06 `irb` (×2): «Ollama не видит… и так же не сохраняет настройки LM Studio»
- 13/06 `tamagotchiboy`: «судя по логам она даже не пытается к ней подключиться»
  *(dai log non prova nemmeno a connettersi)* — porte e URL diversi provati, zero effetto
- 26/06 `koteiik`: «Что делать, если не видит ollama?»
- 27/06 `66kqkq`: «Ollama 识别不到，不光是我这样吗» *(non rileva Ollama, capita solo a me?)*
- 30/06 `hakurei`: «无法保存Deepseek的自定义API设置» *(non salva le impostazioni API custom di DeepSeek)*

### 3. Il Community Hub è ROTTO per gli utenti

- 26/06 `koteiik`: «центр сообщества тоже не работает, **не позволяет создать тему**»
  *(il centro community non funziona, non permette di creare un topic)*

Questo spiega i **3 soli post** nel forum in quattro mesi. Se gli utenti non
riescono a creare thread, tenere "solo il forum" non serve a niente finché non
si verifica e corregge la creazione dei thread.

### 4. "Non trova il gioco" / come aggiungerlo a mano — 5 UTENTI

03/06 `hadda`, 17/06 `STELKRT`, 24/06 `Danikk`, 18/07 `bnilder` (novelle),
21/07 `user_216c3047_364` («"обзор" в универсальном инжекторе не работает» —
il pulsante Sfoglia dell'iniettore universale non funziona).

### 5. Il flusso post-traduzione non è chiaro — 3 UTENTI

- 01/07 `Labuda` (3 messaggi, molto dettagliati): la traduzione riporta
  «Traduzione completata al 100% con 0 errori», ma il pulsante "prova il gioco"
  **rilancia GameStringer stesso** invece del gioco. Ipotesi dell'utente: l'app
  lancia il primo eseguibile della cartella. Ha verificato rinominando il
  portable con una `z` iniziale — e allora è partito il gioco. Ma la traduzione
  comunque non era applicata.
- 03/07 `Pe Fende Infernum`: «нажал на перевести, перевел, а дальше как?»
  *(ho premuto traduci, ha tradotto, e poi?)*
- 09/07 `Yaugen`: chiede cosa fare col messaggio «File .locres non trovati».

### 6. Richieste di Deltarune (GameMaker) — 4 UTENTI

24/06 `curly`, 25/06 `MrFreeman`, 01/07 `stefan_jopaed`, 01/07 `sircow`.
Domanda reale e ripetuta per un gioco **GameMaker** — collegato alla voce
roadmap del rebuilder `data.win` (ADR-004).

### 7. Frustrazione esplicita

`Trapishe`: «Эта хуерга вообще работает?» · `tamagotchiboy`: «пока что
бесполезный кусок амбициозного кода» *(per ora un pezzo di codice ambizioso ma
inutile)* · `user_216c3047_364`: «В общем, понятно. Говно» · `Ris`: «ну и шляпа»
· `INVALIDNOST`: «Класс, ошибка за ошибкой» *(errore dopo errore)*.

Sono utenti russi arrivati in blocco a inizio giugno (coincide col picco di
512 profili nella settimana dell'08/06) che hanno trovato l'app non funzionante
per il loro caso d'uso e se ne sono andati.

### 8. Domande sulla pirateria — 6 UTENTI

«пиратки не ищет?» — l'app non scansiona copie piratate. Comportamento
corretto e voluto, ma è la domanda più frequente in assoluto dopo i bug:
forse va detto esplicitamente da qualche parte, per non lasciarli a cercare.

---

## Indagine sul punto 3 — perché non si creano thread (25/07)

**Accertato**: i 10 thread esistenti sono TUTTI dell'autore seed
`11111111-1111-1111-1111-111111111111` ("GameStringer"). Le 3 risposte sono
tutte di Davide (una, del 12/07, dice «funziona il forum??»). In 4 mesi e 1.619
utenti, **nessun utente reale ha mai pubblicato**. Anche i pack sono a zero su
entrambi i cataloghi (`translation_packs` = 0, thread con `pack_data` = 0).

**Escluso**: non è la RLS — un INSERT simulato come utente autenticato
(`request.jwt.claims` con `sub` = author_id) **riesce**. Non sono le categorie
(12, caricate dal DB). Non è lo schema né un trigger.

**Causa individuata**: la UI mostrava il pulsante "Nuovo thread" **senza
controllare se esiste un profilo locale**. Senza profilo:
`getGSSession()` → null → `autoSyncGSToSupabase()` → null →
`createThread()` esce subito → toast generico "errore nella creazione del
thread". L'utente compilava tutto il form per poi ricevere un errore muto.
Il log d'avvio di Davide lo conferma: `[UNIFIED_AUTH] No valid session found`.

**Correzioni applicate (25/07)**:
- banner ambra in cima al form quando manca il profilo, con invito ad accedere;
- pulsante "Pubblica" disabilitato senza `userId`;
- controllo `!userId` a inizio `handleSubmit` con messaggio esplicito;
- quando `createThread` torna `null` a input già validati, il messaggio non è
  più generico ma «backend della community non raggiungibile, riprova»;
- nuove chiavi i18n `forum.loginRequired` / `loginRequiredHint` /
  `backendUnavailable` in tutte le lingue; rimosse 242 chiavi `chat.*` orfane.

**Resta da verificare**: se anche CON un profilo attivo la pubblicazione
fallisce, la causa è il backend (il codice del ponte è pieno di difese contro
outage: circuit-breaker, cooldown 3 min, timeout, riferimenti al 522 di
Cloudflare). In quel caso ora il messaggio lo dice esplicitamente.

## Cosa farne

1. **Verificare la creazione thread nel forum** — se è rotta, il forum "unico
   sistema" non regge (punto 3).
2. **Indagare il leak di spagnolo/italiano nella UI** — è il difetto più
   segnalato e dà l'impressione peggiore su un'app di traduzione (punto 1).
3. **Rilevamento Ollama/LM Studio** — 6 segnalazioni in un mese (punto 2).
4. **Il tasto "prova il gioco" lancia l'eseguibile sbagliato** — diagnosi già
   fatta gratis da un utente (punto 5).

## Testo integrale

I 64 messaggi in ordine cronologico sono conservati nella cronologia di questa
sessione e nella tabella `community_messages` **finché non viene eliminata**:
esportarli in CSV prima di qualunque `DROP`.
