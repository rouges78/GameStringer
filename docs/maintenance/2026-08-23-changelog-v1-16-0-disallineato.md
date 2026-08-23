# Il changelog v1.16.0 era disallineato, non solo non tradotto

**Data:** 23/08/2026 · **Stato:** risolto

## Cosa sembrava

Un conteggio ingenuo diceva: «`ru`, `ja`, `pl`, `el` hanno 32 voci non
tradotte su 88». Sembrava un lotto interrotto a metà.

## Cos'era

Quelle quattro lingue avevano **90 voci invece di 88**, perché le voci 31 e 42
erano duplicate. Da lì in poi ogni indice scalava, quindi
`changelog.v1_16_0.40` puntava a **commit diversi a seconda della lingua**.

E lo sfasamento nascondeva il resto: dall'indice 33 in poi il confronto
indice-per-indice non combaciava mai, così le voci inglesi *sfasate* passavano
per tradotte. Tolti i duplicati e riallineati gli indici, il numero vero è
saltato fuori:

> **Quelle quattro lingue non erano mai state tradotte per la v1.16.0.
> Zero voci su 88, non 56.**

Coincide con la nota già presente in `scripts/release/translate-changelog.js`:
la traduzione della v1.16.0 si fermò il 06/08/2026 su un credito esaurito, e il
fallback scrive la sorgente inglese nella lingua che fallisce.

## Il gate passava perché il difetto lo nascondeva

`__tests__/lib/i18n-locale-integrity.test.ts` era **verde** prima della
riparazione e **rosso** subito dopo la riallineatura: l'italiano residuo esisteva
da sempre, ma stava a indici dove il confronto non lo cercava. Verificato
mettendo da parte le modifiche e rieseguendo il test.

Un gate che confronta per indice non protegge da un array disallineato: lo
certifica.

## La sorgente mentiva, di nuovo

`en.json` è la sorgente dichiarata, ma **9 voci erano scritte in italiano**,
perché i commit da cui nascono violavano la convenzione «committa in inglese».
Tradurre le altre lingue da lì avrebbe propagato l'italiano ovunque — lo stesso
errore che l'intestazione dello script già descrive per il caso opposto.

Nota: otto si trovano confrontando `en.json` con `it.json` (sono identiche). La
nona, la voce 31, sfugge a quel test perché `it.json` ne ha una versione
diversa. Un test di uguaglianza fra due file non basta a trovare la lingua
sbagliata dentro uno solo.

## `translateArray` è tutto-o-niente, e le riprove non servono

`ru` ed `el` fallivano il parse JSON dell'output del modello. Due dettagli
rendevano il guasto molto più caro di quanto dovesse essere:

1. **`translateArray` ritorna `null` se UN blocco fallisce.** Un blocco rotto su
   otto costava tutte e 88 le voci della lingua.
2. **`options: { temperature: 0 }` rende il guasto deterministico.** Tre passate
   di riprova sono fallite allo stesso byte (`position 511`, poi `865`). Le
   riprove erano fiato sprecato per costruzione.

Risolto con una **bisezione**: se un blocco fallisce lo si divide a metà e si
ritenta, fino alla singola voce. `ru` 88/88 e `el` 88/88, zero voci irriducibili.

**Proposta non applicata:** portare la bisezione dentro `translateArray`. Questo
guasto è già costato le traduzioni di una release intera due volte; finché la
funzione resta tutto-o-niente, costerà una terza.

## Cosa il modello sbaglia, misurato

Tradotte 410 voci con `translategemma:12b` in locale (stessa pipeline della
release). Difetti trovati con controlli verificabili, non a naso:

| Difetto | Quanti | Come risolto |
|---|---|---|
| lingua intera non tradotta | 176 | bisezione |
| scope del commit tradotto o ricapitalizzato (`deps` → `zależności`, `sci` → `SCI`) | 50 | ripristino meccanico da `en.json` |
| identificatori persi (`data.win`, `scripts/gm-strg-probe.js`, `source_hash`) | 7 | riscritti a mano |

Il caso peggiore è la voce 36: perdeva i riferimenti in **nove lingue su
undici**, incluse `it`, `zh` e `ko` che nessuno aveva toccato. Non è sfortuna: è
una frase con due percorsi di file in mezzo a prosa tecnica, e ogni modello ci
inciampa. Le voci così vanno scritte a mano.

**Lasciati di proposito:** `settings/checkpoints/projects` (voce 43) e
`masquerade/inspection/verdict` (voce 53) tradotti a parole. Sono categorie
descrittive nella prosa originale, non percorsi: tradurle è legittimo.

## Come verificare

```bash
node -e "for(const l of ['en','it','es','fr','de','pt','pl','ru','ja','zh','ko','el']){const d=require('./lib/i18n/locales/'+l+'.json').changelog.v1_16_0;console.log(l,Object.keys(d).length)}"
```

Devono essere 88 ovunque. Se una lingua ne ha di più, gli indici sono scalati e
il gate i18n **non** ve lo dirà.
