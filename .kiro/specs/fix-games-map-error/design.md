# Documento di Design - Fix Errore games.map e Profili Multipli

## Panoramica

Il sistema presenta due problemi critici:
1. Errore `games.map is not a function` nella libreria giochi
2. Visualizzazione di 3 profili attivi quando dovrebbe essercene solo uno

Questo design risolve entrambi i problemi implementando protezioni robuste per gli array e correggendo la logica di gestione dei profili.

## Architettura

### Componenti Coinvolti

1. **LibraryPage** (`app/library/page.tsx`)
   - Gestione stato games con protezioni array
   - Validazione dati API
   - Error handling robusto

2. **ProfileSelector** (`components/profiles/profile-selector.tsx`)
   - Correzione logica profili attivi
   - Gestione stato sessione

3. **ProfileManager** (`components/profiles/profile-manager.tsx`)
   - Validazione profili caricati
   - Cleanup profili duplicati

## Componenti e Interfacce

### 1. Array Protection Utilities

```typescript
// lib/array-utils.ts
export function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [];
}

export function safeMap<T, R>(
  array: unknown, 
  mapper: (item: T, index: number) => R
): R[] {
  const safeArray = ensureArray<T>(array);
  return safeArray.map(mapper);
}
```

### 2. Games State Management

```typescript
// Protezione per setGames
const setGamesWithValidation = (games: unknown) => {
  const validGames = ensureArray<Game>(games);
  setGames(validGames);
};

// Protezione per filteredGames
const filteredGames = useMemo(() => {
  const safeGames = ensureArray<Game>(games);
  return safeGames.filter(/* filtri */);
}, [games, /* altre dipendenze */]);
```

### 3. Profile State Correction

```typescript
// Correzione logica profili attivi
const getActiveProfiles = () => {
  const currentProfile = getCurrentProfile();
  return currentProfile ? [currentProfile] : [];
};
```

## Modelli Dati

### Game Interface (esistente)
```typescript
interface Game {
  id: string;
  title: string;
  platform: string;
  // ... altri campi
}
```

### Profile State
```typescript
interface ProfileState {
  activeProfile: Profile | null;
  availableProfiles: Profile[];
  isLoading: boolean;
}
```

## Gestione Errori

### 1. API Error Handling
- Catch di tutti gli errori API
- Fallback a array vuoto per games
- Logging dettagliato per debugging

### 2. Type Safety
- Validazione runtime dei tipi
- Protezioni per operazioni array
- Fallback sicuri per dati malformati

### 3. User Feedback
- Messaggi di errore user-friendly
- Stati di caricamento chiari
- Indicatori di stato profilo

## Strategia di Testing

### 1. Unit Tests
- Test per array utilities
- Test per validazione dati
- Test per gestione errori

### 2. Integration Tests
- Test caricamento libreria
- Test gestione profili
- Test scenari di errore

### 3. Manual Testing
- Verifica fix errore games.map
- Verifica singolo profilo attivo
- Test con dati API malformati

## Implementazione

### Fase 1: Array Protection
1. Creare utilities per protezione array
2. Aggiornare LibraryPage con protezioni
3. Testare caricamento libreria

### Fase 2: Profile Correction
1. Identificare causa profili multipli
2. Correggere logica profili attivi
3. Testare gestione profili

### Fase 3: Error Handling
1. Migliorare gestione errori API
2. Aggiungere logging dettagliato
3. Implementare fallback robusti

### Fase 4: Testing & Validation
1. Test completi funzionalità
2. Validazione fix problemi
3. Documentazione soluzioni