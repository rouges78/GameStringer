# GameStringer v1.15.0 — Parametri Ollama, Progetti ↔ Patch Hub, Feedback in-app, Hub più veloce

## Parametri di inferenza Ollama

- **Pannello parametri** (`/ollama-manager/advanced`): preset **Fedele / Bilanciato / Creativo** + **modalità esperto**
- Controlli esperto: `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx`, `seed`
- Vale per Ollama locale, inclusa la pipeline di reflection
- Chiude il **404** del pulsante "Funzioni avanzate"

## Integrazione Progetti ↔ Patch Hub

- L'import di un **`.gspack`** registra un progetto completato e salva il file tradotto
- **Pubblica** precompilato dal progetto; la pubblicazione allega il file tradotto reale
- Toggle **Esplora / Le mie patch**
- Nuova azione **Applica al gioco**: scelta cartella + backup **`.bak`** automatico

## Feedback in-app

- **Widget di feedback** (Impostazioni → Community): categoria + messaggio
- Contesto automatico allegato: versione, piattaforma, schermata, gioco
- Invio **fail-open** con fallback copia/email

## Prestazioni Patch Hub

- **Caching client-side** (TTL 60s) + throttle delle scritture
- **Migration di rate-limiting** lato server preparata

## Fix & Qualità

- Fix: i **feed RSS** non generano più errori **CORS** nella webview desktop
- **Audit accessibilità WCAG 2.1 AA** documentato
- Changelog in-app v1.15.0 tradotto in **12 lingue UI**

---

**Download**: Scegli `GameStringer_1.15.0_x64-setup.exe` (installer) o `GameStringer_1.15.0_x64-portable.zip`
