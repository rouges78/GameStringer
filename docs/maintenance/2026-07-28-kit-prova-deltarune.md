# Kit prova sul campo — ADR-005 su Deltarune (28/07/2026)

Cosa manca perché ADR-005 passi da "implementato" a "provato": la compilazione
in locale (la sandbox non compila Rust) e una frase russa **letta a schermo**
dentro Deltarune. Questo file è la checklist esatta, nei comandi di Git Bash
(MINGW64), copiabili così come sono.

## 0. Cosa è stato aggiunto oggi (da compilare insieme al resto)

- `src-tauri/src/commands/font_installer.rs` → comando `gm_prepare_glyph_font`
  (dà al frontend il percorso del TTF in cache; per le lingue latine ripiega
  su NotoSans LGC, che copre anche gli accenti).
- `src-tauri/src/main.rs` → registrazione del comando.
- Frontend: `lib/gm-glyph-inject.ts`, `components/game-detail/gm-glyph-card.tsx`
  (card "Glifi GameMaker" nella pagina del gioco, due passi: Anteprima → Applica),
  verifica dell'effetto post-traduzione in `game-detail-client.tsx` +
  `auto-translate-stepper.tsx`, i18n 12 lingue.

## 1. Compilazione e test Rust (≈ 5 min)

```bash
cd /g/dev/Gamestringer/src-tauri
cargo check 2>&1 | tail -20
cargo test gm_ 2>&1 | tail -20
```

Atteso: check pulito; tutti i test `gm_*` verdi (63 dei moduli ADR-005 più
quelli di oggi... nessuno nuovo, oggi il Rust aggiunto è un solo comando senza
logica propria).

Se `cargo check` fallisce su `gm_prepare_glyph_font`: il comando riusa
`font_pack_for_lang` + `ensure_font_cached` che sono nello stesso file, quindi
un errore lì è quasi certamente di firma/import — segnalamelo com'è.

## 2. Test sul data.win vero (≈ 2 min)

```bash
cd /g/dev/Gamestringer/src-tauri
GS_GM_DATA_WIN="/c/percorso/della/demo/DELTARUNEdemo/data.win" \
  cargo test gm_ -- --ignored --nocapture 2>&1 | tail -30
```

Atteso (già misurato il 27/07, deve restare uguale):
- round-trip 26 texture su 26;
- QOI ricodificato dell'atlante = 1.888.553 B;
- blob ricompresso = 230.197 B (identico all'originale).

## 3. Typecheck + test JS (≈ 3 min)

```bash
cd /g/dev/Gamestringer
npm run typecheck && npm test 2>&1 | tail -10
```

La sandbox ha già verificato: sintassi dei 3 file nuovi, JSON dei 12 locale,
gate i18n (baseline scesa 1361→1355), gate moduli morti, gate comandi Tauri.
Il typecheck completo però va fatto in locale.

## 4. La prova che conta: una frase russa a schermo (≈ 10 min)

1. Avvia l'app (`npm run tauri:dev`), apri la demo di Deltarune in libreria,
   lingua target **russo**.
2. Nella pagina del gioco, card **«Glifi GameMaker (data.win)»** → **Anteprima**.
   - Atteso: "Fattibile", ~66 lettere iniettate per font, margine positivo
     su ogni texture, eventuali avvisi PER NOME (es. lettere ridotte).
3. **Applica al data.win.** Atteso: verde + percorso del backup `.bak`.
4. Traduci il Chapter 1 (i `lang/*.json` sono già supportati dal 26/07:
   scrive nel file giapponese, il gioco li carica con `global.lang != en`).
5. Avvia il gioco, imposta il giapponese (= la nostra lingua impersonata),
   e leggi la prima frase: **cirillico disegnato, niente caselle vuote**.
6. Screenshot → `docs/adr/img/ADR-005-deltarune-in-game.png`, e ADR-005 passa
   a "provato sul campo".

Fallback se qualcosa non torna: ripristina il `.bak` accanto al `data.win`
(o dalla card, in futuro; oggi a mano) e rilancia — il gioco torna intatto.

## 5. Verifica post-traduzione (punto 3 del triage, stessa sessione)

Con un gioco qualsiasi via workflow generico ("String It"):
- se i file dichiarati esistono → intestazione VERDE «applicata e verificata:
  N file sul disco», con i nomi;
- se il motore dichiara successo ma nessun file esiste → intestazione AMBRA
  «nessun file verificato», consiglio esplicito e pulsante OCR — mai più
  «100% con 0 errori» col gioco in inglese.

## 6. Commit suggerito (dalla radice, dopo i passi 1–3 verdi)

```bash
cd /g/dev/Gamestringer
git add -A
git commit -m "feat(gamemaker): glyph injection UI, and the success message now checks the disk"
git log -1
```
