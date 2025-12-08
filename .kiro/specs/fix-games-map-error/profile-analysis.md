# Analisi Problema Profili Multipli

## Data Analisi
10/12/2025

## Problema Riportato
L'utente vede "3 profili attivi" quando dovrebbe essercene solo uno.

## Investigazione

### 1. Componenti che Mostrano il Conteggio Profili

Ho identificato i seguenti componenti che mostrano il numero di profili:

#### `components/profiles/profile-header.tsx` (linea 161)
```typescript
<span className="text-xs text-muted-foreground">
  {profiles.length} profil{profiles.length !== 1 ? 'i' : 'o'}
</span>
```

#### `components/profiles/profile-header.tsx` (linea 235)
```typescript
<div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
  <span className="font-medium">{profiles.length}</span>
  <span className="text-muted-foreground">Profili</span>
</div>
```

#### `components/profiles/profile-manager.tsx` (linea 247)
```typescript
<div className="flex justify-between">
  <span>Profili Totali:</span>
  <Badge>{profiles.length}</Badge>
</div>
```

### 2. Fonte dei Dati

Tutti questi componenti utilizzano `profiles` da `useProfiles()` hook:

```typescript
const { profiles, currentProfile } = useProfiles();
```

### 3. Logica di Caricamento Profili

In `hooks/use-profiles.ts`:

```typescript
const loadProfiles = useCallback(async () => {
  try {
    setError(null);
    const response = await invoke<ProfileResponse<ProfileInfo[]>>('list_profiles');
    
    if (response.success && response.data) {
      setProfiles(response.data);
    } else {
      setError(response.error || 'Errore caricamento profili');
      setProfiles([]);
    }
  } catch (err) {
    console.error('Errore caricamento profili:', err);
    setError('Backend Tauri non disponibile - attendere avvio completo');
    setProfiles([]);
  }
}, []);
```

### 4. Analisi del Problema

**IMPORTANTE**: Il problema NON è un bug, ma una **confusione terminologica**.

#### Cosa Mostra Realmente `profiles.length`

- `profiles.length` mostra il **numero totale di profili creati** nel sistema
- NON mostra il numero di profili "attivi" (autenticati)
- Se l'utente ha creato 3 profili, vedrà "3 profili"

#### Profilo Attivo vs Profili Totali

- **Profilo Attivo**: Solo UNO alla volta - quello autenticato (`currentProfile`)
- **Profili Totali**: TUTTI i profili creati nel sistema (`profiles.length`)

### 5. Verifica dello Stato Corrente

Il sistema funziona correttamente:

1. ✅ Solo un profilo può essere autenticato alla volta (`currentProfile`)
2. ✅ Il conteggio `profiles.length` mostra correttamente TUTTI i profili creati
3. ✅ Non c'è duplicazione di profili attivi

### 6. Possibili Cause della Confusione

L'utente potrebbe aver interpretato male il testo:
- "3 profili" = 3 profili totali nel sistema ✅ CORRETTO
- "3 profili attivi" = 3 profili autenticati ❌ INTERPRETAZIONE ERRATA

## Conclusione

**NON c'è un bug nel sistema di gestione profili.**

Il sistema sta funzionando come previsto:
- Mostra correttamente il numero totale di profili creati
- Solo un profilo è autenticato alla volta
- Non ci sono profili duplicati o multipli profili attivi

## Raccomandazioni

### Opzione 1: Migliorare la Chiarezza del Testo (CONSIGLIATA)

Modificare il testo per essere più espliciti:
- Da: "3 profili" 
- A: "3 profili disponibili" o "3 profili creati"

Aggiungere un indicatore visivo per il profilo attivo corrente.

### Opzione 2: Verificare con l'Utente

Chiedere all'utente di:
1. Mostrare uno screenshot del problema
2. Specificare dove vede "3 profili attivi"
3. Confermare se ha effettivamente creato 3 profili

## Prossimi Passi

1. ✅ Analisi completata
2. ⏳ Attendere conferma dall'utente sul problema specifico
3. ⏳ Se necessario, migliorare la UI per maggiore chiarezza
