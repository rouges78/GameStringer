# Il file di config del sito sovrascrive i prezzi corretti dell'app

**Data:** 23/08/2026 · **Stato:** corretto nel repo, **non ancora ridistribuito**

## Il fatto

`lib/remote-config.ts` non è la verità finale sui prezzi. È il *fallback*.
La verità che arriva agli utenti è questa:

```
lib/remote-config.ts  →  BUNDLED_MODEL_CONFIG   (spedito con l'app)
https://gamestringer.ai/config/models.json  →  remoto, TTL 12h
mergeModelConfig(bundled, remote)  →  { ...bundled.pricing, ...remote.pricing }
```

**Nel merge il remoto vince**, per chiave di provider e per intero array di
modelli. Il file remoto non è un'aggiunta: è una sovrascrittura.

Il 23/08 il file live (`HTTP 200`, `updatedAt: 2026-07-15`) conteneva ancora il
catalogo di luglio e quindi rimetteva in circolo, su **tutte** le installazioni,
i valori che il repo aveva già corretto:

| Voce | File live (sbagliato) | Repo (corretto) | Effetto sull'utente |
|---|---|---|---|
| prezzo `deepseek` | `0.00014` (V3) | `0.00044` (V4 Flash picco) | preventivo **3,1× più basso** del vero |
| modelli `claude` | `claude-3-5-sonnet`, `claude-3-5-haiku` | `claude-sonnet-4-6`, `claude-opus-5`, Haiku 4.5 | Opus 5 **sparisce** dal menu, ID ritirati verso l'API |
| modelli `gemini` | `gemini-2.0-flash`, `gemini-1.5-pro` | `gemini-3.5-flash`, `gemini-3.1-flash-lite` | ID vecchi verso l'API |

Il caso DeepSeek è quello che fa male: il prezzo era stato corretto nell'app il
22/08 (commit `839a4358`, "correct a DeepSeek price that was three times low") e
il sito lo **ri-rompeva** dodici ore dopo, senza che nessun test potesse
accorgersene. I test coprono il merge, non il contenuto del file remoto.

## Il secondo errore, trovato per strada

Il prezzo `gemini` nel bundled era `0.000125` — cioè quello di Gemini 2.0 Flash,
rimasto lì dopo il passaggio del codice a `gemini-3.5-flash`. Prezzo reale
verificato su `ai.google.dev`: **$1.50/1M input**, cioè `0.0015`. Era **12×
troppo basso**, un errore quattro volte peggiore di quello DeepSeek e sfuggito
alla revisione del 16/08, che aveva corretto l'*etichetta* lasciando il *numero*.

Lezione: correggere la nota senza correggere la cifra lascia il bug e toglie
l'unico indizio che c'era.

### Seguito: il default è passato a Gemini 3.7 Flash

Lo stesso giorno il default del codice è passato da `gemini-3.5-flash` a
`gemini-3.7-flash` in sette file (`ai-translate-direct`, `ai-post-edit`,
`reflection-translator`, `smart-content-router`, `lore-assistant`,
`vision-translate`, `vlm-batch-translate`). 3.7 è stabile, nativamente
multimodale — verificato prima di toccare i percorsi vision — con 1M di
contesto e 64k di output, e Google elenca ormai 3.5 come *legacy*.

**Il prezzo però resta `0.0015` ($1.50/1M), non `0.00075`.** 3.7 costa metà
solo fino al 31/12/2026: dal 1° gennaio torna a $1.50/1M. Abbassare la stima
adesso significherebbe doverla rialzare a Capodanno, con il rischio concreto
di non accorgersene — ed è esattamente così che è nato l'errore da 12×
descritto qui sopra. Fino ad allora la stima sbaglia per eccesso, che è la
direzione innocua.

## Prezzi verificati il 23/08/2026

Fonti ufficiali, non stime:

- `ai.google.dev/gemini-api/docs/pricing` — Gemini 3.5 Flash $1.50/1M input;
  Gemini 3.7 Flash $0.75/1M fino al 31/12/2026, poi $1.50/1M; 3.1 Flash Lite $0.25/1M
- `api-docs.deepseek.com` — `deepseek-v4-flash` $0.22 fuori picco / $0.44 picco
  per 1M input cache-miss. Picco: 01:00–04:00 e 06:00–10:00 UTC, lun–ven
- Anthropic — `claude-sonnet-4-6` $3/1M, `claude-opus-5` $5/1M
- `developers.openai.com/api/docs/pricing` — `gpt-4o-mini` $0.15/1M, `gpt-4o` $2.50/1M,
  entrambi ancora listati. Esistono modelli più recenti (gpt-5.6-sol $4/1M,
  gpt-5.6-luna $0.20/1M, gpt-5-nano $0.05/1M) che questo codice non chiama
- `mistral.ai/pricing/api` — Mistral Large 3 $0.5/1M, Mistral Medium 3.5 $1.5/1M,
  Mistral Small 4 $0.15/1M

Nessun prezzo del catalogo resta ora non verificato.

### Mistral: il terzo errore, e tre verità in disaccordo

Il prezzo `mistral` era `0.002` ($2/1M) e non corrispondeva più a niente:
Mistral Large 3 costa **$0.5/1M**, un quarto. Era il sovrapprezzo più grosso
del catalogo — ma nella direzione innocua, perché preventivava troppo.

Sotto ci sta però un disaccordo che il prezzo da solo non risolve:

| Dove | Cosa dice |
|---|---|
| il codice (`ai-translate-direct.ts:513`, `reflection-translator.ts:388`) | chiama `mistral-small-latest` — Mistral Small 4, $0.15/1M |
| il catalogo (`models.mistral`) | offre solo `mistral-large-latest` |
| la tendina del Translator Pro (`translatorProPage.mistralLarge2`) | scrive «Mistral Large **2**» |

Tre versioni diverse dello stesso provider in tre punti dell'app.

**Risolto lo stesso giorno.** La verità scelta è ciò che il codice chiama
davvero: `mistral-small-latest`, Mistral Small 4. Catalogo e tendina sono stati
allineati a quello, e il prezzo è sceso da `0.0005` (Large 3) a **`0.00015`**,
che è quello vero di Small 4.

Notare il cambio di regola: finché il catalogo offriva Large e il codice
chiamava Small, il prezzo teneva il margine prudenziale della fascia di picco
DeepSeek, perché non si sapeva quale dei due sarebbe girato. Allineati i tre
punti, l'ambiguità sparisce e con essa il margine: **la stima ora è esatta, non
prudente.** Il margine serve quando non sai cosa gira, non come abitudine.

La chiave i18n si chiamava `translatorProPage.mistralLarge2`. Lasciarla con
dentro «Mistral Small 4» avrebbe ricreato la stessa deriva nome/contenuto che
questo documento descrive, quindi è stata rinominata in `mistralSmall4` in tutte
e 12 le lingue — dove il valore era identico ovunque, perché è un nome di
prodotto e non prosa da tradurre.

### La chiave `gpt5` non è GPT-5

Si chiama così per ragioni storiche ma il modello è **GPT-4o**: lo dicono il
costo-calcolatore (`modelLabelById('openai', 'gpt-4o')`) e la tendina del
Translator Pro. Il prezzo `0.0025` era ed è giusto. Rinominare la chiave
significherebbe toccare sette file di tipi e la config remota già distribuita:
non vale il rischio, ma chi legge quel nome va avvertito.

## Il limite che resta

Il catalogo ha **una sola chiave prezzo per provider**. Il default Claude è
Sonnet 4.6 ($3/1M) ma la variante premium è Opus 5 ($5/1M): chi sceglie il
premium paga ~1,7× il preventivo. È l'unico punto in cui questa tabella sbaglia
per difetto — ovunque altro la regola è sbagliare per eccesso, perché una
fattura più alta del preventivo è il difetto peggiore che possa fare.

## Stato

Sito ridistribuito il 23/08/2026 (PR #115, poi #117 per gli ultimi tre prezzi):
`gamestringer.ai/config/models.json` serve il catalogo corretto, e i nove prezzi
coincidono con `BUNDLED_MODEL_CONFIG`. Verificabile in qualsiasi momento con:

```bash
curl -s https://gamestringer.ai/config/models.json
```

Se un giorno quel file e `lib/remote-config.ts` divergono di nuovo, è il file
del sito a vincere — e nessun test se ne accorgerà.
