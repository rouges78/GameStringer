# 99 file che nessuno importa — 26/07/2026

Terzo episodio della stessa storia, in un'altra lingua. Il 25/07 il difetto era un
`invoke` verso un comando inesistente; il 26/07 mattina erano tre moduli Rust mai
dichiarati in `mod.rs`, quindi mai compilati
([dettaglio](2026-07-26-moduli-rust-orfani.md)). Restava una domanda: quanto è esteso
lo stesso fenomeno nel frontend?

**99 file su 606, cioè il 16%, non sono raggiunti da nessun import. 31.694 righe.**

## La prova che non è un'astrazione

Il 25/07 sono state corrette sei righe in
`components/notifications/notification-provider.tsx` — rimozione di due chiamate
`window.__TAURI__.tauri.invoke` irraggiungibili. Quel file è 562 righe, e
`components/providers.tsx` porta il commento: «Rimosso NotificationProvider per
semplificare». Il provider è stato staccato dall'albero e il file è rimasto lì.
Abbiamo passato del tempo a sistemare codice che non gira.

Non è un caso isolato. `lib/steam-utils.ts` (1.031 righe), `lib/voice/speech-to-text.ts`
(697), `lib/patchers/unreal-pak-parser.ts` (585), `lib/patch-manager.ts` (537),
`lib/file-watcher.ts` (471) sono tutti nomi che uno leggerebbe pensando «ah, quello
c'è già» — ed è il modo esatto in cui il codice morto costa la seconda volta.
`app/components/providers.tsx` è perfino un doppione orfano di
`components/providers.tsx`.

## Il gate

`scripts/check-dead-modules.js` + `npm run dead:check`, in CI accanto al gate i18n e a
quello dei comandi Tauri. Ratchet su `scripts/.dead-modules-baseline.json`: 99 morti
noti, la CI fallisce solo se ne compare uno **nuovo** — così il debito può soltanto
scendere. Fallisce anche se una voce di baseline è stata risolta senza aggiornare il
file, altrimenti la baseline marcisce.

```bash
npm run dead:check           # verifica (esce 1 se c'è del nuovo)
npm run dead:check:report    # elenco completo, ordinato per righe
npm run dead:check:update    # accetta il nuovo stato come baseline
```

Verificato con tre prove prima di consegnarlo: un modulo nuovo non importato fa
uscire 1; lo stesso modulo, una volta importato, sparisce dall'elenco; una voce di
baseline che non corrisponde più fa uscire 1.

### Tre bug trovati scrivendolo

Vale la pena raccontarli, perché sono il tipo di errore che rende inutile uno strumento
di analisi:

1. **I barrel di puro re-export venivano saltati.** Per velocità il ciclo scartava i
   file che non contengono la parola `import` — ma `components/forum/index.ts` contiene
   solo `export { X } from './x'`. Risultato: i tre componenti del forum (1.604 righe,
   vivissimi, usati da `app/community-hub/page.tsx`) risultavano morti. Il filtro ora
   guarda `from`. Se non l'avessi controllato a mano, il primo uso dello strumento
   avrebbe cancellato il forum.
2. **L'euristica delle menzioni contava i fratelli.** `lib/social/community-hub.ts`
   risultava «citato 11 volte» perché la ricerca testuale trovava
   `community-hub-service` e `community-hub-backend`, che sono altri file. Ora il
   carattere successivo deve chiudere il path.
3. **I moduli coperti solo dai test risultavano morti.** I file `*.test.ts` erano
   esclusi dalle sorgenti, quindi i loro import non contavano.
   `lib/patchers/unreal-pak-parser.ts` — 585 righe con un test a fixture
   *indipendente dal parser*, scritto apposta per congelare il formato Unreal —
   compariva nell'elenco come se fosse da buttare. Cancellarlo avrebbe fatto
   fallire la suite. Ora quei moduli sono marcati **`SOLO-TEST`**: ce ne sono
   **cinque** (`unreal-pak-parser`, `use-tutorial-trigger`, `utils/fuzzy-search`,
   `notification-indicator`, `api-schemas`) e sono una categoria a sé — non usati in
   produzione, ma non cancellabili senza toccare i test.

Tre bug in uno strumento di un centinaio di righe, tutti trovati verificando a mano
i risultati invece di fidarsi dell'output. Vale come promemoria: un'analisi statica
appena scritta è un'ipotesi, non un verdetto.

## Limiti da conoscere prima di cancellare

- Un import costruito a runtime (`import(\`@/components/${name}\`)`, un registry che
  mappa stringhe a componenti) **non è risolvibile staticamente**. Per questo ogni voce
  riporta quante volte il suo percorso appare come testo altrove: se il numero è > 0,
  si verifica a mano.
- Gli entry point di Next (`page`/`layout`/`route`/…) sono esclusi: li carica il
  framework. I tre file in `app/` che restano nell'elenco non sono entry point, sono
  utility e componenti annidati.
- Lo strumento dice «nessuno lo importa», **non** «è inutile». La domanda da farsi resta
  quella del 26/07 mattina: *la funzione che promette esiste già altrove?* Se sì, si
  cancella; se no, forse va collegato — ed è il caso più interessante, perché è una
  funzione che credevi di avere e non hai.

## Da dove potare

Raggruppati per cartella, in ordine di peso. Non è una lista di cancellazioni: è
l'ordine in cui conviene guardare, un gruppo per volta, decidendo caso per caso fra
collegare e cancellare.

| File | Righe | Cartella |
|---:|---:|---|
| 30 | 10.258 | `lib/` |
| 23 | 7.888 | `components/` |
| 6 | 1.167 | `hooks/` |
| 3 | 1.149 | `components/translator/` |
| 3 | 1.005 | `lib/notifications/` |
| 3 | 932 | `components/tools/` |
| 2 | 926 | `components/admin/` |
| 2 | 847 | `lib/ai/` |

Il resto sono gruppi da uno o due file. Due candidati naturali per cominciare, perché
sono coerenti e autoconclusi:

- **il sistema notifiche** — `components/notifications/notification-provider.tsx` +
  `lib/notifications/notification-stack-manager.ts` +
  `notification-queue-manager.ts` e affini: circa 1.700 righe di un'architettura che
  `providers.tsx` dice di aver rimosso. Qui la domanda «esiste già altrove?» ha una
  risposta chiara: sì, le notifiche funzionano senza di essa.
- **`app/components/`** — due file, 79 righe, di cui un doppione di `providers.tsx`.
  Cancellazione senza rischi e toglie un tranello da un percorso che sembra
  autorevole perché sta sotto `app/`.
