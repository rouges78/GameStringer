# Piano di Azione - Ripristino Sistema Profili

**Data:** 10 Agosto 2025  
**Basato su:** Diagnostic Report Completo

## Priorità Critica - Azioni Immediate

### 1. Pulizia Ambiente di Sviluppo
```bash
# Ferma tutti i processi attivi
taskkill /F /IM node.exe /T
taskkill /F /IM gamestringer.exe /T

# Pulisci cache Next.js
rm -rf .next
rm -rf node_modules/.cache

# Pulisci build Tauri
cd src-tauri && cargo clean && cd ..

# Reinstalla dipendenze
npm install
```

### 2. Verifica e Reset Porte
```bash
# Controlla porta 3077
netstat -ano | findstr :3077

# Se occupata, termina processo
# taskkill /F /PID <process_id>

# Verifica configurazione porte
npm run dev:check
```

### 3. Test Isolato Backend Rust
```bash
# Test compilazione
cd src-tauri
cargo check --verbose

# Test specifico profili
cargo test profiles:: --verbose

# Test comandi Tauri
cargo test commands::profiles:: --verbose
```

## Priorità Alta - Riparazione Componenti

### 4. Test Comunicazione Tauri-React

**Creare test isolato:**
```typescript
// test-tauri-communication.ts
import { invoke } from '@tauri-apps/api/core';

async function testProfilesAPI() {
  try {
    console.log('Testing list_profiles...');
    const profiles = await invoke('list_profiles');
    console.log('Profiles:', profiles);
    
    console.log('Testing get_current_profile...');
    const current = await invoke('get_current_profile');
    console.log('Current profile:', current);
    
    return true;
  } catch (error) {
    console.error('Tauri API Error:', error);
    return false;
  }
}
```

### 5. Verifica Stato Database Profili
```bash
# Controlla directory profili
ls -la profiles/

# Verifica integrità file
node scripts/check-profiles-integrity.js

# Reset se necessario
node reset-profiles.js
```

### 6. Test Componenti Frontend Isolati

**Test ProfileWrapper:**
```typescript
// Creare test-profile-wrapper.tsx
import { ProfileWrapper } from '@/components/profiles/profile-wrapper';

export default function TestProfileWrapper() {
  return (
    <div>
      <h1>Test ProfileWrapper</h1>
      <ProfileWrapper>
        <div>Content loaded successfully</div>
      </ProfileWrapper>
    </div>
  );
}
```

## Priorità Media - Ottimizzazione

### 7. Verifica Configurazione Tauri
```json
// Verifica src-tauri/tauri.conf.json
{
  "build": {
    "devUrl": "http://127.0.0.1:3077"
  }
}
```

### 8. Debug Logging Avanzato

**Attivare logging dettagliato:**
```rust
// In main.rs
use log::{info, debug, error};

fn main() {
    env_logger::init();
    info!("Starting GameStringer with profiles system");
    
    // ... resto del codice
}
```

### 9. Verifica Session Persistence
```typescript
// Test session-persistence.ts
import { sessionPersistence } from '@/lib/session-persistence';

async function testSessionPersistence() {
  try {
    await sessionPersistence.restoreSession();
    console.log('Session persistence OK');
  } catch (error) {
    console.error('Session persistence error:', error);
  }
}
```

## Priorità Bassa - Monitoraggio

### 10. Setup Monitoring Avanzato
```typescript
// Aggiungere in ProfileWrapper
useEffect(() => {
  console.log('ProfileWrapper mounted');
  console.log('Current pathname:', pathname);
  console.log('Requires auth:', requireAuth);
}, [pathname, requireAuth]);
```

### 11. Verifica Performance
```bash
# Analisi bundle size
npm run build
npx @next/bundle-analyzer

# Profiling Rust
cargo build --release
```

## Script di Automazione

### Script di Diagnosi Rapida
```bash
#!/bin/bash
# quick-diagnosis.sh

echo "🔍 Quick Profiles System Diagnosis"

echo "1. Checking Rust compilation..."
cd src-tauri && cargo check --quiet && echo "✅ Rust OK" || echo "❌ Rust FAIL"

echo "2. Checking TypeScript..."
cd .. && npx tsc --noEmit --skipLibCheck && echo "✅ TypeScript OK" || echo "❌ TypeScript FAIL"

echo "3. Checking ports..."
netstat -ano | findstr :3077 && echo "⚠️ Port 3077 occupied" || echo "✅ Port 3077 free"

echo "4. Checking profiles directory..."
ls profiles/ 2>/dev/null && echo "✅ Profiles dir exists" || echo "⚠️ Profiles dir missing"

echo "5. Testing Tauri build..."
cd src-tauri && cargo build --quiet && echo "✅ Tauri build OK" || echo "❌ Tauri build FAIL"
```

### Script di Reset Completo
```bash
#!/bin/bash
# full-reset.sh

echo "🔄 Full Profiles System Reset"

echo "1. Stopping all processes..."
taskkill /F /IM node.exe /T 2>/dev/null
taskkill /F /IM gamestringer.exe /T 2>/dev/null

echo "2. Cleaning caches..."
rm -rf .next node_modules/.cache
cd src-tauri && cargo clean && cd ..

echo "3. Reinstalling dependencies..."
npm install

echo "4. Resetting profiles data..."
rm -rf profiles/
mkdir profiles

echo "5. Testing setup..."
npm run profiles:verify

echo "✅ Reset completed"
```

## Checklist di Verifica

### Pre-Riparazione
- [ ] Backup dati profili esistenti
- [ ] Documentazione errori specifici
- [ ] Screenshot problemi UI
- [ ] Log errori completi

### Durante Riparazione
- [ ] Test ogni componente isolatamente
- [ ] Verifica dopo ogni modifica
- [ ] Logging dettagliato attivo
- [ ] Monitoraggio performance

### Post-Riparazione
- [ ] Test end-to-end completo
- [ ] Verifica tutti i flussi utente
- [ ] Test stress sistema
- [ ] Documentazione modifiche

## Metriche di Successo

### Backend Rust
- ✅ Compilazione senza errori/warning
- ✅ Tutti i test unitari passano
- ✅ Comandi Tauri rispondono correttamente

### Frontend React
- ✅ Build Next.js senza errori
- ✅ Componenti renderizzano correttamente
- ✅ Hooks funzionano senza errori

### Integrazione
- ✅ Comunicazione Tauri-React fluida
- ✅ Startup applicazione < 3 secondi
- ✅ Cambio profilo < 1 secondo

### Funzionalità
- ✅ Creazione profilo funzionante
- ✅ Autenticazione profilo funzionante
- ✅ Cambio profilo funzionante
- ✅ Persistenza dati corretta

---

**Prossimo Step:** Eseguire azioni Priorità Critica in sequenza