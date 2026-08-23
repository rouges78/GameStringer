# Digest Traduzioni Videogiochi — 23 agosto 2026

> **Questo non è uno scan di novità: è una verifica delle azioni consigliate dal digest precedente.** Su quattro voci, **tre avevano la premessa sbagliata** e sono state chiuse senza scrivere codice. La quarta era giusta, e tirando quel filo sono emersi **sette** difetti che nessun digest aveva visto:
>
> 1. il sito rimetteva in circolo i prezzi vecchi su **tutte** le installazioni
> 2. quattro lingue del changelog v1.16.0 non erano **mai** state tradotte
> 3. il download di IPA dava **404 per un trattino**, e con esso tutto il percorso Unity 5.0-5.5
> 4. tre punti del codice mandavano l'utente a tool esterni per lavori che l'app ora fa da sola
> 5. **nove rotte interne** portavano a pagine che non esistono — la prima trovata per caso, le altre otto cercandole
> 6. **sette link esterni** erano rotti — quattro al primo giro (fra cui il download di UABEA, primario *e* fallback, e il nostro stesso dominio scritto `.app` invece di `.ai`), altri tre trovati solo dalla passata di conferma
> 7. **i cataloghi raccomandavano software che non esiste e requisiti che non servono** — due tool fantasma, uno col punteggio più alto della sua categoria, e un «Python 3.x» che nessun percorso ha mai invocato
>
> I difetti 1, 3, 4, 5 e 6 hanno la stessa forma: **una cosa cambia, e ciò che la descrive resta indietro.** Il prezzo dopo il cambio di modello, il nome del file dopo il rename, il consiglio dopo che l'app ha imparato a fare quel lavoro, il puntatore dopo che la pagina è stata rinominata.
>
> E si somigliano anche nel modo in cui sono venuti fuori: **controllando che una cosa *funzioni*, non che il suo numero sia giusto.** Il prezzo verificato sul listino invece che sull'etichetta, l'URL con una `HEAD` invece che con il tag, la rotta contro le pagine reali invece che contro il nome. Un controllo sulle versioni li avrebbe dichiarati tutti a posto.
>
> **Il settimo è di un'altra specie, e va guardato a parte.** Gli altri sei erano cose vere che hanno smesso di esserlo. Le voci fantasma dei cataloghi **non sono mai state vere**: nessun rename le ha rese sbagliate, sono nate così. E non lasciano traccia quando falliscono — un link morto almeno dà 404; un nome senza URL manda l'utente a cercare qualcosa che non esiste, e un requisito inventato come «Python 3.x» gli fa installare software per niente. In entrambi i casi, in silenzio.
>
> ⚠️ **RSS** e **traduzioni amatoriali** sono state scansionate a fine giornata e stanno più sotto. Le **localizzazioni ufficiali** restano assenti: nessuno le ha cercate, e riempirle a memoria le renderebbe indistinguibili da dati veri.

## ✅ Le azioni consigliate, verificate una per una

| Azione del digest | Esito |
|---|---|
| «Autorizzare il connettore GitHub, senza cui la verifica del lavoro non taggato resta cieca» | **Premessa sbagliata.** `gh` è già autenticato in locale (`rouges78`, scope `repo`). Il buco esiste solo per l'agente cloud. Verifica fatta: 20 commit del 22/08, tutti su `origin/main`, PR #106→#114; nulla di non pushato |
| «Taggare v1.15→v1.17, così che chi arriva dal sito non riceva la v1.14.0» | **Premessa sbagliata.** Le tre versioni erano già taggate **e pubblicate come Release**, con la v1.17.0 come `Latest`. `releases/latest` serviva già la 1.17, e il sito citava già v1.17.0 |
| «Validare i nuovi modelli provider e aggiornare preset e tabella» | **Corretta.** Fatta — ed è il filo che ha portato a tutto il resto |
| «Rilevamento Ollama e traduzione UI russa restano i temi più citati» | **Premessa sbagliata.** **Zero issue aperte.** Ollama (#49, #52) e russo (#47, #50) risultano tutte chiuse. Il russo misurato: 0 chiavi mancanti, 7220/7515 in cirillico |

**Da correggere in chi genera il digest:** tre voci su quattro derivavano da uno stato non riletto. Vale la pena verificare tag, Release e issue aperte *prima* di proporli come azione, altrimenti il digest genera lavoro che non esiste.

## 🔥 I due difetti più gravi

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

### 🧭 La passata sulle rotte: `/danganronpa-tools` non era sola

Quel 404 era saltato fuori **per caso**. Cercando di proposito, ne sono uscite **altre otto**:

| Rotta morta | Dove | Corretta in |
|---|---|---|
| `/godot-patcher` | `unity_patcher.rs` | `/godot-translator` |
| `/gamemaker-patcher` | `unity_patcher.rs` | `/translation-wizard` |
| `/kirikiri-patcher` · `/nscripter-patcher` · `/construct-patcher` | `unity_patcher.rs` | `/injector` |
| `/crawler` (×3) | command palette, ricerca globale, guida | `/context-harvester` |

Le cinque pagine per-motore **non sono mai state costruite**. Le tre `/crawler` sono rimaste dopo la rinomina della pagina in `/context-harvester` — e l'etichetta diceva già `nav.contextHarvester`: la pagina era stata rinominata, i puntatori no.

Destinazioni verificate, non indovinate: `/injector` monta `UniversalInjector` che elenca Kirikiri e NScripter per nome; `/godot-translator` tratta i `.pck`; `/translation-wizard` copre `gamemaker-data`, che è `canDoInline` — la pagina GameMaker dedicata non esiste e non doveva esistere.

**Due falsi positivi lasciati stare:** `/auth` è un prefisso in `route-config.ts`, `/tesseract` è la cartella di asset in `public/` passata a tesseract.js. Esclusi per nome nel gate, con il motivo accanto, così nessuno li "sistema" al prossimo giro.

**Perché nessuno se n'era accorto:** una rotta sbagliata non rompe la build, non rompe i tipi e non rompe i test. Rompe solo il clic dell'utente. Per questo ora c'è `__tests__/lib/route-integrity.test.ts`, che confronta ogni `route:` del Rust e ogni `href`/`path` interno del TS con le pagine reali sotto `app/`. Verificato che morda: reintrodurre `/danganronpa-tools` lo fa diventare rosso indicando file e riga.

Vale come metodo, non solo come fix: **oggi tre difetti su quattro sono stati trovati controllando che una cosa *funzioni*, non che il suo numero sia giusto.** Il prezzo verificato sul listino invece che sull'etichetta, l'URL con una `HEAD` invece che con il tag, la rotta contro le pagine reali invece che contro il nome.

### 🌐 I link esterni: 318 URL, quattro rotti

Estesa la stessa `HEAD` a tutti i link esterni del frontend e del Rust, non solo a quelli di `unity_patcher.rs`.

| Link | Problema | Corretto in |
|---|---|---|
| `UABEAvalonia-windows-x64.zip` | UABEA ha rinominato gli asset — **404** | `uabea-windows.zip` |
| `UABEAvalonia.zip` (fallback) | stesso — **404** | pinnato su `v8/uabea-windows.zip` |
| `github.com/GameStringer` | manca l'owner — **404** | `github.com/rouges78/GameStringer` |
| `gamestringer.app` (×3) | il dominio non risolve | `gamestringer.ai` |

**UABEA è il bug IPA una cartella più in là:** primario *e* fallback entrambi a 404, quindi il download del tool falliva sempre. Il primario ora segue `/latest/`, il fallback è pinnato su `v8` — un prossimo rename lascia una via viva invece di due morte.

Due dettagli che rendono questi due peggiori di quanto sembrino:

- `github.com/GameStringer` **finisce nell'intestazione di ogni `.po` generato**, quindi il link rotto viaggia dentro il file consegnato all'utente.
- Due delle tre occorrenze di `gamestringer.app` sono l'`HTTP-Referer` mandato a **OpenRouter**, che lo usa per l'attribuzione: il traffico dell'app veniva accreditato a un dominio inesistente.

**La maggior parte dei "fallimenti" non lo era**, e vale la pena scriverlo o la prossima passata li reinvestiga tutti:

- **403** da NexusMods, itch.io, Epic, IGN, ko-fi, howlongtobeat → bot protection, non link morti
- URL che finiscono in `$`, `?id=`, `key=`, `domain=` → prefissi catturati a metà dal regex, si compongono a runtime
- `libretranslate.com` dà **405** perché accetta solo POST; `translate.googleapis.com` dà **429** perché è rate-limited. Funzionano entrambi.

### 🔁 La passata di conferma ha trovato altro — e un difetto nel metodo

Rilanciate a fine giornata entrambe le passate, per verificare che il lavoro tenesse. **Le rotte sono pulite**: gate 24/24 e passata indipendente su 161 riferimenti, con soli i due falsi positivi noti.

Ma rileggendo l'output dei link è saltato fuori un difetto **nel modo di cercare**, non nel codice:

> **Steam risponde `404` a `HEAD` e `200` a `GET`.**
> Quattordici link a guide Workshop erano stati dichiarati morti, ed erano sani.

Rifatti tutti i sospetti con `GET`, che ha assolto anche Rockstar Social Club (302) e le pagine password di Amazon ed EA (protette dai bot). **Chi rilancia questa passata usi `GET`, non `HEAD`.**

Quello che è sopravvissuto al filtro era invece reale:

| Difetto | Dettaglio |
|---|---|
| `fireworks.ai/account/api-keys` **spostato** | ora è `app.fireworks.ai/settings/users/api-keys`. Due punti puntavano al vecchio, incluso il pannello Impostazioni dove l'utente va a prendersi la chiave |
| **due feed RSS attivi con il feed a 404** | `romhackplaza` (nessun feed su `/feed`, `/rss`, `/feed.rss`) e `ctrltrad` (è un *profilo* itch.io: `devlog.rss` esiste per le pagine **gioco**, non per i profili). Entrambi i siti rispondono 200, quindi da fuori non sembrava rotto niente |

Disattivati con il motivo scritto dentro, come le altre voci morte di quel file. E controllati i **14 feed rimasti attivi: rispondono tutti 200.**

**È la seconda volta oggi che rifare un controllo con un metodo migliore cambia il risultato** — la prima è stato il rilevatore di chiavi orfane, che contava 1601 invece di 905. Una passata non vale più del metodo che usa, e il metodo va scritto accanto al risultato.

### 🔧 I tre tool che aspettavano una decisione, decisi

| Tool | Stato | Deciso |
|---|---|---|
| `github.com/rgss-decryptor` | malformato, manca l'owner | **`usagirei/RGSS-Decryptor`** — 38★, non archiviato, con release e asset, descrizione che combacia |
| `rpgmakertrans.bitbucket.io` | sparito | **Translator++** dove serviva davvero un tool esterno |
| MTool (`amanatsu.booth.pm`) | 404 | **fuso** nella voce Translator++ |

**Perché MTool è stato fuso invece che ripuntato:** metterci Translator++ avrebbe prodotto due voci con lo stesso nome e lo stesso URL, distinte solo da un flag `compatible` che era la negazione esatta dell'altro. Una sola sarebbe mai risultata compatibile. Verificato prima che la fusione fosse onesta: Translator++ copre XP, VX, VX Ace, MV **e** MZ, cioè l'intero arco che le due voci coprivano insieme.

**E di nuovo, togliere il link non bastava.** Altri **nove** punti nominavano ancora RPG Maker Trans: entrambe le voci `InjectionTool` (una nel ramo MV/MZ, dove era l'unico tool elencato), la stringa del metodo, una nota, uno step, una mappatura motore→tool, il messaggio dell'engine-check, i `requirements` del wizard che promettevano «link fornito», e il catalogo di `prediction_tool` che gli dava **90 di compatibilità**. Lasciarli avrebbe nominato un tool senza più nessun posto da cui prenderlo.

Dove l'app fa il lavoro da sola la prosa ora lo dice: RPG Maker VX/Ace è `canDoInline`, quindi decriptato l'archivio si traduce dentro l'app.

**Un errore commesso per strada, che vale come avvertimento:** il primo tentativo di rimozione ha tolto 5 righe di un blocco da 6, lasciando un `},` orfano — Rust non compilabile. Il controllo verificava la riga di apertura ma non quella di chiusura. È così che è emersa anche la *seconda* voce RPG Maker Trans, che il primo passaggio aveva colpito al posto di quella giusta. `cargo check` va eseguito, non dato per scontato.

### 👻 Il catalogo raccomandava due tool che non esistono

Il catalogo di `prediction_tool.rs` non ha URL: porta nomi e **punteggi di compatibilità**, quindi la passata sui link non lo vedeva. Verificato voce per voce, tutte e tredici.

| Voce | Punteggio | Cosa dice la ricerca |
|---|---|---|
| **«Atlas»** | 88, *Freemium* | **zero** risultati su GitHub (`atlas+unreal+localization`, `atlas+locres`) e zero sul web. I tool locres per Unreal che esistono sono ue-localization-tools, LocRes-Builder, Easy Localization Tool |
| **«Ren'Py Translator Tools»** | 92, **il punteggio Ren'Py più alto della tabella** | nessun prodotto con quel nome. Esiste un «Ren'Py Translator **ToolKit**» (renpy-ttk), che è un'altra cosa |

**Questo difetto è di una specie diversa da tutti gli altri di oggi.** Gli altri erano puntatori invecchiati: qualcosa che era vero e ha smesso di esserlo. Questi due non sono mai stati veri. E sono peggio di un link morto, perché **un link morto fallisce visibilmente quando ci clicchi**, mentre un nome senza URL manda l'utente a cercare qualcosa che non troverà mai, senza che niente segnali l'errore.

**Toglierli era sicuro solo perché la voce dell'app era a sua volta sbagliata:** `GameStringer` dichiarava Unity, Ren'Py e RPG Maker, mentre l'app ha pagine e strategie per Unreal, GameMaker, Godot, Wolf RPG e Danganronpa, e dalla 1.17.0 ha tradotto un UE5 commerciale end-to-end. Corretta, così Unreal mantiene una raccomandazione — vera — dopo la sparizione di Atlas. Senza quella correzione, rimuovere il fantasma avrebbe rifatto l'errore DRV3-Sharp in un posto nuovo.

**Terza correzione:** la voce UABE è diventata UABEA. `SeriousCache/UABE` è archiviato dal 2023; `nesrak1/UABEA` è il successore ed è **quello che `unity_assets.rs` scarica davvero**. Stessa forma della correzione Mistral: il catalogo nomina una cosa, il codice ne esegue un'altra.

Verificati vivi e lasciati stare: UnrealPak, Translator++, WW2Ogg (`hcs64/ww2ogg`, 2024), Audacity, GIMP, Paint.NET, NSIS, Inno Setup, Photoshop.

### 📋 Gli ultimi due cataloghi, e un requisito che non è mai servito

`tools-registry.ts` è **pulito**: venti chiavi i18n tutte presenti in `en.json`, e gli `href` puntano a pagine interne già coperte dal gate delle rotte.

`wizard-strategies.ts` chiedeva due cose che non servono:

| Requisito | Realtà |
|---|---|
| **«Python 3.x»**, sulla strategia Unity CSV | `Command::new("python")` **non compare da nessuna parte** nel Rust, e l'unico `python` nel TypeScript è un filtro di esclusione percorsi. Quel percorso è Rust puro (`unity_csv.rs`) |
| **«gdsdecomp (link fornito)»** per Godot, con lo step «Estrae il .pck con gdsdecomp» | dalla v1.17.0 l'estrazione è **nativa**: `godot_patcher.rs` espone `scan_godot_pck` e `extract_godot_pck` come comandi Tauri |

**Chi leggeva la prima è andato a installare Python per niente.** È un difetto più insidioso di un link morto: non fallisce, costa solo tempo a qualcuno che non saprà mai di averlo sprecato.

I link a gdsdecomp restano: quel tool **decompila** progetti Godot, cosa che l'app non fa. È un extra vero, non il percorso — toglierlo sarebbe stato l'errore al contrario.

### 🔁 La firma che si è ripetuta cinque volte, e dove si era nascosta

Vale come cosa da cercare di proposito la prossima volta:

> **Una voce che descrive come si faceva un lavoro prima che l'app imparasse a farlo.**

Trovata in cinque posti diversi, tutti nati dopo la v1.17.0 e nessuno segnalato da build, tipi o test:

1. il ramo Danganronpa diceva «usa tool specifici» per un gioco tradotto end-to-end
2. `universal_injector` elencava UnRPA per i `.rpa`, letti nativamente
3. il wizard chiedeva gdsdecomp per i `.pck`, estratti nativamente
4. l'engine-check diceva «usa gdsdecomp per estrarre .pck»
5. il catalogo di `prediction_tool` dichiarava tre motori su nove per l'app stessa

Il codice avanza a ogni release; le frasi che lo descrivono no, e niente le controlla.

### 🕳️ Dove si nascondeva la prosa stantia: 744 stringhe che nessuno poteva leggere

Cercata la firma anche nella prosa viva delle pagine per-motore. **È pulita** — e il motivo è più interessante del risultato.

Le uniche quattro stringhe rimaste in tutto il progetto che rimandavano ancora a **gdsdecomp**, al **link UnRPA** e a **RPG Maker Trans** stavano tutte dentro `translationRecommendationComp`: **61 chiavi i18n che nessuna riga di codice referenzia**, più una orfana in `common`. Escluso anche l'accesso dinamico: gli unici template literal vicino a `t()` compongono messaggi di stato, non percorsi di chiave.

**62 chiavi × 12 lingue = 744 stringhe morte.** Rimosse.

Quindi la prosa viva non risultava pulita perché qualcuno avesse aggiornato la copia sbagliata, ma perché **la copia sbagliata era irraggiungibile**. Lasciata lì era una trappola travestita da lavoro finito: chi avesse ricollegato quel namespace avrebbe spedito un link morto e un tool scomparso, con l'aria di essere curati *perché tradotti in dodici lingue*.

Verificato invece che la prosa viva che nomina tool esterni sia **vera**: Translator++ per il `Game.dat` cifrato di Wolf RPG serve davvero, UABEA lo scarica l'app, e l'avviso Godot sui `.translation` binari (RSRC) corrisponde al codice — `godot_patcher.rs` non sa ancora leggerli e lo dichiara.

**Il gate i18n non poteva vederle:** verifica che una chiave *esista in tutte le lingue*, non che *qualcuno la usi*. Una chiave orfana è perfettamente in regola per quel controllo.

### 🔴 `main` è rimasto rosso per tredici PR, e il motivo è il tema di questa giornata

Il difetto peggiore commesso oggi non è nei dati: è nel modo di verificarli.

Nella PR #130 ho riscritto lo step di RPG Maker VX/Ace in «Decripta l'archivio RGSS, poi traduci dentro l'app» e, nello stesso commit, ho aggiornato l'attesa del test Rust a `"RGSS Decryptor"` — che il nuovo testo **non conteneva più**. Il test `inject_tool_based_engines_return_guidance` verifica che i motori bisognosi di un tool esterno lo **nominino** negli step (Kirikiri→GARbro, Wolf→Wolf Trans, RPGMakerVXAce→RGSS Decryptor, NScripter→nscript.dat).

Da lì in poi **`main` è rimasto rosso, e ci sono state fuse sopra altre tredici PR.**

**Perché nessuno se n'è accorto:** ogni modifica Rust della giornata è stata verificata con `cargo check`, che **compila ma non esegue niente**. `check-linux` e `frontend-checks` continuavano a passare perché nessuno dei due lancia la suite Rust. `check-windows` è il job che lo fa, e falliva da ore.

**È esattamente la firma che questo digest documenta dal primo paragrafo:** ho controllato che una cosa *compilasse*, non che *funzionasse*. La stessa distinzione fra leggere un numero di versione e fare una `HEAD` sull'URL, fra fidarsi di un'etichetta e guardare il listino. Applicata a me, e per tredici volte di fila.

**Correzione, non aggiramento:** ho rimesso il nome del tool nello step invece di allentare l'asserzione. Il test aveva ragione — gli archivi RGSS un decryptor esterno lo richiedono davvero, e quello step è l'unico posto in cui l'utente scopre quale. Toglierlo aveva peggiorato la guida, non solo fatto arrossare la CI.

**Chi l'ha preso:** non io e nessuno dei gate scritti oggi, ma la CI del progetto, che lo diceva da ore a chiunque guardasse. Nessuna passata sostituisce il guardare se il build è verde prima di fondere.

> **Regola per il prossimo giro: sul Rust `cargo check` non basta mai. Serve `cargo test --lib`, e serve guardare la CI prima di fondere — anche quando le modifiche sembrano solo testo.**

### 🔒 La regola non dipende più dalla disciplina di nessuno

La riga qui sopra era un buon proposito, e i buoni propositi hanno il difetto di reggere finché uno se ne ricorda. La sera stessa è emerso perché non bastava: **`check-windows` non era fra i check obbligatori del ramo `main`.** Nessuno era costretto ad aspettarlo — né io, né `gh pr merge --auto`, che infatti fondeva subito perché non c'era niente da attendere.

Sistemato nelle impostazioni del repository, non nel codice:

| Regola su `main` | Effetto |
|---|---|
| `required_status_checks: check-windows` | una PR non si fonde finché la suite Rust non è verde |
| `strict_required_status_checks_policy: true` | e non si fonde se il branch non è **aggiornato** con `main` |
| `bypass_actors: []` · `current_user_can_bypass: never` | nessuna scappatoia, per nessuno |

La seconda chiude il difetto gemello emerso lo stesso giorno: la PR #148 aveva la CI verde su un branch che **non conteneva il fix di `main`**, e il suo rosso non era suo — se lo portava dietro. Un `main` rotto non è un problema locale: si moltiplica per il numero di branch aperti in quel momento.

**Cosa costa:** quando `main` si muove mentre una PR è aperta, va aggiornata e la CI riparte. E le PR non si fondono più all'istante: `check-windows` impiega circa 12 minuti.

**Verificabile senza fidarsi della UI**, che è il modo in cui il problema è stato trovato — la pagina delle impostazioni sembrava a posto due volte, mentre l'API diceva che il ruleset non veniva modificato dal 5 agosto:

```bash
gh api repos/rouges78/GameStringer/rules/branches/main --jq '.[].type'
```

## 📡 Fonti RSS — tutte e 32 riverificate

Testate con **gli stessi header del fetcher Rust** (`rss_proxy.rs`: User-Agent Chrome, `Accept` per rss/atom/xml), perché in Tauri i feed non li scarica il webview ma Rust — quindi **il CORS non c'entra**, e una delle motivazioni storiche di disattivazione era sbagliata in premessa.

**Un feed era attivo e non poteva funzionare:** `oldgamesitalia` puntava all'RSS del *forum* Invision, che ora restituisce **HTML**. Corretto sul feed del sito (`/feed`), che risponde con 10 voci. Gli altri 13 attivi erano già a posto.

| Stato | Quanti | |
|---|---|---|
| attivi e funzionanti | **14 / 14** | dopo la correzione di `oldgamesitalia` |
| disattivati ma **funzionanti** | 9 | gamespot, eurogamer, pcgamesn, nintendolife, pushsquare, arstechnica, tomshw_it, retrorgb, dotesports |
| disattivati e ancora rotti | 9 | everyeye · multiplayer · theverge (404) · romhacking ×2 (403) · romhackplaza · ctrltrad (404) · **nexusmods** e **gamestranslator** (200 ma HTML) |

**Perché «200» non è un test valido**, e vale per chiunque rifaccia questa passata: NexusMods e GamesTranslator **rispondono 200 con una pagina HTML**, non con un feed. E cercare `<item>` non basta: gli **Atom** usano `<entry>`. Il criterio giusto è *XML valido **e** almeno una voce* — con quello, `tomshw_it` passa da «vuoto» a 20 voci.

### Fonti senza feed — verificate il 23/08, non agganciabili

Scritte qui perché **nessuno le riverifichi**: sono state provate, non dimenticate.

| Sito | Provati | Cosa manca |
|---|---|---|
| [traduzionegiochi.it](https://traduzionegiochi.it/) | `/feed` `/feed/` `/rss` → 404 | catalogo di patch amatoriali ITA gratuite, ~25 progetti con versione e data. Ottima fonte, ma solo a mano |
| [gamestringer.ai](https://gamestringer.ai/) | `/feed` `/feed.xml` `/rss.xml` `/atom.xml` `/blog` → 404 | **il nostro sito.** Otto pagine HTML statiche, nessun blog: non c'è niente da cui generare un feed senza costruirlo |

Sul nostro, in particolare: aggiungerlo come fonte richiederebbe **prima** generare un `feed.xml` (dal CHANGELOG o dalle release) e agganciarlo al deploy del sito. È lavoro, non configurazione — e finché non esiste, l'app non può mostrare le proprie novità nel pannello notizie.

## 🇮🇹 Traduzioni amatoriali ITA della settimana

Da [traduzionegiochi.it](https://traduzionegiochi.it/), lette il 23/08/2026:

| Data | Gioco | Versione |
|---|---|---|
| 22/08/2026 | **Phoenix Wright: Ace Attorney Trilogy** | v1.0 |
| 22/08/2026 | **Undertale** (Switch) | v1.0 |
| 22/08/2026 | Corpse Party: Book of Shadows | v1.2 |
| 22/08/2026 | Twisted Tower | v1.3.3 |
| 22/08/2026 | **Foolish Mortals** | v1.1 |
| 22/08/2026 | Shadows of the Afterland | v1.0 |
| 22/08/2026 | Wicked Seed | v1.0.1 |
| 22/08/2026 | Kemono Teatime | v1.1 |
| 22/08/2026 | Hariti | v1.1 |

**Da confermare, di provenienza più debole:** una ricerca web cita anche *STEINS;GATE RE:BOOT* v1.0 (20/08), *Breath of Fire IV* v1.2.0 e *Marvel's Guardians of the Galaxy: The Telltale Series* v2.0. Vengono da un riassunto di ricerca e **non da una pagina letta**: verificare prima di riportarli come fatti.

**Nota per GameStringer:** *Foolish Mortals* è un gioco **Visionaire**, motore che l'app tratta — ed è lo stesso titolo comparso oggi nei tombstone dei progetti dell'utente. Che ne esista una patch community v1.1 è utile a sapersi: è materiale di confronto per il percorso Visionaire.

## 📝 Cose non verificate / da controllare manualmente

- **Localizzazioni ufficiali: non cercate.** RSS e traduzioni amatoriali sono state fatte (vedi sopra), questa no. Il prossimo digest la rifaccia da zero, non la erediti da qui.
- **Le nove fonti riattivabili sono una decisione, non un fatto.** Funzionano, ma erano state disattivate anche per motivi editoriali (rumore, lingua, pertinenza): riaccenderle è una scelta di prodotto.
- **BepInEx 6.0.0-pre.2 ha due anni** (27/08/2024) e resta l'ultima pre-release. Non è un problema oggi, ma è il pin più vecchio che l'app scarica: se il progetto upstream fosse fermo, i giochi IL2CPP recenti avranno bisogno di un'altra strada.
- **`dnSpy` e `rpatool` sono archiviati upstream** (ultimo push 2020 e 2022). Funzionano ancora, ma nessuno li aggiorna più: se un giorno smettono, non arriverà una correzione.
- **Nessun gate copre link esterni e requisiti in prosa.** Si trovano solo rilanciando le passate a mano, come oggi: gli URL legherebbero la suite alla rete e ai 403 da bot protection, e la prosa non è verificabile meccanicamente.
- **Il rilevatore di chiavi orfane potrebbe avere un quarto buco.** Ne aveva tre noti e il terzo è emerso solo rompendo il build (vedi sotto). Ora sbaglia per eccesso di proposito, quindi qualche chiave morta sopravvive: è il prezzo scelto perché l'errore opposto si vede a schermo.
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

**31 PR fuse in giornata** dalla #115 alla #145, contate dopo la #145. Il numero sale ancora se il digest viene ritoccato: è per questo che accanto c'è il comando, e non va tenuto a mente.

```bash
gh pr list --state merged --limit 60 --json number,mergedAt --jq '[.[] | select(.mergedAt | startswith("2026-08-23"))] | length'
```

Nella tabella qui sotto ne mancano le ultime: **una riga che elenca le PR non può includere la PR che aggiunge quella riga.** Per il totale vale il comando, non l'elenco.

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
| [#125](https://github.com/rouges78/GameStringer/pull/125) | Digest aggiornato con i difetti sui tool |
| [#126](https://github.com/rouges78/GameStringer/pull/126) | Otto rotte morte corrette, più il gate che le tiene vive |
| [#127](https://github.com/rouges78/GameStringer/pull/127) | Digest aggiornato con la passata sulle rotte |
| [#128](https://github.com/rouges78/GameStringer/pull/128) | Quattro link esterni rotti, su 318 controllati |
| [#129](https://github.com/rouges78/GameStringer/pull/129) | Digest aggiornato con la passata sui link esterni |
| [#130](https://github.com/rouges78/GameStringer/pull/130) | RGSS Decryptor con il suo owner, RPG Maker Trans sostituito |
| [#131](https://github.com/rouges78/GameStringer/pull/131) | MTool fuso in Translator++: un tool copre entrambe |
| [#132](https://github.com/rouges78/GameStringer/pull/132) | Digest aggiornato con le tre decisioni sui tool |
| [#133](https://github.com/rouges78/GameStringer/pull/133) | Due tool inesistenti tolti dal catalogo |
| [#134](https://github.com/rouges78/GameStringer/pull/134) | Digest aggiornato con le voci fantasma |
| [#135](https://github.com/rouges78/GameStringer/pull/135) | Python e gdsdecomp non erano mai serviti |
| [#136](https://github.com/rouges78/GameStringer/pull/136) | Digest: chiusa l'ultima incognita, nominata la firma |
| [#137](https://github.com/rouges78/GameStringer/pull/137) | 744 stringhe i18n che nessuno poteva leggere |
| [#138](https://github.com/rouges78/GameStringer/pull/138) | Digest: dove si nascondeva la prosa stantia |
| [#139](https://github.com/rouges78/GameStringer/pull/139) | Gate sulle chiavi i18n orfane |
| [#140](https://github.com/rouges78/GameStringer/pull/140) | Digest: il gate orfane e cosa hanno in comune i tre |
| [#141](https://github.com/rouges78/GameStringer/pull/141) | 905 chiavi rimosse, dopo che il primo tentativo aveva tolto quelle sbagliate |
| [#142](https://github.com/rouges78/GameStringer/pull/142) | Digest: il gate che avevo scritto misurava male |
| [#143](https://github.com/rouges78/GameStringer/pull/143) | Passata di conferma: 3 difetti nuovi, e HEAD non basta |
| [#144](https://github.com/rouges78/GameStringer/pull/144) | Digest: la passata di conferma e il difetto nel metodo |
| [#145](https://github.com/rouges78/GameStringer/pull/145) | Conteggio PR che non invecchia |
| [#146](https://github.com/rouges78/GameStringer/pull/146) | Digest: conteggio portato a 31 e datato |
| [#148](https://github.com/rouges78/GameStringer/pull/148) | Il pulsante «Progetti» della home andava all'Editor |
| [#149](https://github.com/rouges78/GameStringer/pull/149) | `main` rosso da 13 PR: `cargo check` non esegue i test |

La **#147** (tombstone sulle card derivate) è aperta e non fusa: nata da una diagnosi che i dati dell'utente hanno poi smentito — le sue card erano `active`, non derivate, e il difetto era già chiuso nella v1.17.0. Resta un difetto reale ma diverso, da valutare a parte.

## 🚦 Gate aggiunti oggi

Tre difetti su sette non si ripeteranno in silenzio:

| Gate | Cosa impedisce |
|---|---|
| `__tests__/lib/route-integrity.test.ts` | una rotta interna che punta a una pagina inesistente |
| `__tests__/lib/i18n-orphan-keys.test.ts` | una chiave i18n che nessuna riga di codice legge |
| bisezione dentro `translateArray` | perdere 88 voci di changelog perché una sola non si traduce |
| `check-windows` obbligatorio su `main`, `strict: true` | fondere su un `main` rosso, o fondere un branch non aggiornato |

I primi tre **verificati mordendo**: reintrodotto il difetto originale, controllato che il test diventi rosso e indichi dove, poi ripristinato. Un gate verde su un repo già sistemato non prova niente.

Il quarto non è un test ma una **regola del repository** (vedi sopra), ed è l'unico che non dipende da qualcuno che si ricordi di eseguirlo.

Restano **senza gate** tre cose, e ognuna per un motivo diverso:

| Cosa | Perché non è gatabile |
|---|---|
| prezzi del catalogo | nessun test può sapere quanto costerà un modello domani |
| URL esterni | una passata in CI è fattibile (oggi ha trovato 7 difetti in due giri) ma legherebbe la suite alla rete, ai 403 da bot protection — un terzo dei fallimenti, e non sono difetti — e ai siti che rispondono diversamente a `HEAD` e a `GET`, come Steam |
| prosa e requisiti | «questa frase descrive ancora la realtà?» non è una domanda meccanica |

Le **chiavi i18n orfane** erano l'unica delle quattro davvero gatabile, e ora lo sono: `__tests__/lib/i18n-orphan-keys.test.ts`, baseline **zero**. Non una soglia decrescente: una regola. Una chiave che nessuno legge non entra.

Il rilevatore conta una chiave come usata in **tre** modi, e il terzo è costato caro:

1. **compare letterale** da qualche parte nel sorgente — non solo dentro `t()`. Le chiavi ci arrivano anche via variabile: `tools-registry` mette `nav.contextHarvester` in un campo `nameKey`, e il layout lo passa a `t()` più tardi.
2. **inizia per un prefisso costruito a runtime.** `main-layout` compone la chiave del changelog interpolando versione e indice: da sola, quella riga copre **551 chiavi** che nessuna ricerca letterale troverebbe mai.
3. **il suo namespace è raggiunto come oggetto.** Vedi sotto: è la regola che mancava.

Per il resto la risposta realistica è rilanciare le passate a mano ogni tanto, come oggi.

### 💥 Il gate che ho scritto misurava male, e l'ho scoperto rompendo il build

La prima versione del rilevatore contava **1601** orfane. Cancellandole tutte, il **typecheck si è rotto in 31 punti** su tre pagine. Il motivo:

```ts
const dash = translations[language]?.dashboard;
...
<span>{dash.noRecentActivity}</span>
```

La chiave **non compare mai come stringa**. Nessuna ricerca letterale la trova, e **nemmeno il controllo inverso del progetto** (`i18n-chiavi-risolvono.js`, che verifica che ogni `t()` risolva) può vederla: non c'è nessun `t()` da controllare. L'unico a saperlo era `tsc`.

Annullato, aggiunta la regola 3, e il conteggio vero è risultato **905** — non 1601. Il gate stava misurando male dal momento in cui l'ho scritto.

**La regola 3 marca vivo l'intero namespace**, quindi qualche chiave davvero morta sopravvive. È il verso giusto in cui sbagliare: una falsa «usata» costa una riga inutile in un JSON, una falsa «orfana» fa vedere all'utente il **nome grezzo della chiave** al posto di una frase.

Rimosse **905 chiavi × 12 lingue = 10.860 stringhe**. E il test di sanità ora asserisce che le tre chiavi che avevano rotto il build restino riconosciute: se la regola 3 si perdesse di nuovo, **il test fallisce prima che qualcosa venga cancellato, non dopo**.

**La lezione, che vale oltre l'i18n:** avevo scritto in questo stesso digest che la pulizia «non può essere meccanica». Avevo ragione per il motivo sbagliato — non per le chiavi da ricollegare, ma perché **lo strumento di misura era incompleto e nessuno dei controlli esistenti poteva dirlo**. È la terza volta oggi che un controllo certifica ciò che non riesce a vedere: il gate i18n sugli indici disallineati, quello sulle chiavi orfane, e ora il mio.

E c'è un quarto caso, di segno opposto e peggiore: **la CI vedeva benissimo** che `main` era rosso, e lo diceva da ore. Nessuno guardava (vedi la sezione sul `cargo check`). Un controllo che nessuno legge non è diverso da un controllo che non c'è.

**Cosa è cambiato oggi nella copertura, in una riga:** stamattina i gate verificavano che le cose *esistessero*; ora tre verificano che **servano a qualcosa** — le rotte puntano a pagine vere, le chiavi i18n hanno un lettore, e una traduzione che fallisce costa una voce invece di ottantotto.
