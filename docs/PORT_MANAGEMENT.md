# 🔧 Sistema di Gestione Porte - GameStringer

Il nuovo sistema unificato per la gestione delle porte risolve definitivamente i problemi di sincronizzazione tra Next.js e Tauri.

## 🎯 Problema Risolto

Prima avevamo:
- ❌ Porte che cambiavano random tra `.port`, `tauri.conf.json` e script
- ❌ `ChunkLoadError` dovuti a mismatch di porte
- ❌ `Internal Server Error` quando Tauri non trovava Next.js
- ❌ Necessità di correggere manualmente le configurazioni

## ✅ Soluzione Implementata

### 📁 File Coinvolti

1. **`scripts/port-manager.js`** - Core del sistema di gestione porte
2. **`scripts/unified-dev.js`** - Server di sviluppo unificato
3. **`scripts/test-port-system.js`** - Test del sistema
4. **`.port`** - File con la porta attiva
5. **`src-tauri/tauri.conf.json`** - Configurazione Tauri
6. **`package.json`** - Script npm aggiornati

### 🚀 Script NPM Aggiornati

```bash
# Sviluppo frontend (raccomandato)
npm run dev                    # Next.js con port sync automatico

# Sviluppo completo (desktop app)
npm run tauri:dev              # Next.js + Tauri con port sync

# Utilities di gestione porte
npm run dev:sync               # Solo sincronizzazione porte
npm run dev:sync 3002          # Forza porta specifica
npm run dev:check              # Verifica configurazioni
npm run dev:test               # Test completo sistema

# Metodi legacy (ancora funzionanti)
npm run dev:simple             # Next.js standard (no port sync)
```

## 🔧 Come Funziona

### 1. Auto-Sincronizzazione
Ogni volta che avvii `npm run dev` o `npm run tauri:dev`:

1. **Legge porta corrente** da `.port`
2. **Verifica disponibilità** della porta
3. **Sincronizza configurazioni**:
   - `.port` ← porta attiva
   - `tauri.conf.json` ← devUrl aggiornato
   - Variabili ambiente impostate
4. **Avvia i servizi** con porte allineate

### 2. Gestione Conflitti
Se la porta configurata è occupata:

1. **Trova automaticamente** la prossima porta disponibile
2. **Aggiorna tutte le configurazioni** con la nuova porta
3. **Continua l'avvio** senza errori

### 3. Verifica Stato
```bash
npm run dev:check
```
Mostra:
- 📄 Porta in `.port`
- 🦀 URL in `tauri.conf.json`
- 🚪 Disponibilità porta
- ✅/❌ Stato sincronizzazione

## 🎮 Esempi di Uso

### Avvio Normale
```bash
npm run dev
```
```
🔧 === PORT MANAGER === Sincronizzazione porte...
✅ Porta 3000 disponibile
🌐 Avvio Next.js sulla porta 3000...
✅ Next.js pronto su http://localhost:3000
✅ === SISTEMA PRONTO ===
🌐 Frontend: http://localhost:3000
🛠️  Store Manager: http://localhost:3000/store-manager
```

### Cambio Porta
```bash
npm run dev:sync 3002
```
```
🔧 === PORT MANAGER === Sincronizzazione porte...
🎯 Usando porta forzata: 3002
✅ Porta 3002 salvata in .port
✅ tauri.conf.json aggiornato: devUrl = http://127.0.0.1:3002
✅ === PORT MANAGER === Sincronizzazione completata!
```

### Test Completo Sistema
```bash
npm run dev:test
```
```
🧪 === TEST PORT SYSTEM ===
📋 Test 1: Verifica configurazione attuale
🔧 Test 2: Sincronizzazione porte
🔍 Test 3: Verifica dopo sincronizzazione
🚪 Test 4: Test disponibilità porta
🔍 Test 5: Ricerca porta alternativa
🎯 === RISULTATO TEST ===
✅ Porta configurata: 3000
✅ Porta disponibile: SÌ
✅ Sistema pronto per l'uso!
```

## 🛠️ Troubleshooting

### Problema: ChunkLoadError
**Soluzione:**
```bash
npm run dev:sync    # Ri-sincronizza tutto
npm run dev         # Riavvia con porte allineate
```

### Problema: Internal Server Error su Tauri
**Soluzione:**
```bash
npm run dev:check   # Verifica sincronizzazione
npm run tauri:dev   # Avvia con sync automatico
```

### Problema: Porta occupata
**Soluzione:** Il sistema trova automaticamente una porta libera:
```bash
npm run dev:sync 3010   # Forza porta specifica
# oppure
npm run dev             # Auto-detect porta libera
```

### Problema: Configurazioni incasinate
**Soluzione:** Reset completo:
```bash
rm .port
npm run dev:sync 3000   # Ricrea tutto da zero
npm run dev:test        # Verifica
```

## 🔬 Debug Avanzato

### Log dettagliati
```bash
DEBUG=true npm run dev
```

### Controllo manuale porte
```bash
node scripts/port-manager.js find 3000    # Trova porta libera
node scripts/port-manager.js check        # Testa porta corrente
```

### Verifica configurazione Tauri
```bash
cat src-tauri/tauri.conf.json | grep devUrl
cat .port
```

## 💡 Tips

1. **Usa sempre `npm run dev`** invece di `npm run dev:simple`
2. **Per desktop app usa `npm run tauri:dev`** 
3. **Se cambi porta manualmente, usa `npm run dev:sync`**
4. **Prima di segnalare bug, prova `npm run dev:test`**

## 🎯 Benefici

- ✅ **Zero configurazione manuale** delle porte
- ✅ **Niente più ChunkLoadError**
- ✅ **Auto-recovery** se porta occupata
- ✅ **Sincronizzazione garantita** tra tutti i file
- ✅ **Test automatici** per verificare il sistema
- ✅ **Graceful shutdown** di tutti i processi

## 🚀 Ready to Rock!

Il sistema è ora **bullet-proof**. Non dovrai mai più preoccuparti delle porte!

```bash
npm run dev         # E sei pronto! 🎮
```