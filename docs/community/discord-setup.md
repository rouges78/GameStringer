# Discord GameStringer — impostazione minima (annunci e release)

Stato di partenza: server creato, vuoto. Obiettivo: **annunci e release**, con la
minima superficie di moderazione possibile. Tutto quello che segue è pensato per
essere fatto in una mezz'ora e non richiedere manutenzione quotidiana.

> **Principio guida:** ogni canale che apri è lavoro che ti impegni a fare. Meglio
> quattro canali presidiati che dodici abbandonati — un canale morto comunica
> "questo progetto è fermo" più di un canale che non esiste.

---

## 1. Impostazioni del server (prima dei canali)

**Impostazioni server → Moderazione**

| Voce | Valore | Perché |
|---|---|---|
| Livello di verifica | **Medio** (account Discord da 5+ minuti) | Ferma quasi tutto lo spam-bot senza infastidire le persone vere. "Alto" chiede il telefono e fa perdere iscritti. |
| Filtro contenuti espliciti | **Scansiona i messaggi di tutti** | Costa zero. |
| AutoMod → spam link/menzioni | **Attivo** | La prima cosa che arriva su un server nuovo sono i bot con link a "free steam keys". |
| Timeout permessi @everyone | vedi sotto | |

**Ruolo @everyone → Permessi** — togli questi a tutti:

- ❌ Menziona @everyone, @here e tutti i ruoli
- ❌ Gestisci messaggi / canali / nickname altrui
- ❌ Crea inviti *(opzionale: se vuoi contare da dove arriva la gente, usa solo il tuo link permanente)*

Lascia attivi: leggere, scrivere, allegare file, reagire, usare thread.

**Non attivare "Community Server" per ora.** Serve solo se vuoi le regole
integrate, i canali annunci "seguibili" da altri server e la Discovery. Aggiunge
requisiti (canale regole, canale aggiornamenti moderatori, verifica email
obbligatoria) che a questo stadio sono peso morto. Si attiva in qualsiasi momento.

---

## 2. Struttura dei canali

Sei canali in due categorie. Niente vocali finché non c'è nessuno da sentire.

```
📌 INFORMAZIONI
  #benvenuto        (sola lettura)  regole + cos'è GameStringer + link
  #annunci          (sola lettura)  nuove versioni, changelog
  #stato-progetto   (sola lettura)  opzionale: roadmap, cosa sto facendo

💬 COMUNITÀ
  #generale                          chiacchiere, presentazioni
  #domande-e-problemi                ⭐ il canale che ti evita i DM
  #traduzioni-fatte                  vetrina, quando ci saranno
```

**Sola lettura** = permessi del canale → @everyone → ❌ Invia messaggi, ✅ Aggiungi
reazioni. Le reazioni lasciate attive ti danno un segnale gratuito su cosa
interessa.

**`#domande-e-problemi` è quello che ti risparmia lavoro, non che te ne aggiunge.**
Senza, le stesse domande ti arrivano in DM una per volta e nessun altro le vede.
Con, rispondi una volta e la risposta resta lì per il prossimo.

**Da NON fare adesso:** canali per engine (Unity, Unreal, RPG Maker...), canali
per lingua, bot personalizzati, ticket di supporto. Sono nel roadmap come
`discord-build` e hanno senso quando ci sono abbastanza persone da riempirli.
Aprirli vuoti fa sembrare il server abbandonato.

---

## 3. Ruoli

Tre, non di più.

| Ruolo | Colore | A chi | Permessi |
|---|---|---|---|
| **Sviluppatore** | un colore acceso | solo tu | Amministratore |
| **Traduttore** | un colore tenue | chi pubblica una traduzione fatta con lo strumento | nessuno in più: è un riconoscimento |
| *(più avanti)* **Moderatore** | | quando servirà | Gestisci messaggi, Espelli |

Il ruolo **Traduttore** costa niente e fa un lavoro preciso: dà a chi contribuisce
un motivo per restare, e a te un elenco di persone da cui pescare i moderatori
quando serviranno.

---

## 4. Testi pronti

### `#benvenuto`

> # GameStringer
>
> **GameStringer** è uno strumento desktop per tradurre videogiochi con l'aiuto
> dell'IA e la revisione di una persona. Open source, gratuito, funziona anche
> offline con Ollama.
>
> 🔗 **Sito e download:** <https://github.com/rouges78/GameStringer/releases>
> 📖 **Guide e roadmap:** <https://github.com/rouges78/GameStringer>
>
> ---
>
> ## Regole
>
> **1. Niente pirateria.** Non si condividono giochi, file di gioco, chiavi,
> crack o link a materiale pirata. Le traduzioni si distribuiscono **come patch
> che contengono solo il testo tradotto**, mai come file originali del gioco.
> Chi rompe questa regola viene rimosso senza discussione: è la regola che tiene
> in piedi tutto il resto.
>
> **2. Rispetta il lavoro degli sviluppatori.** Se un gioco ha già una
> traduzione ufficiale nella tua lingua, compra quella. Se stai traducendo un
> gioco, valuta di scrivere prima allo sviluppatore: molti dicono di sì.
>
> **3. Comportati bene.** Niente insulti, molestie, contenuti d'odio o NSFW.
>
> **4. Niente spam né autopromozione** non richiesta.
>
> **5. Le lingue del server sono italiano e inglese.** Scrivi pure nella tua,
> ma includi una versione in una delle due se vuoi risposte.
>
> ---
>
> *English: GameStringer is a free, open-source desktop tool for AI-assisted game
> translation with human review. No piracy of any kind — translations are
> distributed as text-only patches, never as original game files. Be decent, no
> spam. Italian and English both welcome.*

### `#annunci` — modello per una release

Il canale annunci è **in inglese**: è la lingua del CHANGELOG e quella che
capisce chiunque entri. Le regole restano bilingui, gli annunci no.

> # GameStringer v1.15.0
>
> **New**
> · …
> · …
>
> **Fixes**
> · …
>
> ⬇️ **Download:** <link alla release GitHub>
> 📄 **Full changelog:** <link a CHANGELOG.md>
>
> Something broken in this version? Let us know in <#domande-e-problemi>.

**Da v1.16.0 in poi non dovrai più scriverlo a mano:** `npm run ship` pubblica
l'annuncio da solo leggendo il CHANGELOG (`scripts/release/discord-announce.js`).
Serve solo il secret `DISCORD_WEBHOOK_URL` su GitHub — istruzioni in testa allo
script. Anteprima senza inviare nulla:

```
npm run discord:announce -- v1.15.0 --dry-run
```

### `#domande-e-problemi` — messaggio fissato

> Prima di scrivere, queste tre cose fanno risparmiare un giro a tutti:
>
> **1.** Che versione di GameStringer usi? (la trovi in Impostazioni)
> **2.** Che gioco e su che sistema? (Windows / macOS / Linux)
> **3.** Cosa ti aspettavi e cosa è successo invece?
>
> Se c'è un errore, allega uno screenshot o il testo dell'errore.
> Puoi anche usare **Impostazioni → Community → Invia feedback** dentro l'app:
> allega da solo versione e sistema.

---

## 5. Invito permanente

Crea **un solo** link, che non scade e non ha limite di usi:

`#benvenuto` → Invita persone → Modifica link → *Scadenza: Mai · Usi massimi:
Nessun limite* → Genera.

Poi mettilo, **sempre lo stesso**, in questi posti:

- `README.md` del repo (badge Discord in cima)
- Sito del progetto
- Descrizione delle release GitHub
- Nell'app: Impostazioni → Community, accanto al widget feedback
- Firma dei messaggi quando scrivi agli sviluppatori (vedi
  `docs/outreach/`)

Un link unico dappertutto significa che le statistiche degli inviti ti dicono
quanti arrivano; link diversi per posto ti direbbero *da dove*, ma è
raffinatezza che serve dopo.

---

## 6. Anti-pirateria: perché la regola 1 è scritta per prima

Non è formalità. Un server dove si condividono traduzioni può diventare, senza
che nessuno lo voglia, un posto dove si condividono **file di gioco** — e a quel
punto il problema legale è tuo, non di chi ha caricato.

Le difese già in piedi nel progetto (`ANTI_PIRACY.md`, `DMCA.md`, il
redistribution-guard che blocca la pubblicazione di pack contenenti asset
originali) valgono per l'app. Il Discord è un canale diverso e va coperto a mano:
la regola scritta in `#benvenuto` e l'applicazione senza eccezioni sono tutta la
copertura che hai.

Se qualcuno posta un file di gioco: cancella subito, avvisa una volta, alla
seconda espelli. Non è severità, è l'unico modo di poter dire con la faccia
pulita che il tuo strumento non serve a piratare.

---

## 7. Cosa aspettarsi le prime settimane

Un server nuovo è vuoto, e resta vuoto per un po'. È normale e non significa che
sia stato inutile aprirlo: significa che serve un motivo per entrarci. I motivi,
in ordine di efficacia per un progetto come questo:

1. **Una traduzione mostrabile** — un gioco vero, tradotto bene, con il video.
2. **Il link nell'app**, dove sono già le persone che usano lo strumento.
3. **Essere presenti dove sta già la gente** — le community di fan-translation
   esistenti (`community-bridges` nel roadmap): farsi adottare, non competere.

Non postare per riempire. Un canale annunci con tre messaggi veri in tre mesi
comunica più salute di uno con trenta messaggi di circostanza.
