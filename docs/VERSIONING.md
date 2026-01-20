# 🚀 GameStringer Version Management System

Sistema di versioning automatico per GameStringer che segue il **Semantic Versioning (SemVer)**.

## 📋 Formato Versioni

```
MAJOR.MINOR.PATCH.BUILD
  3  .  2  .  1  .  42
```

- **MAJOR**: Breaking changes, architettura completamente nuova
- **MINOR**: Nuove funzionalità, miglioramenti significativi
- **PATCH**: Bug fixes, piccole correzioni
- **BUILD**: Auto-incrementato ad ogni commit

## 🔧 Comandi Disponibili

### Status e Info
```bash
npm run version:status    # Mostra stato corrente
npm run version          # Alias per status
```

### Increment Versioni
```bash
npm run version:patch    # 3.2.1 → 3.2.2
npm run version:minor    # 3.2.1 → 3.3.0  
npm run version:major    # 3.2.1 → 4.0.0
npm run version:build    # Build +1 (auto)
```

### Changelog e Tags
```bash
npm run version:changelog  # Genera CHANGELOG.md
npm run version:tag       # Crea git tag
```

### Release Complete
```bash
npm run release:patch    # patch + tag + push
npm run release:minor    # minor + tag + push
npm run release:major    # major + tag + push
```

## 🔄 Workflow Automatico

### 1. Sviluppo Normale
```bash
git add .
git commit -m "fix: corretti bug steam API"
# → Build number auto-incrementato via pre-commit hook
```

### 2. Nuova Feature
```bash
npm run version:minor "Aggiunta traduzione automatica" "Nuovo UI per impostazioni"
git add .
git commit -m "feat: sistema traduzione automatica"
npm run version:tag
git push --tags
```

### 3. Release Completa
```bash
npm run release:minor
# Fa tutto automaticamente: version + tag + push
```

## 📁 File del Sistema

### Core Files
- `version.json` - Database versioni centrale
- `lib/version.ts` - React hooks e utilities
- `scripts/version-manager.js` - CLI manager

### Generated Files  
- `CHANGELOG.md` - Changelog automatico
- `package.json` - Sincronizzato automaticamente

### Git Integration
- `.githooks/pre-commit` - Auto-increment build
- `scripts/setup-hooks.js` - Setup iniziale

## 🎯 Esempi Pratici

### Bug Fix
```bash
npm run version:patch "Risolto crash nella libreria giochi"
```

### Nuova Feature
```bash
npm run version:minor "Sistema debug integrato" "Collapsible sidebar"
```

### Breaking Change
```bash
npm run version:major "Nuova architettura Tauri v3" "API completamente rivista"
```

## 🔗 Integrazione UI

Il sistema è integrato automaticamente in:

### Sidebar Footer
```typescript
import { useVersion } from '@/lib/version';

const { version, buildInfo } = useVersion();
// → v3.2.1.42 + git hash
```

### Settings Page
```typescript
const { version, buildInfo, formatDate } = useVersion();
// → Informazioni complete sistema
```

### Build Process
```bash
npm run build        # Auto-increment build
npm run tauri:build  # Auto-increment build
```

## ⚙️ Setup Iniziale

1. **Attiva Git Hooks:**
```bash
node scripts/setup-hooks.js
```

2. **Verifica Funzionamento:**
```bash
npm run version:status
```

3. **Primo Release:**
```bash
npm run version:minor "Setup versioning automatico"
npm run version:tag
```

## 📊 Changelog Automatico

Il sistema genera automaticamente `CHANGELOG.md`:

```markdown
# GameStringer Changelog

## 🚀 v3.3.0 - 2025-01-07
- Sistema debug integrato nelle impostazioni
- Collapsible sidebar con animazioni
- Steam API testing migliorato

## 🔧 v3.2.1 - 2025-01-06  
- Risolto bug force refresh
- UI miglioramenti dashboard
```

## 🎨 Customizzazione

### Modifica Colori Versione
```typescript
// lib/version.ts - getVersionColor()
if (major >= 4) return 'text-purple-400'; // Futuro
if (major >= 3) return 'text-green-400';  // Corrente
```

### Aggiungi Nuovi Hook
```bash
# .githooks/pre-push
# .githooks/commit-msg
```

### Personalizza Changelog
```javascript
// scripts/version-manager.js - generateChangelog()
const typeIcon = {
  major: '💥',
  minor: '🚀', 
  patch: '🔧'
};
```

## 🚨 Best Practices

1. **Commit Frequenti**: Build number auto-incrementa
2. **Descrizioni Changelog**: Usa comandi con descrizioni
3. **Tag Release**: Sempre fare tag per release
4. **Branch Protection**: Main branch protetto
5. **Semantic Commits**: Use conventional commits

## 🔍 Troubleshooting

### Git Hooks Non Funzionano
```bash
node scripts/setup-hooks.js
git config core.hooksPath .githooks
```

### Version.json Corrotto
```bash
git checkout HEAD -- version.json
npm run version:status
```

### Build Number Bloccato
```bash
npm run version:build
```

---
*Sistema di versioning GameStringer v3.2.1 - Automatico, Affidabile, Semplice*