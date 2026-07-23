# Relazioni con i publisher — GameStringer

> Un canale aperto **prima** di un takedown, e una whitelist per i giochi dove
> una traduzione amatoriale non ha senso. Molti publisher tollerano o
> apprezzano le fan-translation: preferiamo il dialogo al conflitto.

## Il principio (in una riga)

GameStringer **non distribuisce contenuti dei giochi**. Produce e condivide solo
**patch/diff** applicate ai file che l'utente **già possiede** legalmente; il
Patch Hub è protetto tecnicamente perché un `.gspack` contenga solo traduzioni,
mai testo originale ridistribuibile (vedi [`ANTI_PIRACY.md`](ANTI_PIRACY.md) e la
garanzia "solo diff" `lib/redistribution-guard.ts`).

## Chiedici prima di un takedown

Se rappresenti un publisher o un titolare di diritti e hai una preoccupazione su
un gioco, **scrivici prima** di avviare una procedura formale. Nella maggior parte
dei casi possiamo risolvere in giorni, senza attriti, con una di queste azioni:

- **Whitelist del titolo** — escludiamo il gioco dal flusso di traduzione e dal
  Patch Hub (vedi sotto).
- **Rimozione mirata** dei pack segnalati dal Patch Hub (il canale formale resta
  comunque disponibile: vedi [`DMCA.md`](DMCA.md)).
- **Collaborazione** — se stai lavorando a una localizzazione ufficiale, possiamo
  indirizzare gli utenti verso di essa (vedi "official_localization" nella whitelist).

**Contatto relazioni publisher:** `publishers@gamestringer.ai`
_(da configurare da Davide; in alternativa il canale contatti del sito o una
issue privata sul repository.)_

Tempi indicativi: **triage entro 72 ore** lavorative, coerente con la SLA DMCA.

## La whitelist — cosa è e come funziona

La whitelist elenca i giochi per cui **tradurre non ha senso o non è gradito**,
con due motivazioni distinte:

- `official_localization` — esiste già una localizzazione **ufficiale** nella
  lingua di destinazione. L'app avvisa l'utente che la traduzione amatoriale è
  probabilmente superflua e suggerisce quella ufficiale.
- `publisher_request` — il publisher ha chiesto di **non** tradurre quel titolo.
  L'app disabilita il flusso di traduzione e il publish del pack per quel gioco.

Il dato vive in [`data/publisher-whitelist.json`](../data/publisher-whitelist.json)
(schema versionato). Il matching è puro e testato in
[`lib/social/publisher-whitelist.ts`](../lib/social/publisher-whitelist.ts):
associa per `appId` (Steam) o per titolo normalizzato, e restringe la motivazione
`official_localization` alla sola lingua target interessata.

### Nota sulla localizzazione ufficiale automatica

Oltre alla lista curata, l'app rileva già le lingue **ufficialmente supportate**
da un gioco (`lib/steam-languages.ts`, pulsante "Rileva lingue"). Quando il gioco
supporta ufficialmente la lingua target, ha senso mostrare lo stesso avviso anche
senza una voce esplicita in whitelist: la lista curata serve per i casi che il
rilevamento non copre e per le richieste dirette dei publisher.

## Cosa NON facciamo

- Non ridistribuiamo asset, testi o file originali dei giochi.
- Non incoraggiamo l'uso di copie non possedute: il gate "possiedi il gioco" e il
  [`LEGAL.md`](LEGAL.md) (in 12 lingue) sono espliciti.
- Non trattiamo un publisher come un avversario per default: questo canale esiste
  proprio per evitarlo.

---

### English summary

GameStringer distributes **only patches/diffs** applied to files the user already
owns — never original game content. **Publishers: contact us before a takedown**
at `publishers@gamestringer.ai`. We can whitelist a title (exclude it from
translation and from the Patch Hub), remove flagged packs, or point users to an
official localization. The curated whitelist lives in
`data/publisher-whitelist.json`; matching logic is in
`lib/social/publisher-whitelist.ts`. Formal DMCA channel remains available (see
`DMCA.md`).
