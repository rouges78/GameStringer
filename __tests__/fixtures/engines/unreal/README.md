# Fixture Unreal — `.locres`

## `Game.locres`, `Game_v2.locres`

Fixture SINTETICHE, prodotte dal nostro writer secondo la specifica del
formato. Servono ai round-trip parser↔writer.

⚠️ Limite noto, imparato a caro prezzo: una fixture scritta dal nostro stesso
writer dimostra che parser e writer sono coerenti *fra loro* — non che siano
coerenti con Unreal. È così che un magic `.locres` inventato è sopravvissuto a
tutti i test fino al 30/07/2026, ed è così che il magic `.locmeta` sbagliato è
arrivato fino al file autentico il 02/08/2026. Un test che non può fallire non
è un test.

## Il riferimento autentico NON vive in questo repo

Fino al 02/08/2026 qui c'era anche un `.locres` versione 3 REALE (estratto da
un gioco UE5 commerciale via dump di memoria, indice completo 811/811, array
stringhe troncato a 204/752 per una
causa mai determinata — due diagnosi proposte e demolite dai dati, a verbale
nella ROADMAP). Era "il metro": l'unico file contro cui misurare il writer
senza circolarità.

È stato RIMOSSO DAL REPO perché contiene testo di un gioco commerciale — la
stessa categoria di materiale per cui esistono `docs/ANTI_PIRACY.md`, la
garanzia "solo diff" dei `.gspack` e il gate `scripts/check-game-assets.js`.
Un repo pubblico che ridistribuisce dialoghi altrui smentisce le sue stesse
regole, a prescindere dai kilobyte.

Il file resta DISPONIBILE LOCALMENTE (cartella `estratti/`, ignorata da git,
rigenerabile con `scripts/ue-locres-from-dump.js` da chi possiede il gioco).
I test o gli script che hanno bisogno del riferimento autentico devono
riceverlo via variabile d'ambiente:

```
GS_UE_AUTHENTIC_LOCRES=/percorso/locale/al/file.locres cargo test -- --ignored
```

e marcarsi `#[ignore]` — mai dare per scontato che il file esista, mai
riportarlo dentro `__tests__/fixtures/`.

NOTA STORIA GIT: il file resta nei commit precedenti al 02/08/2026 (60cf5fe6 e
successivi), come i 18 file di `estratti_pak/` in 9c6971e0. La decisione di
non riscrivere la storia è stata presa consapevolmente; se un giorno si
decidesse il contrario, un solo passaggio di `git filter-repo` può ripulire
entrambi.
