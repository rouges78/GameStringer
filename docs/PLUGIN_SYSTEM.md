# GameStringer Plugin System — Design Document

## Overview

Il Plugin System permette alla community di aggiungere supporto per nuovi game engine, formati di file e tool di traduzione senza modificare il codice core di GameStringer.

## Architettura

```text
plugins/
├── manifest.json              # Registro dei plugin installati
├── unity-advanced/
│   ├── plugin.json            # Metadata del plugin
│   ├── extractor.js           # Script estrazione testo
│   └── patcher.js             # Script applicazione patch
├── custom-engine/
│   ├── plugin.json
│   ├── extractor.js
│   └── patcher.js
└── ...
```text

## Plugin Manifest (`plugin.json`)

```json
{
  "id": "custom-engine-support",
  "name": "Custom Engine Support",
  "version": "1.0.0",
  "author": "community-dev",
  "description": "Supporto per il motore Custom Engine",
  "engine": "custom-engine",
  "minAppVersion": "1.4.0",
  "entrypoints": {
    "detect": "detect.js",
    "extract": "extractor.js",
    "patch": "patcher.js"
  },
  "filePatterns": ["*.custom", "*.dat"],
  "permissions": ["fs:read", "fs:write"]
}
```text

## Plugin API

I plugin hanno accesso a un'API sandboxed:

### Detect (detect.js)

```javascript
// Riceve il path della cartella del gioco
// Ritorna true se il plugin supporta questo gioco
export function detect(gamePath) {
  return fs.existsSync(path.join(gamePath, 'CustomEngine.dll'));
}
```text

### Extract (extractor.js)

```javascript
// Estrae le stringhe traducibili dal gioco
export async function extract(gamePath, options) {
  const files = await scanFiles(gamePath, '*.dat');
  const strings = [];
  for (const file of files) {
    const content = await readFile(file);
    strings.push(...parseStrings(content));
  }
  return {
    strings,       // Array<{ id: string, original: string, context?: string }>
    metadata: {    // Metadata del gioco
      engine: 'custom-engine',
      version: '1.0',
      totalStrings: strings.length
    }
  };
}
```text

### Patch (patcher.js)

```javascript
// Applica le traduzioni al gioco
export async function patch(gamePath, translations, options) {
  for (const translation of translations) {
    await replaceString(gamePath, translation.id, translation.translated);
  }
  return { success: true, patchedCount: translations.length };
}
```text

## Sicurezza

- I plugin vengono eseguiti in un **sandbox JavaScript** (QuickJS o Deno)
- Accesso al filesystem limitato alla cartella del gioco
- Nessun accesso a rete, processi di sistema, o API Tauri
- Permessi dichiarati nel manifest e approvati dall'utente
- Firma opzionale per plugin verificati dalla community

## Installazione Plugin

1. **Da file**: Drag & drop di un `.gsplug` (zip rinominato)
2. **Da GitHub**: URL del repository, download automatico
3. **Da Community Hub**: Browser integrato dei plugin condivisi

## Roadmap

- **v1.5.0**: Scaffold base, caricamento plugin, API detect
- **v1.6.0**: API extract/patch complete, sandbox QuickJS
- **v1.7.0**: Community Hub plugin browser, firma e verifica

---

*GameStringer Plugin System — Draft v0.1 — 03/03/2026*
