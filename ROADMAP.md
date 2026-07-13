# GameStringer — Roadmap "il migliore al mondo"

> Task list prioritizzata delle cose da fare e sistemare.
> Creata il 13/07/2026 (post v1.13.0). Aggiornare le checkbox man mano.
>
> La base (P.T., 20+ engine, reflection, TM semantica, Patch Hub) è già forte:
> quello che separa GameStringer dal migliore al mondo non sono più le feature,
> ma **affidabilità dimostrabile, community e rifinitura**.

---

## P0 — Fondamenta di fiducia (è qui che si vince)

- [ ] **Database di compatibilità pubblico ("ProtonDB delle traduzioni")**
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
  - [ ] Pagina web pubblica su gamestringer.ai che espone il database
    (ricerca per gioco, filtro lingua/engine).
  - [ ] Prompt one-time in-app che propone l'opt-in dopo la prima traduzione
    riuscita (oggi si attiva solo dai settings).
  - [ ] Badge compatibilità anche nelle card della Library.
  - [ ] Anti-abuso lato server (rate limit per IP, dedup run sospette).
- [ ] **Crash/error reporting opt-in**
  Oggi un fallimento su un gioco reale muore in silenzio sul PC dell'utente.
  Report anonimo con engine + versione + stacktrace = roadmap dei fix automatica.
- [x] **Suite di test verde** — verificato 13/07/2026: 38 file / 566 test passati.
  La nota "27/43 falliti" era di aprile ed è superata; gli unici skip sono
  debito documentato (UI TM non ancora implementata, CSP H12 — vedi
  `docs/PROJECT_STATUS.md`).
- [ ] **Corpus di fixture mini-gioco per engine** come regression suite in CI
  (micro RPG Maker, micro Ren'Py, micro `.locres`, micro Godot, …): ogni parser
  verificato ad ogni commit, mai più regressioni silenziose sui patcher.
- [ ] **Falsi positivi antivirus** (BepInEx / gs-hook / DLL injection).
  - [x] Pagina docs dedicata (`docs/ANTIVIRUS.md`) + link da README e
    TROUBLESHOOTING — fatta 13/07/2026.
  - [ ] Submission a Microsoft Defender/SmartScreen ad ogni release
    (processo manuale, link nella pagina docs).
  Prima causa di abbandono al primo avvio.
- [ ] **Firma e moderazione dei `.gspack`**
  Firma dei pack, verifica hash, badge "verified" reali. Un pacchetto malevolo
  distribuito dal Patch Hub è un rischio esistenziale per il progetto.

## P1 — Qualità traduzione (da ottima a imbattibile)

- [ ] **Benchmark qualità per provider/lingua con dati reali**
  Aggregare (opt-in) i QA score 0–100 già calcolati su ogni stringa e pubblicare
  *"per IT→JA su JRPG il migliore è X"*. Auto-Select diventa data-driven;
  il benchmark pubblico è marketing gratuito.
- [ ] **Font auto-patching**
  Rilevare glifi mancanti (CJK, cirillico, greco) e proporre/installare font
  sostitutivi — almeno Unity e Unreal. La traduzione perfetta che rende □□□
  in-game è comunque un fallimento per l'utente.
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
