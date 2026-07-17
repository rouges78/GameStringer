# Anti-Piracy Policy — GameStringer

> **Principio non negoziabile:** GameStringer **non distribuisce contenuti dei
> giochi**. L'app genera e applica **patch/diff di traduzione** sui file che
> l'utente **già possiede legalmente**. Non fornisce, non ospita e non aiuta a
> ottenere copie dei giochi, asset originali o testi sorgente redistribuibili.

Questo documento è la versione estesa di quel principio. È scritto per essere
citabile ovunque (README, sito, in-app, Patch Hub).

## Cosa fa GameStringer

- **Traduce file che possiedi.** L'estrazione, la traduzione e il patching
  avvengono in locale, sui file di un gioco **installato sul tuo computer**.
- **Produce diff, non copie.** L'output è una patch/traduzione (il *target*),
  non una redistribuzione del testo *sorgente* del gioco.
- **Ti chiede conferma di possesso.** Prima di avviare il flusso su un gioco,
  l'app richiede la conferma che tu ne possieda una **copia legale**.

## Cosa GameStringer NON fa

- ❌ Non distribuisce eseguibili, asset, ROM o file di gioco.
- ❌ Non aggira DRM, protezioni anti-copia o anti-manomissione.
- ❌ Non ospita testi originali dei giochi come contenuto redistribuibile.
- ❌ Non incoraggia né facilita la pirateria in nessuna forma.

## Patch Hub — solo traduzioni, non testo originale

I pacchetti condivisi (`.gspack`) sul Patch Hub devono contenere **solo
traduzioni/mapping**, non grandi blocchi di testo originale del gioco (che
sarebbe redistribuzione di materiale protetto).

Questo è imposto **tecnicamente**: al momento della pubblicazione, un
controllo automatico (*redistribution guard*) analizza il pacchetto e **rifiuta**
quelli che appaiono per lo più composti da testo originale non tradotto
(rapporto di traduzione troppo basso, glossari "verbatim", contenuto
"source-heavy"). I falsi positivi si risolvono con revisione manuale.

Vedi anche: [`PACK_INTEGRITY.md`](PACK_INTEGRITY.md) (firma/integrità dei pack)
e [`DMCA.md`](DMCA.md) (procedura di rimozione).

## Rispetto dei titolari dei diritti

Se sei un editore o titolare dei diritti e ritieni che un contenuto sul Patch
Hub violi i tuoi diritti, usa la **procedura DMCA/takedown** descritta in
[`DMCA.md`](DMCA.md). Rispondiamo alle segnalazioni valide e manteniamo un
registro pubblico delle rimozioni. Dove esiste una localizzazione ufficiale,
incoraggiamo l'uso di quella e possiamo inserire il titolo in una whitelist.

## Responsabilità dell'utente

L'uso di GameStringer implica il rispetto delle leggi applicabili e dei termini
di licenza dei giochi tradotti. La traduzione per uso personale su una copia
legittima è generalmente tollerata in molte giurisdizioni, ma **non costituisce
un diritto garantito ovunque**: la responsabilità dell'uso resta dell'utente.
Questo documento non è consulenza legale.

_Ultimo aggiornamento: 2026-07-15._
