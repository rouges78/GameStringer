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

## Prezzi verificati il 23/08/2026

Fonti ufficiali, non stime:

- `ai.google.dev/gemini-api/docs/pricing` — Gemini 3.5 Flash $1.50/1M input;
  Gemini 3.7 Flash $0.75/1M fino al 31/12/2026, poi $1.50/1M; 3.1 Flash Lite $0.25/1M
- `api-docs.deepseek.com` — `deepseek-v4-flash` $0.22 fuori picco / $0.44 picco
  per 1M input cache-miss. Picco: 01:00–04:00 e 06:00–10:00 UTC, lun–ven
- Anthropic — `claude-sonnet-4-6` $3/1M, `claude-opus-5` $5/1M

Restano **non riverificati dal 15/07/2026**: `openai`, `gpt5`, `mistral`.

## Il limite che resta

Il catalogo ha **una sola chiave prezzo per provider**. Il default Claude è
Sonnet 4.6 ($3/1M) ma la variante premium è Opus 5 ($5/1M): chi sceglie il
premium paga ~1,7× il preventivo. È l'unico punto in cui questa tabella sbaglia
per difetto — ovunque altro la regola è sbagliare per eccesso, perché una
fattura più alta del preventivo è il difetto peggiore che possa fare.

## Da fare

`docs/sito/config/models.json` è corretto **nel repo** ma il sito va
ridistribuito: finché non lo è, il file di luglio continua a essere servito.
