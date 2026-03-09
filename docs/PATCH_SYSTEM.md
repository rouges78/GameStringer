# Sistema di Gestione Patch - GameStringer

## 📋 Panoramica

Il sistema di patch di GameStringer permette di creare, gestire ed esportare modifiche di traduzione per i giochi PC. Le patch sono organizzate per gioco e possono contenere traduzioni per multiple lingue e file.

## 🏗️ Architettura

### Database Schema

```prisma
model Patch {
  id          String   @id @default(cuid())
  gameId      String
  name        String
  description String?
  version     String   @default("1.0.0")
  author      String?
  language    String   @default("it")
  files       Json     @default("[]")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  game        Game     @relation(fields: [gameId], references: [id])
}
```text

### API Endpoints

#### `/api/patches`

- **GET**: Lista tutte le patch o una specifica
  - Query params: `id`, `gameId`
- **POST**: Crea una nuova patch
- **PUT**: Aggiorna una patch esistente
- **DELETE**: Elimina una patch

#### `/api/patches/export`

- **POST**: Esporta una patch come file ZIP
  - Body: `{ patchId, options }`
  - Response: Binary ZIP file

## 🎯 Funzionalità Principali

### 1. Creazione Patch

- Selezione gioco target
- Nome e descrizione patch
- Selezione lingua di traduzione
- Informazioni autore
- Versionamento semantico

### 2. Editor Patch

- Aggiunta file da tradurre
- Editor inline per modifiche
- Anteprima modifiche
- Validazione sintassi

### 3. Export/Import

- Export in formato ZIP strutturato
- Metadati patch in `patch.json`
- File originali e modificati
- Istruzioni installazione

### 4. Gestione Stati

- **Active**: Patch attiva e utilizzabile
- **Inactive**: Patch disabilitata
- **Draft**: Patch in lavorazione

## 💻 Interfaccia Utente

### Pagina Patches (`/patches`)

La pagina è organizzata in 3 tab principali:

1. **Le Mie Patch**
   - Lista patch create
   - Filtri per gioco/stato
   - Ricerca testuale
   - Azioni rapide (export, delete)

2. **Crea Nuova**
   - Form creazione guidata
   - Selezione gioco con autocomplete
   - Editor metadati
   - Validazione in tempo reale

3. **Dettagli**
   - Informazioni complete patch
   - Lista file inclusi
   - Statistiche traduzioni
   - Log modifiche

### Componenti UI

```typescript
// Struttura componente principale
export default function PatchesPage() {
  // Stati
  const [patches, setPatches] = useState<Patch[]>([])
  const [selectedPatch, setSelectedPatch] = useState<Patch | null>(null)
  const [games, setGames] = useState<GameInfo[]>([])
  
  // Effetti
  useEffect(() => {
    loadPatches()
    loadGames()
  }, [])
  
  // Handlers
  const handleCreatePatch = async (data: PatchFormData) => { ... }
  const handleExportPatch = async (patchId: string) => { ... }
  const handleDeletePatch = async (patchId: string) => { ... }
  
  return (
    <Tabs>
      <TabsList>...</TabsList>
      <TabsContent>...</TabsContent>
    </Tabs>
  )
}
```text

## 🔧 Risoluzione Problemi

### Problema: File page.tsx corrotto

**Sintomi**: Errore 500, "Unexpected token" nel browser
**Causa**: Sovrapposizione di testo e tag JSX non chiusi
**Soluzione**:

1. Backup del file corrotto
2. Ricreazione completa con sintassi corretta
3. Validazione JSX e TypeScript

### Problema: API Games incompatibile

**Sintomi**: Dropdown giochi vuoto
**Causa**: Struttura dati non corrispondente a `GameInfo`
**Soluzione**: Mappatura campi in `/api/games/route.ts`:

```typescript
const mappedGames = games.map(game => ({
  id: game.id,
  title: game.title,
  path: game.installPath,
  isInstalled: game.isInstalled
}))
```text

## 📦 Formato Export Patch

```text
patch-name.zip
├── patch.json          # Metadati patch
├── files/             # File modificati
│   ├── original/      # File originali (backup)
│   └── patched/       # File con modifiche
└── README.txt         # Istruzioni installazione
```text

### Struttura patch.json

```json
{
  "id": "patch-id",
  "name": "Nome Patch",
  "game": {
    "id": "game-id",
    "title": "Titolo Gioco"
  },
  "version": "1.0.0",
  "author": "Autore",
  "language": "it",
  "created": "2025-07-01T12:00:00Z",
  "files": [
    {
      "path": "relative/path/to/file",
      "hash": "original-file-hash",
      "changes": 42
    }
  ]
}
```text

## 🚀 Best Practices

1. **Versionamento**: Usa semantic versioning (MAJOR.MINOR.PATCH)
2. **Backup**: Sempre includere file originali nell'export
3. **Documentazione**: Aggiungi README con istruzioni chiare
4. **Testing**: Testa la patch su una copia del gioco
5. **Compatibilità**: Specifica versione gioco supportata

## 🔮 Sviluppi Futuri

- [ ] Sistema di dipendenze tra patch
- [ ] Merge automatico di patch multiple
- [ ] Validazione compatibilità versioni
- [ ] Marketplace per condivisione patch
- [ ] Auto-update patch
- [ ] Rollback automatico in caso di errori

## 📚 Riferimenti

- [Documentazione API](./API_REFERENCE.md)
- [Guida Traduzioni](./TRANSLATION_EDITOR.md)
- [Setup Development](../README.md)

---

**Ultimo aggiornamento**: 1 Luglio 2025
