# GameStringer — Posizione legale e uso accettabile

**🌐 Languages:** [English](LEGAL.md) · [Italiano](LEGAL_IT.md) · [Español](LEGAL_ES.md) · [Français](LEGAL_FR.md) · [Deutsch](LEGAL_DE.md) · [Português](LEGAL_PT.md) · [Polski](LEGAL_PL.md) · [Русский](LEGAL_RU.md) · [日本語](LEGAL_JA.md) · [中文](LEGAL_ZH.md) · [한국어](LEGAL_KO.md) · [Ελληνικά](LEGAL_EL.md)

*Ultimo aggiornamento: 14 luglio 2026 · Si applica a GameStringer, l'applicazione desktop source-available.*

> **Questo non è un parere legale.** È una dichiarazione in buona fede di cosa sia
> GameStringer, dei principi su cui opera e delle regole che gli utenti accettano di
> rispettare. Integra — e non prevale su — la [LICENSE](../LICENSE) del progetto e
> qualsiasi legge applicabile. Le leggi variano da paese a paese; in caso di dubbio,
> consultare un avvocato qualificato.

---

## 1. Cos'è — e cosa non è — GameStringer

GameStringer è uno **strumento desktop locale e source-available** che aiuta una
persona a tradurre nella propria lingua un videogioco **che possiede già
legalmente**. Legge il testo traducibile dalla copia del gioco dell'utente, lo
traduce (tramite AI/LLM, OCR o modifica manuale) e produce o applica una
**traduzione** — un overlay di testo in memoria, l'installazione di un font o una
patch.

GameStringer **non è** un gioco e **non**:

- contiene, include, ospita, vende o distribuisce alcun gioco o alcun asset
  protetto da copyright di un editore;
- fornisce, sblocca o aiuta a ottenere giochi che l'utente non possiede;
- funziona da solo — richiede che l'utente possieda già e fornisca il gioco
  originale.

È sviluppato da **un singolo individuo, in modo non commerciale, senza alcuna
monetizzazione**, e distribuito con la **GameStringer Source Available License
v1.1**.

## 2. Principi guida

1. **Proprietà prima di tutto.** GameStringer è destinato solo ai giochi che
   l'utente possiede legalmente.
2. **Uso personale e accessibilità linguistica.** Lo scopo principale è consentire
   a una persona di comprendere e godersi, nella propria lingua, il software che ha
   acquistato — inclusi i giocatori che altrimenti non potrebbero giocare affatto.
3. **Rispetto per i titolari dei diritti.** Il progetto non ridistribuisce contenuti
   originali e risponde in modo tempestivo e in buona fede a preoccupazioni
   legittime.
4. **Non commerciale.** Nessuna vendita, nessuna pubblicità, nessun paywall, nessuna
   monetizzazione di alcun tipo.

## 3. Uso accettabile — gli utenti **devono**

- Possedere una **copia legale** di ogni gioco su cui utilizzano GameStringer.
- Conservare le traduzioni per **uso personale**. Se scelgono di condividere il
  proprio lavoro, condividere solo **patch/diff che richiedono il gioco originale
  per essere applicate** (ad es. IPS/BPS/xdelta) — mai asset protetti da copyright
  autonomi o copie integrali del testo originale di un gioco.
- Rispettare l'**EULA / i termini di servizio** di ciascun gioco e le **leggi del
  proprio paese**.

## 4. Uso vietato — gli utenti **non devono**

- Usare GameStringer per piratare, ottenere o distribuire giochi o asset protetti da
  copyright.
- Ridistribuire porzioni sostanziali del testo o degli asset originali di un gioco
  come contenuto autonomo.
- Usarlo per ottenere un vantaggio sleale nei giochi **online o multiplayer**.
- Usarlo per **sconfiggere, disabilitare o aggirare** DRM o anti-cheat laddove ciò
  sia vietato dalla legge o dai termini del gioco.
- Usarlo per qualsiasi scopo illecito.

## 5. Protezioni tecniche e anti-cheat

GameStringer è costruito per la **localizzazione single-player / offline**. **Non**
disabilita, sconfigge o aggira i sistemi DRM o anti-cheat.

Al contrario, GameStringer include un **cancello di sicurezza anti-cheat**: prima di
qualsiasi injection a runtime, **rileva i sistemi anti-cheat noti e blocca o limita
l'operazione** sui titoli protetti. Questa è una **misura di salvaguardia** —
progettata per proteggere gli utenti dai ban e per tenere lo strumento lontano dai
giochi online protetti — **non** una funzionalità di elusione.

Gli utenti restano responsabili di non utilizzare lo strumento in violazione delle
norme anti-elusione (ad esempio, l'Article 6 della EU Copyright Directive
2001/29/EC, o il 17 U.S.C. §1201 negli Stati Uniti) o dei termini di un gioco.

## 6. Condivisione con la community (hub di traduzione)

Laddove GameStringer consenta agli utenti di pubblicare e scaricare traduzioni della
community, le stesse regole si applicano ai contenuti condivisi:

- Gli elementi condivisi devono essere **patch/diff che richiedono il gioco
  originale**, non copie di materiale protetto da copyright.
- Chi carica è **unico responsabile** di ciò che pubblica e garantisce di avere il
  diritto di condividerlo. GameStringer fornisce gli strumenti — non una licenza per
  distribuire i contenuti altrui.
- I metadati di integrità (SHA-256 aggregato) esistono per verificare che un pacchetto
  non sia stato manomesso; non costituiscono una rivendicazione di proprietà.
- I titolari dei diritti possono richiedere la rimozione di specifici contenuti
  condivisi — vedere [Contatto e rimozione](#8-rights-holders--contact--takedown).

## 7. Contesto delle traduzioni amatoriali (buona fede)

GameStringer segue il consolidato modello delle **traduzioni amatoriali
(fan-translation)**: non commerciale, che richiede il gioco originale e rispettoso
dei titolari dei diritti. Progetti di questo tipo esistono in una **zona grigia**
legale — la tolleranza da parte degli editori è comune quando un progetto è non
commerciale e non ridistribuisce l'opera originale, ma tale tolleranza è una
cortesia, **non un diritto legale**. GameStringer è deliberatamente progettato per
rimanere dal lato più prudente di quella linea: proprietà richiesta, nessun contenuto
ridistribuito, titoli protetti/online esclusi.

## 8. Titolari dei diritti — contatto e rimozione

Se sei un titolare dei diritti (o un suo rappresentante) e hai una preoccupazione
riguardo a GameStringer o ai contenuti condivisi tramite esso, apri una issue o
contatta il manutentore tramite il repository del progetto:

- **Repository:** https://github.com/rouges78/GameStringer
- **Manutentore:** [@rouges78](https://github.com/rouges78)

Il progetto **risponderà in modo tempestivo e in buona fede**, inclusa la rimozione
di qualsiasi contenuto condiviso dalla community che risulti violare i diritti.

## 9. Esclusione di garanzia e limitazione di responsabilità

GameStringer è fornito **"così com'è", senza garanzia di alcun tipo**. L'utente è
**unico responsabile** del modo in cui utilizza lo strumento e della propria
conformità alla legge applicabile e ai termini di qualsiasi gioco. Nella misura
massima consentita dalla legge, lo sviluppatore e i contributori **non sono
responsabili** per eventuali danni, azioni sull'account, perdita di dati o altre
conseguenze derivanti dall'uso o dall'uso improprio del software. Questa sezione è
coerente con, e soggetta a, la [LICENSE](../LICENSE) del progetto.

## 10. Non è un parere legale

Questo documento è una dichiarazione in buona fede della posizione del progetto e non
costituisce un parere legale né crea alcun rapporto avvocato–cliente. Se hai bisogno
di una valutazione vincolante per la tua situazione o giurisdizione, consulta un
avvocato qualificato con esperienza in materia di proprietà intellettuale e diritto
del software.
