# Guida alla Risoluzione dei Problemi - GameStringer

## 🚨 Problemi Comuni e Soluzioni

### 1. Errore 500 - Pagina Patches

#### Sintomi
- Errore "500 | Internal Server Error" quando si accede a `/patches`
- Console mostra "Unexpected token" o errori JSX

#### Causa
File `app/patches/page.tsx` corrotto con:
- Testo sovrapposto
- Tag JSX non chiusi
- Sintassi TypeScript invalida

#### Soluzione
```bash
# 1. Backup del file corrotto
cp app/patches/page.tsx app/patches/page.tsx.corrupted

# 2. Sostituisci con versione pulita
# Il file è stato già ricreato e corretto

# 3. Riavvia il server
npm run dev
```

### 2. Dropdown Giochi Vuoto

#### Sintomi
- Il selettore giochi nella creazione patch è vuoto
- Nessun gioco disponibile nonostante siano presenti nel database

#### Causa
L'API `/api/games` restituisce una struttura dati incompatibile con l'interfaccia `GameInfo` attesa dal frontend.

#### Soluzione
Il file `app/api/games/route.ts` è stato aggiornato per mappare correttamente i campi:
```typescript
const mappedGames = games.map(game => ({
  id: game.id,
  title: game.title,
  path: game.installPath,
  isInstalled: game.isInstalled
}));
```

### 3. Errore TypeScript "Cannot find type definition file for 'long'"

#### Sintomi
- Errore TypeScript: "Cannot find type definition file for 'long'"
- `npx tsc --noEmit` fallisce con errore di definizione tipi
- Errore persiste nonostante @types/long sia installato

#### Causa
Conflitto tra due definizioni di tipo per 'long':
- `@xtuc/long` (dipendenza indiretta di webpack/webassembly) fornisce già le definizioni
- `@types/long` crea un conflitto duplicato

#### Soluzione
```bash
# Rimuovi @types/long che è ridondante
npm uninstall @types/long

# Verifica che l'errore sia risolto
npx tsc --noEmit
```

#### Note Tecniche
- `@xtuc/long` è una dipendenza indiretta di `@webassemblyjs`
- Fornisce definizioni complete per il tipo Long
- Non è necessario `@types/long` aggiuntivo

### 4. Errori Prisma EPERM su Windows

#### Sintomi
```
Error: EPERM: operation not permitted, rename
'node_modules\.prisma\client\...'
```

#### Causa
Permessi insufficienti per modificare file in `node_modules` su Windows.

#### Soluzione
```bash
# Esegui PowerShell come Amministratore
# Poi esegui:
npx prisma generate
```

### 4. Database Non Inizializzato

#### Sintomi
- Errori "Table not found"
- Impossibile salvare dati

#### Causa
Database SQLite non creato o schema non applicato.

#### Soluzione
```bash
# 1. Genera Prisma Client
npx prisma generate

# 2. Crea/aggiorna database
npx prisma db push

# 3. (Opzionale) Popola con dati di test
npx tsx scripts/seed-translations.ts
```

### 5. Autenticazione Steam Non Funziona

#### Sintomi
- Login Steam fallisce
- Cookie `steamLoginSecure` scaduto

#### Causa
Cookie di autenticazione non valido o scaduto.

#### Soluzione
1. Accedi a https://store.steampowered.com nel browser
2. Apri DevTools (F12) → Application → Cookies
3. Copia il valore di `steamLoginSecure`
4. Aggiorna `.env.local`:
```env
STEAM_LOGIN_SECURE=nuovo_valore_cookie
```

### 6. Import Traduzioni Fallisce

#### Sintomi
- Errore durante import file JSON/CSV/PO
- File non riconosciuto

#### Causa
Formato file non corretto o encoding errato.

#### Soluzione
Verifica il formato del file:

**JSON valido:**
```json
[
  {
    "original": "Hello",
    "translation": "Ciao",
    "context": "greeting"
  }
]
```

**CSV valido:**
```csv
original,translation,context
"Hello","Ciao","greeting"
```

### 7. Epic Games OAuth Loop Infinito

#### Sintomi
- Redirect continuo dopo login Epic Games
- Impossibile completare autenticazione

#### Causa
Callback URL non configurato correttamente.

#### Soluzione
1. Verifica in Epic Games Developer Portal:
   - Redirect URI: `http://localhost:3000/api/auth/callback/epicgames`
2. Controlla `.env.local`:
```env
EPIC_CLIENT_ID=your_client_id
EPIC_CLIENT_SECRET=your_client_secret
```

### 8. Servizi Utility Non Si Attivano

#### Sintomi
- HowLongToBeat o SteamGridDB non funzionano
- Test connessione fallisce

#### Causa
API key mancante o non valida.

#### Soluzione
Per SteamGridDB:
1. Registrati su https://www.steamgriddb.com
2. Vai su Profile → Preferences → API
3. Copia la API key
4. Inseriscila quando richiesto nell'app

### 9. Export Patch Vuoto

#### Sintomi
- File ZIP scaricato ma vuoto
- Nessun file nella patch

#### Causa
Patch creata senza file associati.

#### Soluzione
1. Modifica la patch
2. Aggiungi almeno un file da tradurre
3. Salva le modifiche
4. Riprova l'export

### 10. Performance Lente con Molte Traduzioni

#### Sintomi
- UI lenta con 1000+ traduzioni
- Ricerca impiega troppo tempo

#### Causa
Mancanza di paginazione e indicizzazione.

#### Soluzione temporanea
Usa i filtri per ridurre i risultati:
- Filtra per gioco specifico
- Filtra per stato
- Usa ricerca mirata

## 🛠️ Comandi Utili per Debug

### Verifica Stato Database
```bash
# Controlla se il database esiste
ls prisma/

# Visualizza schema
cat prisma/schema.prisma

# Esegui query di test
npx prisma studio
```

### Reset Completo
```bash
# ATTENZIONE: Cancella tutti i dati!
rm prisma/dev.db
npx prisma db push
npx tsx scripts/seed-translations.ts
```

### Log Dettagliati
```bash
# Abilita log Prisma
export DEBUG="prisma:*"
npm run dev
```

### Verifica Dipendenze
```bash
# Controlla versioni
npm list @prisma/client next react

# Aggiorna dipendenze
npm update
```

## 📞 Supporto

Se il problema persiste:

1. **Controlla i log**:
   - Console del browser (F12)
   - Terminal del server
   - Log di Tauri (se app desktop)

2. **Raccogli informazioni**:
   - Sistema operativo e versione
   - Versione Node.js (`node -v`)
   - Screenshot dell'errore
   - Passi per riprodurre

3. **Segnala il problema**:
   - Apri una issue su GitHub
   - Includi tutte le informazioni raccolte
   - Usa tag appropriati (bug, help wanted)

## 🔍 Debug Avanzato

### Abilitare Source Maps
```json
// tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

### Ispezionare Richieste API
```javascript
// Aggiungi in app/layout.tsx
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('fetch', (e) => {
    console.log('API Call:', e.request.url);
  });
}
```

### Verificare Sessione Auth
```typescript
// Pagina di test: app/debug/page.tsx
import { getServerSession } from 'next-auth';

export default async function DebugPage() {
  const session = await getServerSession();
  return <pre>{JSON.stringify(session, null, 2)}</pre>;
}
```

---

**Ultimo aggiornamento**: 1 Luglio 2025
