# Digest Traduzioni Videogiochi — 23 agosto 2026

> **Questo non è uno scan di novità: è una verifica delle azioni consigliate dal digest precedente.** Su quattro voci, **tre avevano la premessa sbagliata** e sono state chiuse senza scrivere codice. La quarta era giusta, e tirando quel filo sono emersi due difetti che nessun digest aveva visto: il sito rimetteva in circolo i prezzi vecchi su tutte le installazioni, e quattro lingue del changelog v1.16.0 non erano mai state tradotte.
>
> ⚠️ Le sezioni **RSS**, **traduzioni amatoriali** e **localizzazioni ufficiali** sono assenti di proposito: oggi non è stato fatto uno scan web di quelle fonti, e riempirle a memoria le renderebbe indistinguibili da dati veri.

## ✅ Le azioni consigliate, verificate una per una

| Azione del digest | Esito |
|---|---|
| «Autorizzare il connettore GitHub, senza cui la verifica del lavoro non taggato resta cieca» | **Premessa sbagliata.** `gh` è già autenticato in locale (`rouges78`, scope `repo`). Il buco esiste solo per l'agente cloud. Verifica fatta: 20 commit del 22/08, tutti su `origin/main`, PR #106→#114; nulla di non pushato |
| «Taggare v1.15→v1.17, così che chi arriva dal sito non riceva la v1.14.0» | **Premessa sbagliata.** Le tre versioni erano già taggate **e pubblicate come Release**, con la v1.17.0 come `Latest`. `releases/latest` serviva già la 1.17, e il sito citava già v1.17.0 |
| «Validare i nuovi modelli provider e aggiornare preset e tabella» | **Corretta.** Fatta — ed è il filo che ha portato a tutto il resto |
| «Rilevamento Ollama e traduzione UI russa restano i temi più citati» | **Premessa sbagliata.** **Zero issue aperte.** Ollama (#49, #52) e russo (#47, #50) risultano tutte chiuse. Il russo misurato: 0 chiavi mancanti, 7220/7515 in cirillico |

**Da correggere in chi genera il digest:** tre voci su quattro derivavano da uno stato non riletto. Vale la pena verificare tag, Release e issue aperte *prima* di proporli come azione, altrimenti il digest genera lavoro che non esiste.

## 🔥 I due difetti che il digest non aveva visto

### Il file di config del sito sovrascriveva i prezzi corretti dell'app

`lib/remote-config.ts` non è la verità finale: è il *fallback*. L'app scarica `gamestringer.ai/config/models.json` (TTL 12h) e `mergeModelConfig` fa `{ ...bundled, ...remote }` — **il remoto vince**, per chiave di provider e per intero array di modelli.

Il file live era fermo al 15/07 e quindi rimetteva in circolo, su **tutte** le installazioni:

- prezzo DeepSeek a `0.00014` invece di `0.00044` → preventivi **3,1× più bassi**. Quel prezzo era stato corretto nell'app il 22/08 (`839a4358`); il sito lo ri-rompeva dodici ore dopo
- `claude-3-5-sonnet` / `claude-3-5-haiku` al posto dell'array corretto → **Claude Opus 5 spariva dal menu**
- `gemini-2.0-flash` / `gemini-1.5-pro` → ID ritirati verso l'API

Nessun test poteva accorgersene: coprono la funzione di merge, non il contenuto di un file servito da altrove.

### Quattro lingue del changelog v1.16.0 non erano mai state tradotte

Un conteggio ingenuo diceva «32 voci su 88 non tradotte» per `ru`, `ja`, `pl`, `el`. In realtà quelle lingue avevano **90 voci invece di 88** (le voci 31 e 42 duplicate), e da lì ogni indice scalava: `changelog.v1_16_0.40` puntava a commit diversi a seconda della lingua.

Il disallineamento nascondeva il resto. Riallineati gli indici: **zero voci tradotte su 88**, non 56. Coincide con la nota già presente in `scripts/release/translate-changelog.js` — la traduzione della v1.16.0 morì il 06/08 su un credito esaurito.

Il gate `i18n-locale-integrity` era **verde prima** e rosso subito dopo la riparazione: passava perché il difetto lo nascondeva. Un gate che confronta per indice non protegge da un array disallineato, lo certifica.

## 🤖 Modelli e prezzi — verificati oggi sulle pagine ufficiali

Nove voci su nove del catalogo, contro le pagine dei provider. **Tre prezzi erano sbagliati**, due per difetto (i pericolosi) e uno per eccesso:

| Provider | Era | Ora | Nota |
|---|---|---|---|
| `gemini` | `0.000125` | **`0.0015`** | era il prezzo di Gemini 2.0 Flash, rimasto dopo il passaggio a 3.5: **12× troppo basso** |
| `deepseek` | `0.00014` (dal sito) | **`0.00044`** | V4 Flash, tariffa di picco |
| `mistral` | `0.002` | **`0.00015`** | era il vecchio $2/1M: **4× troppo alto** rispetto a Large 3, e 13× rispetto a Small 4 che il codice chiama davvero |
| `openai` · `gpt5` · `claude` | invariati | invariati | verificati corretti |

**Modelli confermati esistenti:** Gemini 3.7 Flash (GA, nativamente multimodale, 1M contesto, $0.75/1M fino al 31/12/2026 poi $1.50/1M), DeepSeek V4 Flash (picco/fuori picco $0.44/$0.22), Claude Opus 5 ($5/1M). OpenAI ha modelli più recenti (`gpt-5.6-sol`, `gpt-5.6-luna`, `gpt-5-nano`) che questo codice non chiama.

**Default Gemini passato a `gemini-3.7-flash`** in sette file. Verificata la multimodalità *prima* di toccare i tre percorsi vision: puntarli a un modello solo-testo avrebbe rotto l'OCR in silenzio.

**Nota sul prezzo Gemini, da non "correggere":** resta a `0.0015` ($1.50/1M) anche se 3.7 Flash costa metà fino al **31/12/2026**. Abbassarlo ora significherebbe doverlo rialzare a Capodanno — ed è esattamente così che è nato l'errore da 12×.

## 🛠 Stato del catalogo modelli

| Provider | ID nel catalogo | Prezzo /1K | Verificato |
|---|---|---|---|
| openai | `gpt-4o-mini` | 0.00015 | 23/08 |
| gpt5 | `gpt-4o` (la chiave mente: non è GPT-5) | 0.0025 | 23/08 |
| gemini | `gemini-3.7-flash` | 0.0015 | 23/08 |
| claude | `claude-sonnet-4-6` (+ `claude-opus-5`) | 0.003 | 23/08 |
| deepseek | `deepseek-v4-flash` | 0.00044 | 23/08 |
| mistral | `mistral-small-latest` | 0.00015 | 23/08 |

Bundled e sito ora **coincidono su tutte e nove le voci**. Verificabile in qualsiasi momento:

```bash
curl -s https://gamestringer.ai/config/models.json
```

## 📝 Cose non verificate / da controllare manualmente

- **Sezioni RSS, traduzioni amatoriali ITA, localizzazioni ufficiali:** non scansionate oggi. Il prossimo digest deve rifarle da zero, non ereditarle da qui.
- **Stato tool upstream** (XUnity, BepInEx, MelonLoader): non ricontrollato dal 05/07. Sono passate sette settimane.
- **Il changelog `en.json` è la sorgente dichiarata ma non sempre inglese:** nove voci della v1.16.0 erano scritte in italiano perché i commit da cui nascono violavano la convenzione «committa in inglese». Vale la pena un controllo periodico: tradurre da una sorgente sbagliata propaga l'errore in dodici lingue.
- **Qualità della traduzione automatica del changelog:** le 410 voci tradotte oggi con `translategemma:12b` in locale hanno richiesto 50 ripristini di prefisso e 7 correzioni a mano. La voce 36 perdeva i riferimenti a file in **nove lingue su undici**. Le voci con percorsi di file in mezzo alla prosa vanno scritte a mano.
- **`de` capitalizza lo scope dei commit** (`✨ Feedback:` invece di `✨ feedback:`) in 12 voci preesistenti. Non toccato: potrebbe essere una scelta di quel file. Da decidere.

## Fonti

- [Gemini API — pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Gemini 3.7 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash) · [Gemini 3 developer guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [DeepSeek — pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [OpenAI — API pricing](https://developers.openai.com/api/docs/pricing)
- [Mistral — API pricing](https://mistral.ai/pricing/api)

## Prove nel repo

- `docs/maintenance/2026-08-23-il-sito-sovrascrive-i-prezzi.md` — la trappola del merge remoto, i prezzi verificati, il limite della chiave unica per provider
- `docs/maintenance/2026-08-23-changelog-v1-16-0-disallineato.md` — il disallineamento degli indici, il gate che lo certificava, i difetti misurati della traduzione automatica

PR di giornata: [#115](https://github.com/rouges78/GameStringer/pull/115) · [#116](https://github.com/rouges78/GameStringer/pull/116) · [#117](https://github.com/rouges78/GameStringer/pull/117) · [#118](https://github.com/rouges78/GameStringer/pull/118) · [#119](https://github.com/rouges78/GameStringer/pull/119) · [#120](https://github.com/rouges78/GameStringer/pull/120) · [#121](https://github.com/rouges78/GameStringer/pull/121)
