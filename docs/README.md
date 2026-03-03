# Documentazione GameStringer

## Panoramica

Documentazione completa di GameStringer v1.4.2 - Suite professionale di localizzazione videogiochi con AI.

---

## Guide Utente

### Sistema Profili

- **[Guida Completa Sistema Profili](user-guide/profiles-system.md)** - Guida dettagliata
- **[Riferimento Rapido Profili](user-guide/profiles-quick-reference.md)** - Comandi essenziali
- **[FAQ Sistema Profili](faq/profiles-faq.md)** - Domande frequenti
- **[Workflow Completo](user-guide/gamestringer-complete-workflow.md)** - Flusso di lavoro

### Guide per Lingua

- **[Italiano](GUIDA_UTENTE.md)** | **[English](USER_GUIDE_EN.md)** | **[Espanol](USER_GUIDE_ES.md)**
- **[Francais](USER_GUIDE_FR.md)** | **[Deutsch](USER_GUIDE_DE.md)** | **[Japanese](USER_GUIDE_JA.md)**
- **[Chinese](USER_GUIDE_ZH.md)** | **[Korean](USER_GUIDE_KO.md)** | **[Portugues](USER_GUIDE_PT.md)**
- **[Russian](USER_GUIDE_RU.md)** | **[Polish](USER_GUIDE_PL.md)**

### Funzionalita Principali

- **[Guida Traduzioni](user-guide/translations-guide.md)** - Come tradurre i giochi
- **[Gestione Store](user-guide/store-management.md)** - Configurazione Steam, Epic, GOG, etc.
- **[Impostazioni Avanzate](user-guide/advanced-settings.md)** - Configurazioni personalizzate

---

## Documentazione Tecnica

### Architettura e Sistemi

- **[Architettura](ARCHITETTURA.md)** - Design tecnico del progetto
- **[API Reference](API_REFERENCE.md)** - Endpoint REST e SDK TypeScript
- **[Plugin System](PLUGIN_SYSTEM.md)** - Architettura plugin (design doc)
- **[Patch System](PATCH_SYSTEM.md)** - Sistema patch traduzioni
- **[Translation Editor](TRANSLATION_EDITOR.md)** - Editor traduzioni
- **[Port Management](PORT_MANAGEMENT.md)** - Gestione porte Next.js/Tauri

### Configurazione

- **[Secrets Setup](SECRETS_SETUP.md)** - Configurazione API keys
- **[Store Integrations](STORE_INTEGRATIONS.md)** - Integrazione store gaming
- **[Steam Local](STEAM_LOCAL_INTEGRATION.md)** - Integrazione Steam locale
- **[2FA Support](2FA_SUPPORT.md)** - Autenticazione a due fattori

### Sicurezza

- **[Sicurezza e Crittografia](security/profiles-security-guide.md)** - AES-256-GCM, Recovery Key
- **[Accessibilita Notifiche](NOTIFICATION_ACCESSIBILITY.md)** - Standard accessibilita

### Troubleshooting

- **[Troubleshooting](TROUBLESHOOTING.md)** - Risoluzione problemi
- **[Port Management](PORT_MANAGEMENT.md)** - Fix ChunkLoadError e porte
- **[Versioning](VERSIONING.md)** - Sistema di versioning

---

## Per Sviluppatori

### Riferimenti

- **[API Reference](API_REFERENCE.md)** - Endpoint REST completi
- **[Plugin System](PLUGIN_SYSTEM.md)** - Come sviluppare plugin
- **[Editor Implementation](EDITOR_IMPLEMENTATION_SUMMARY.md)** - Dettagli implementazione editor

### Testing

- **[Manual Testing Report](MANUAL_TESTING_REPORT.md)** - Report test manuali
- **[Project Status](PROJECT_STATUS.md)** - Stato corrente del progetto

---

## Riferimenti Rapidi

### Azioni Comuni

| Azione | Guida |
|--------|-------|
| Primo setup | [Profili](user-guide/profiles-system.md#primo-avvio) |
| Tradurre un gioco | [Workflow](user-guide/gamestringer-complete-workflow.md) |
| Configurare API keys | [Secrets](SECRETS_SETUP.md) |
| Fix porte/ChunkLoadError | [Port Management](PORT_MANAGEMENT.md) |
| Problemi password | [FAQ](faq/profiles-faq.md) |

### Scorciatoie Tastiera

- `Ctrl+K` - Command Palette
- `Ctrl+L` - Libreria giochi
- `Ctrl+T` - Traduci
- `Ctrl+Shift+P` - Menu profilo
- `Ctrl+Shift+N` - Notifiche

---

## Stato Documentazione

### Completato

- [x] 11 Guide Utente multilingua (IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL)
- [x] API Reference completa
- [x] Sistema Profili - Guida, FAQ, Troubleshooting
- [x] Plugin System - Design doc
- [x] Port Management
- [x] Store Integrations (8 piattaforme)
- [x] Changelog aggiornato a v1.4.2

### In Aggiornamento

- [ ] Video Tutorial
- [ ] Esempi codice integrazioni
- [ ] Enterprise Guide

---

Documentazione aggiornata alla versione 1.4.2 - 03/03/2026
