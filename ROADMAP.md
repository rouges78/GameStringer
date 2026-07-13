# GameStringer — Roadmap "il migliore al mondo"

> Task list prioritizzata delle cose da fare e sistemare.
> Creata il 13/07/2026 (post v1.13.0). Aggiornare le checkbox man mano.
>
> La base (P.T., 20+ engine, reflection, TM semantica, Patch Hub) è già forte:
> quello che separa GameStringer dal migliore al mondo non sono più le feature,
> ma **affidabilità dimostrabile, community e rifinitura**.

---

## P0 — Fondamenta di fiducia (è qui che si vince)

- [x] **Database di compatibilità pubblico ("ProtonDB delle traduzioni")** ✅ COMPLETO 13/07/2026
  Telemetria opt-in che riporta in automatico l'esito per gioco/engine/step
  (scan → extract → translate → patch → boot). Trasforma ogni utente in un tester
  e crea un asset che nessun concorrente ha: *"questo gioco funziona al 94%,
  testato da 37 persone"*. Sostituisce i report manuali chiesti nel README.
  - [x] **v1 in-app (13/07/2026)**: tabella `compat_reports` + vista
    `compat_game_summary` su Supabase (RLS insert-only), sender fail-open con
    coda offline (`lib/compat-telemetry.ts`), agganci in hero-job-tracking e
    fast path universale, banner conferma boot 👍/👎, badge community in game
    detail, toggle opt-in (default OFF) nel tab Community dei settings,
    i18n 12 lingue. Dettagli: `docs/COMPAT_TELEMETRY.md`.
  - [x] Pagina web pubblica su gamestringer.ai (13/07/2026:
    `docs/sito/compatibilita.html` — ricerca, filtri lingua/engine, 12 lingue,
    link in nav; live al prossimo push via deploy-site.yml).
  - [x] Prompt one-time in-app che propone l'opt-in dopo la prima traduzione
    riuscita (13/07/2026: toast con report retroattivo della run se accetti).
  - [x] Badge compatibilità nelle card della Library (13/07/2026:
    `CompatBadge` + fetch batched, una query per schermata).
  - [x] Anti-abuso lato server (13/07/2026: trigger `compat_reports_guard` —
    dedup run/step, max 60 righe/h per IP, max 10 run/gioco/24h per IP,
    scarto silenzioso; migration applicata).
- [x] **Crash/error reporting opt-in** — FATTO 13/07/2026.
  `lib/crash-reporter.ts` + tabella `crash_reports` (trigger anti-abuso,
  vista di triage `crash_signatures` solo per lo sviluppatore). Cattura crash
  finestra, promise non gestite, ErrorBoundary e fallimenti di pipeline;
  messaggi e stack sanitizzati (mai percorsi/token, test di regressione).
  Toggle in Settings → Community, default OFF. Docs: `docs/CRASH_REPORTING.md`.
- [x] **Suite di test verde** — verificato 13/07/2026: 38 file / 566 test passati.
  La nota "27/43 falliti" era di aprile ed è superata; gli unici skip sono
  debito documentato (UI TM non ancora implementata, CSP H12 — vedi
  `docs/PROJECT_STATUS.md`).
- [x] **Corpus di fixture mini-gioco per engine** — v1 FATTA 13/07/2026.
  `__tests__/fixtures/engines/` (PO/XLIFF/RESX/strings/JSON/INI/properties/CSV,
  SRT/VTT/ASS, `.locres` binario indipendente, Ren'Py, RPG Maker MV, Tyrano,
  Kirikiri) + 46 test in `__tests__/engines/`. Ha già scovato e fatto correggere
  **2 bug reali**: target XLIFF ignorato se non attaccato a `</source>`, e
  timestamp VTT brevi (MM:SS.mmm) azzerati al re-parse.
  - [x] Harness Rust `cargo test` (13/07/2026): `src-tauri/tests/engine_fixtures.rs`
    consuma le stesse fixture ed esercita i parser Rust veri — Godot `.pck`,
    Unreal `.locres` v0/v2, Danganronpa STX, RPG Maker MV JSON. Fixture binarie
    generate e validate contro la logica reale del parser. Gira in CI.
    - [x] Estensione CRI + Bethesda (13/07/2026): fixture CPK con doppia
      tabella @UTF big-endian (header+TOC, MSG non compresso, pipeline
      completa fino a parse_cri_text_file), STRINGS/DLSTRINGS e BSA v104.
      Tutte validate contro la logica reale dei parser prima del commit.
    - [ ] Residui: blob CRILAYLA-compresso nel CPK, BA2 (Fallout 4/Starfield),
      ESP/ESM — richiedono compressore o campioni reali.
- [ ] **Falsi positivi antivirus** (BepInEx / gs-hook / DLL injection).
  - [x] Pagina docs dedicata (`docs/ANTIVIRUS.md`) + link da README e
    TROUBLESHOOTING — fatta 13/07/2026.
  - [x] Submission a Microsoft Defender/SmartScreen: processo documentato e
    assistito (13/07/2026) — runbook `docs/DEFENDER_SUBMISSION.md`,
    helper `npm run av:checklist` (asset + sha256 + passi), promemoria
    stampato da `ship` a fine release. Resta l'azione manuale di 5 min
    per release (upload a Microsoft, non automatizzabile).
  - [x] Corretto l'overclaim "code-signed" in README/ANTIVIRUS (13/07: le
    release NON sono firmate oggi; gli update Tauri sì via minisign) + guida
    alla firma reale (SignPath OSS gratis / Azure Trusted Signing) in
    `DEFENDER_SUBMISSION.md` §0.
  - [x] Analisi eleggibilità firma (13/07/2026): **SignPath Foundation NON
    eleggibile** (richiede licenza OSI; GameStringer è Source-Available) e
    **Azure Artifact Signing individuale NON disponibile in Italia** (solo
    USA/Canada). Opzioni reali documentate in DEFENDER_SUBMISSION §0: Azure
    come *org* UE, certificato OV/EV da CA (license-agnostic), o rilicenziare.
  - [ ] **Azione Davide** (decisione di prodotto): scegliere la via alla firma
    tra Azure-org UE / cert OV (~150-300€/anno) / EV. Poi io abilito
    `certificateThumbprint` in tauri.conf (snippet pronto in §0). È la
    soluzione definitiva che azzera gli avvisi SmartScreen alla radice.
  Prima causa di abbandono al primo avvio.
- [x] **Firma e moderazione dei `.gspack`** — FATTO 13/07/2026
  (`docs/PACK_INTEGRITY.md`): SHA-256 per file al publish + verifica
  BLOCCANTE al download; manifest .gspack firmato (import bloccato se
  manomesso); sanitizzazione path anti-traversal (TS + Rust); auto-flag
  server alla 3ª segnalazione distinta (pack ritirato in pending +
  moderation_log); badge "Integrità verificata" nel Patch Hub. 21 test.
  - [ ] Futuro: firma minisign per-autore quando ci sarà gestione chiavi
    dei traduttori (base: `gamestringer.key.pub`).

## P1 — Qualità traduzione (da ottima a imbattibile)

- [ ] **Benchmark qualità per provider/lingua con dati reali**
  Aggregare (opt-in) i QA score 0–100 già calcolati su ogni stringa e pubblicare
  *"per IT→JA su JRPG il migliore è X"*. Auto-Select diventa data-driven;
  il benchmark pubblico è marketing gratuito.
- [x] **Font auto-patching — v1 FATTA 13/07/2026** (`docs/FONT_CHECK.md`).
  Rilevamento REALE dei glifi mancanti: parser `cmap` TTF/OTF/TTC puro TS
  (`lib/font-coverage.ts`), scan dei font del gioco, verdetto per scrittura
  (cirillico/greco/CJK/kana/hangul/…) con esempi dei caratteri mancanti.
  Card "Verifica font" in game detail; fix one-click Unity retroattivo
  (`apply_xunity_font_override`: override XUnity + bundle TMP per versione,
  riusa la logica dell'installer issue #46); consigli operativi per Ren'Py,
  RPG Maker, Unreal, Godot. Fixture TTF reali + 15 test.
  - [x] Sostituzione font AUTOMATICA per engine file-based — FATTA 13/07/2026:
    `font_installer.rs` (install_game_font/remove_game_font) scarica il Noto
    giusto per lingua (LGC/JP/SC/KR/Thai/Arabic/Hebrew, cache locale + mirror),
    lo installa in Ren'Py (game/ + .rpy init 999) o RPG Maker MV
    (www/fonts + gamefont.css) / MZ (fonts/ + System.json), sempre con backup
    e ripristino one-click. 7 test cargo + flussi validati standalone.
  - [~] Generazione mod `_P.pak` con font sostitutivo per Unreal — **valutata
    e rimandata con piano** (`docs/adr/ADR-001-unreal-font-pak.md`, 13/07/2026).
    Diverso dagli altri engine: va sostituito l'asset font esatto del gioco, e
    manca la serializzazione `.uasset` + il reader pak compresso/UE5 + un gioco
    di test. Prerequisiti e opzioni (A regen / B byte-swap / C guida) nell'ADR.
    Per ora resta la guida per engine in `fontCheck.adviceUnreal`.
- [ ] **Protezione tag/variabili garantita**
  Validatore che assicura che `{player}`, `%s`, ruby, control codes sopravvivano
  alla traduzione, con auto-fix nel pass di reflection.
- [ ] **Catalogo modelli/provider via remote config**
  Le liste in P.T. citano ancora "Claude 3.5, GPT-4o" e invecchiano ad ogni
  release: un JSON remoto aggiornabile senza rilasciare l'app tiene modelli,
  prezzi e raccomandazioni sempre freschi.
- [ ] **Glossari community condivisi per gioco**
  Chi traduce Persona 5 in italiano parte dal glossario già validato da altri
  (via Patch Hub / TM Network). La TM semantica c'è già: questo è il passo dopo.
- [ ] Modelli embedding nella lista consigliati di `ollama-manager` (pull one-click).
- [ ] "Indicizza ora" anche per glossario/lore quando c'è un contesto gioco attivo.

## P1 — Community (il moltiplicatore)

- [ ] **Aprire il Discord** — promesso nel README; costo quasi zero, ritorno massimo.
  I progetti di fan-translation vivono lì.
- [ ] **Onboarding primo gioco**
  Flusso guidato "traduci il tuo primo gioco in 5 minuti" con titolo facile
  suggerito dalla libreria (P.T. sa già quali sono). Il momento "wow" deve
  arrivare entro 10 minuti dall'installazione.
- [ ] **Video demo 60–90 secondi** sul sito e nel README: "click → gioco in italiano".
- [ ] **Showcase dei pack**: classifiche, contatore download, profilo traduttore.
  La reputazione è la valuta che fa pubblicare pack.

## P2 — Copertura engine e piattaforme

- [ ] **Unity IL2CPP di profondità** + versioni Unity recenti (il grosso dei giochi nuovi).
- [ ] **UE5 IoStore/Zen loader completo** + portare il tool UE fuori dallo stato
  "sperimentale" (rif. issue #52).
- [ ] **GameMaker da parziale a pieno** (oltre l'integrazione UndertaleModTool).
- [ ] **Parità macOS/Linux verificata** — o coperta da test reali, o limiti
  dichiarati onestamente per piattaforma (aumenta comunque la fiducia).
- [ ] **Overlay OCR: latenza e leggibilità** — per i retro è l'unica strada;
  ogni 100 ms guadagnati si sentono.

## P2 — Salute del progetto

- [ ] **Bundle e avvio**: continuare lo slimming delle route pesanti (~700 kB),
  misurare il cold-start.
- [x] **Fix alla radice del bug `ship` su Windows** — fatto 13/07/2026:
  `confirm()` ora usa readline (una riga alla volta, funziona su Windows)
  invece di `fs.readFileSync(0)` che attendeva EOF. `--yes` resta per CI.
- [x] **`docs/PROJECT_STATUS.md`** — riscritto snello 13/07/2026 (stato +
  puntatori a CHANGELOG/ROADMAP) e agganciato a `npm run ship`
  (`bumpProjectStatus` stampa versione/data ad ogni release).
- [ ] **Bus factor**: documentare i percorsi critici (release, firma, deploy sito,
  gestione chiavi) così la community può contribuire davvero; più issue
  etichettate `good first issue`.

---

## Se dovessi scegliere solo tre cose

1. **Database di compatibilità automatico** (P0)
2. **Discord** (P1 community)
3. **Font auto-patching** (P1 qualità)

Le prime due creano il volano community-dati che nessun tool amatoriale può
replicare; la terza elimina il fallimento più visibile per l'utente finale.
