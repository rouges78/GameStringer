# GameStringer Version Management System

Sistema di versioning automatico per GameStringer che segue il **Semantic Versioning (SemVer)**.

## Formato Versioni

```text
MAJOR.MINOR.PATCH
```text

- **MAJOR**: Cambiamenti incompatibili (es. 1.0.0 -> 2.0.0)
- **MINOR**: Nuove funzionalita retrocompatibili (es. 1.3.0 -> 1.4.0)
- **PATCH**: Bug fix e miglioramenti (es. 1.4.1 -> 1.4.2)

## Versione Corrente

**v1.4.2** (Build 120) - 03/03/2026

## File da Aggiornare per ogni Release

| File | Campo | Esempio |
|------|-------|---------|
| `version.json` | version, major, minor, patch, buildNumber, buildDate, changelog | Versione UI |
| `package.json` | version (in fondo al file) | `"version": "1.4.2"` |
| `src-tauri/tauri.conf.json` | version | `"version": "1.4.2"` |
| `src-tauri/Cargo.toml` | version | `version = "1.4.2"` |
| `CHANGELOG.md` | Entry per la nuova versione | Changelog pubblico |
| `components/layout/main-layout.tsx` | CHANGELOG_CONTENT | Changelog nel dialog UI |

## Comandi NPM

### Status e Info

```bash
npm run version:status    # Mostra stato corrente
npm run version           # Alias per status
```text

### Increment Versioni

```bash
npm run version:patch    # 1.4.2 -> 1.4.3
npm run version:minor    # 1.4.2 -> 1.5.0
npm run version:major    # 1.4.2 -> 2.0.0
npm run version:build    # Build +1 (auto)
```text

### Changelog e Tags

```bash
npm run version:changelog  # Genera CHANGELOG.md
npm run version:tag        # Crea git tag
```text

### Release Complete

```bash
npm run release:patch    # patch + tag + push
npm run release:minor    # minor + tag + push
npm run release:major    # major + tag + push
```text

## Workflow Release

### 1. Bug Fix (Patch)

```bash
npm run version:patch "Fix hooks mismatch" "Fix rate limiting"
git add .
git commit -m "fix: hooks mismatch con dynamic imports"
npm run version:tag
git push --tags
```text

### 2. Nuova Feature (Minor)

```bash
npm run version:minor "Vision LLM Translator" "Lore Assistant" "Auto-Hook Scanner"
git add .
git commit -m "feat: Vision LLM, Advanced Tools"
npm run version:tag
git push --tags
```text

### 3. Release Completa

```bash
npm run release:minor
# Fa tutto automaticamente: version + tag + push
```text

## File del Sistema

### Core Files

- `version.json` - Database versioni centrale
- `lib/version.ts` - React hooks e utilities
- `scripts/version-manager.js` - CLI manager

### Generated Files

- `CHANGELOG.md` - Changelog automatico

## Esempi di Uso

### Bug Fix

```bash
npm run version:patch "Fix rate limiting MyMemory"
```text

### Nuova Feature

```bash
npm run version:minor "Vision LLM Translator" "System Monitor VRAM"
```text

### Breaking Change

```bash
npm run version:major "Nuova architettura plugin" "API v2"
```text

## Integrazione UI

La versione viene mostrata nella sidebar e nel dialog changelog.

### Sidebar Footer

```typescript
import { useVersion } from '@/lib/version';

const { version, buildInfo } = useVersion();
// -> v1.4.2 + git hash + build date
```text

### Settings Page

```typescript
const { version, buildInfo, formatDate } = useVersion();
// -> Informazioni complete sistema
```text

## Setup Iniziale

1. **Verifica file esistano:**

```bash
ls version.json lib/version.ts scripts/version-manager.js
```text

1. **Verifica funzionamento:**

```bash
npm run version:status
```text

1. **Primo release:**

```bash
npm run version:minor "Setup versioning automatico"
npm run version:tag
```text

## Changelog Automatico

Il changelog viene generato automaticamente da `version.json` e mostrato nel dialog UI tramite la costante `CHANGELOG_CONTENT` in `main-layout.tsx`.

## Troubleshooting

### version.json Corrotto

```bash
git checkout HEAD -- version.json
npm run version:status
```text

### Build Number Bloccato

```bash
npm run version:build
```text

### Mismatch tra file

Verificare che tutti i 6 file elencati sopra abbiano la stessa versione.

---

Sistema di versioning GameStringer v1.4.2 - Automatico, Affidabile, Semplice
