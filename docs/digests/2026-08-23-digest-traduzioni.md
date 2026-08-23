# Digest Traduzioni Videogiochi — 23 agosto 2026

> **Questo non è uno scan di novità: è una verifica delle azioni consigliate dal digest precedente.** Su quattro voci, **tre avevano la premessa sbagliata** e sono state chiuse senza scrivere codice. La quarta era giusta, e tirando quel filo sono emersi quattro difetti che nessun digest aveva visto:
>
> 1. il sito rimetteva in circolo i prezzi vecchi su **tutte** le installazioni
> 2. quattro lingue del changelog v1.16.0 non erano **mai** state tradotte
> 3. il download di IPA dava **404 per un trattino**, e con esso tutto il percorso Unity 5.0-5.5
> 4. tre punti del codice mandavano l'utente a tool esterni per lavori che l'app ora fa da sola — uno verso una rotta **inesistente**
>
> I difetti 1, 3 e 4 hanno la stessa forma: **una cosa cambia, e ciò che la descrive resta indietro.** Il prezzo dopo il cambio di modello, il nome del file dopo il rename, il consiglio dopo che l'app ha imparato a fare quel lavoro. Nessuno dei tre sarebbe emerso controllando i numeri di versione.
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

## 🛠 Stato tool — ricontrollato oggi dopo sette settimane

Tutte le versioni pinnate sono **ancora le ultime upstream** (verificate via API GitHub):

| Tool | Upstream | Nel progetto | Stato |
|---|---|---|---|
| XUnity.AutoTranslator | v5.6.1 (19/04/2026) | v5.6.1 | ✅ |
| BepInEx 5.x | v5.4.23.5 (08/02/2026) | v5.4.23.5 | ✅ |
| BepInEx 6.x | v6.0.0-pre.2 (27/08/2024) | v6.0.0-pre.2 | ✅ pre.3 mai uscita, la pre.2 ha **due anni** |
| BepInEx Legacy | v5.4.11 | v5.4.11 | ✅ pin voluto per Unity 5.6 |
| IPA | 3.4.1 (2018, ultima in assoluto) | 3.4.1 | ⚠️ vedi sotto |
| TMP_Font_AssetBundles | resta su v5.5.0 (128MB) | v5.5.0 | ✅ la v5.6.1 non lo spedisce, l'assunto regge |
| MelonLoader | v0.7.3 (14/05/2026) | non hardcoded | n/a |

### ⚠️ Un URL rotto, trovato solo perché non mi sono fermato ai numeri di versione

Le versioni erano tutte giuste, quindi un controllo sui numeri avrebbe detto «tutto a posto». Ho fatto una `HEAD` su **tutti e tredici** i download hardcoded di `unity_patcher.rs`, e uno rispondeva **404**:

```
const IPA_URL = ".../3.4.1/IPA-3.4.1.zip"   ← trattino
l'asset si chiama       IPA_3.4.1.zip       ← underscore
```

Un carattere. Il tag `3.4.1` esiste, il numero di versione è corretto, e la release ha 291.628 download: solo il nome del file era sbagliato. Risultato: **l'intero percorso IPA — Unity 5.0-5.5 — falliva il download a ogni tentativo.** È un ramo raro, ed è per questo che nessuno se n'era accorto.

Corretto, e reso resistente: ora l'asset si risolve dall'API GitHub con `resolve_gh_asset`, come già si faceva per XUnity poche righe sotto, con l'URL giusto come fallback. Se viene rinominato di nuovo, si aggiusta da solo.

**Lezione per i prossimi digest:** «versione allineata» non vuol dire «download funzionante». Sono due controlli diversi, e solo il secondo prova qualcosa.

### Tool linkati senza pin di versione

Non sono scaricati dall'app, sono link per l'utente. Tre si sono mossi da quando erano stati guardati:

| Tool | Ultima release | Nota |
|---|---|---|
| gdsdecomp | **v2.6.4 (12/08/2026)** | mossa 11 giorni fa — rilevante, il Godot `.pck` è appena entrato in produzione |
| UndertaleModTool | **0.9.1.2 (13/07/2026)** | rilevante, il lavoro GameMaker è attivo |
| UAssetGUI | v1.1.0 (01/05/2026) | |
| UnrealLocres | 1.1.1 (2021) | fermo da anni, ma stabile |
| unrpa | 2.3.0 (2019) | **link rimosso oggi** — il Ren'Py `.rpa` è nativo dalla v1.17.0 |
| DRV3-Sharp | **nessuna release** | **link rimosso oggi** — solo sorgente, niente da scaricare |

### 🔗 I due link tolti, e i tre puntatori rotti che c'erano dietro

DRV3-Sharp non ha **nessuna release**: chi seguiva quel link non trovava niente. unrpa è fermo al 2019 e l'app legge i `.rpa` da sola dalla v1.17.0. Tolti entrambi.

Ma cercare quei due nomi nel codice ne ha trovati **cinque punti, non due**, e due erano peggio di un link morto:

- **Il ramo Danganronpa di `check_game_engine` elencava DRV3-Sharp come unico tool** e diceva «usa tool specifici per Danganronpa». Togliere solo il link avrebbe lasciato una lista vuota sotto un messaggio che si arrende — per un gioco che l'app traduce end-to-end dalla v1.17.0. Ora rimanda al patcher interno.
- **Una voce instradava a `/danganronpa-tools`, rotta che non esiste.** La pagina è `/danganronpa-patcher`, come dicono da sempre menu, `tools-registry` e `wizard-strategies`. Chi cliccava finiva su un **404**.
- `universal_injector` elencava UnRPA fra i `tools_required` e una nota diceva «usa unrpa per estrarre».

Tenuto invece il commento in `rpa_extractor.rs` che cita UnRPA: dice «senza dipendere da UnRPA/Python», cioè spiega *perché* l'estrattore nativo esiste. È un'affermazione, non un puntatore.

**Il filo comune con il resto della giornata:** il codice impara a fare una cosa da solo, e le indicazioni che mandano l'utente altrove restano indietro. Il patcher Danganronpa e l'estrattore `.rpa` erano nella 1.17.0 da una settimana, ma tre punti del codice rimandavano ancora fuori.

## 📝 Cose non verificate / da controllare manualmente

- **Sezioni RSS, traduzioni amatoriali ITA, localizzazioni ufficiali:** non scansionate oggi. Il prossimo digest deve rifarle da zero, non ereditarle da qui.
- **BepInEx 6.0.0-pre.2 ha due anni** (27/08/2024) e resta l'ultima pre-release. Non è un problema oggi, ma è il pin più vecchio che l'app scarica: se il progetto upstream fosse fermo, i giochi IL2CPP recenti avranno bisogno di un'altra strada.
- **Altre rotte in `route:` non sono state verificate.** `/danganronpa-tools` era un 404 trovato per caso, mentre toglievo un link nello stesso blocco. Nessuno ha controllato le altre: vale una passata che confronti ogni `route:` del Rust con `routes.d.ts`, come è stato fatto oggi per gli URL di download.
- **Altri tool esterni consigliati non sono stati passati al setaccio.** Oggi sono stati guardati quelli citati in `unity_patcher.rs`; `tools-registry.ts`, `wizard-strategies.ts` e le pagine per-motore ne elencano altri, e nessuno sa se puntano ancora a qualcosa di vivo.
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

| PR | Cosa |
|---|---|
| [#115](https://github.com/rouges78/GameStringer/pull/115) | Il sito smette di rimettere i prezzi vecchi |
| [#116](https://github.com/rouges78/GameStringer/pull/116) | La sezione "Novità" racconta la 1.17.0, 12 lingue |
| [#117](https://github.com/rouges78/GameStringer/pull/117) | Ultimi tre prezzi verificati, Mistral era 4× alto |
| [#118](https://github.com/rouges78/GameStringer/pull/118) | Default Gemini a 3.7 Flash |
| [#119](https://github.com/rouges78/GameStringer/pull/119) | Changelog v1.16.0 riallineato e tradotto |
| [#120](https://github.com/rouges78/GameStringer/pull/120) | `translateArray` bisezione, invece di perdere la lingua |
| [#121](https://github.com/rouges78/GameStringer/pull/121) | Mistral: una verità sola in tre punti |
| [#122](https://github.com/rouges78/GameStringer/pull/122) | Questo digest |
| [#123](https://github.com/rouges78/GameStringer/pull/123) | URL IPA a 404 per un trattino |
| [#124](https://github.com/rouges78/GameStringer/pull/124) | Tolti DRV3-Sharp e unrpa, corretta una rotta a 404 |
