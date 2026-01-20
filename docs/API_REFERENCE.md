# API Reference - GameStringer

## 🌐 Panoramica

GameStringer utilizza Next.js API Routes per gestire tutte le operazioni backend. Le API sono organizzate per dominio funzionale e seguono i principi RESTful.

## 🔐 Autenticazione

### Base URL
```
http://localhost:3000/api
```

### Headers Richiesti
```typescript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <session-token>' // Per endpoint protetti
}
```

## 📚 Endpoints

### 🎮 Games API

#### `GET /api/games`
Recupera la lista dei giochi.

**Response:**
```json
[
  {
    "id": "game-id",
    "title": "Game Title",
    "path": "/path/to/game",
    "isInstalled": true
  }
]
```

#### `POST /api/games`
Crea un nuovo gioco.

**Request Body:**
```json
{
  "title": "Game Title",
  "installPath": "/path/to/game",
  "platform": "steam",
  "isInstalled": true
}
```

### 🔧 Patches API

#### `GET /api/patches`
Lista tutte le patch o una specifica.

**Query Parameters:**
- `id` (optional): ID patch specifica
- `gameId` (optional): Filtra per gioco

**Response:**
```json
[
  {
    "id": "patch-id",
    "gameId": "game-id",
    "name": "Patch Name",
    "description": "Description",
    "version": "1.0.0",
    "author": "Author Name",
    "language": "it",
    "files": [],
    "isActive": true,
    "createdAt": "2025-07-01T12:00:00Z",
    "updatedAt": "2025-07-01T12:00:00Z"
  }
]
```

#### `POST /api/patches`
Crea una nuova patch.

**Request Body:**
```json
{
  "gameId": "game-id",
  "name": "Patch Name",
  "description": "Description",
  "version": "1.0.0",
  "author": "Author Name",
  "language": "it"
}
```

#### `PUT /api/patches`
Aggiorna una patch esistente.

**Request Body:**
```json
{
  "id": "patch-id",
  "name": "Updated Name",
  "description": "Updated Description",
  "version": "1.0.1"
}
```

#### `DELETE /api/patches`
Elimina una patch.

**Query Parameters:**
- `id` (required): ID della patch da eliminare

#### `POST /api/patches/export`
Esporta una patch come ZIP.

**Request Body:**
```json
{
  "patchId": "patch-id",
  "options": {
    "includeOriginals": true,
    "compress": true
  }
}
```

**Response:** Binary ZIP file

### 🌍 Translations API

#### `GET /api/translations`
Recupera traduzioni con filtri.

**Query Parameters:**
- `gameId` (optional): Filtra per gioco
- `status` (optional): pending | completed | reviewed | edited
- `search` (optional): Ricerca testuale

**Response:**
```json
[
  {
    "id": "translation-id",
    "gameId": "game-id",
    "filePath": "/path/to/file",
    "originalText": "Original text",
    "translatedText": "Translated text",
    "targetLanguage": "it",
    "sourceLanguage": "en",
    "status": "completed",
    "confidence": 0.95,
    "isManualEdit": false,
    "context": "UI Button",
    "createdAt": "2025-07-01T12:00:00Z",
    "updatedAt": "2025-07-01T12:00:00Z",
    "game": {
      "id": "game-id",
      "title": "Game Title"
    },
    "suggestions": []
  }
]
```

#### `POST /api/translations`
Crea una nuova traduzione.

**Request Body:**
```json
{
  "gameId": "game-id",
  "filePath": "/path/to/file",
  "originalText": "Text to translate",
  "targetLanguage": "it",
  "sourceLanguage": "en"
}
```

#### `PUT /api/translations`
Aggiorna una traduzione.

**Request Body:**
```json
{
  "id": "translation-id",
  "translatedText": "Updated translation",
  "status": "edited",
  "isManualEdit": true
}
```

#### `DELETE /api/translations`
Elimina una traduzione.

**Query Parameters:**
- `id` (required): ID traduzione

#### `POST /api/translations/suggestions`
Genera suggerimenti AI per una traduzione.

**Request Body:**
```json
{
  "translationId": "translation-id",
  "originalText": "Text to translate",
  "targetLanguage": "it"
}
```

**Response:**
```json
[
  {
    "id": "suggestion-id",
    "suggestion": "Suggested translation",
    "confidence": 0.92,
    "provider": "openai"
  }
]
```

#### `POST /api/translations/import`
Importa traduzioni da file.

**Request Body (multipart/form-data):**
- `file`: File da importare (JSON, CSV, PO)
- `gameId`: ID del gioco
- `language`: Lingua target

#### `GET /api/translations/export`
Esporta traduzioni.

**Query Parameters:**
- `gameId` (required): ID del gioco
- `format` (required): json | csv | po
- `status` (optional): Filtra per stato

### 🏪 Stores API

#### `POST /api/stores/test-connection`
Testa la connessione a uno store.

**Request Body:**
```json
{
  "provider": "steam-credentials"
}
```

**Response:**
```json
{
  "connected": true,
  "error": null
}
```

### 🔑 Auth API

#### `POST /api/auth/signin`
Accedi con un provider.

**Providers Supportati:**
- `steam-credentials`
- `epicgames`
- `ubisoft-credentials`
- `itchio-credentials`
- `gog-credentials`
- `origin-credentials`
- `battlenet-credentials`

#### `POST /api/auth/signout`
Disconnetti l'utente corrente.

#### `GET /api/auth/session`
Recupera la sessione corrente.

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "accounts": [
      {
        "provider": "steam-credentials",
        "providerAccountId": "76561198000000000"
      }
    ]
  }
}
```

### 🛠️ Utilities API

#### `POST /api/utilities/howlongtobeat`
Cerca informazioni sui tempi di completamento.

**Request Body:**
```json
{
  "search": "The Witcher 3"
}
```

**Response:**
```json
{
  "gameId": 10270,
  "name": "The Witcher 3: Wild Hunt",
  "imageUrl": "...",
  "timeLabels": [
    ["Main Story", "51½ Hours"],
    ["Main + Extras", "103 Hours"],
    ["Completionist", "173 Hours"]
  ]
}
```

#### `GET /api/utilities/steamgriddb`
Cerca artwork per giochi.

**Query Parameters:**
- `search` (required): Nome del gioco

**Headers:**
- `X-API-Key` (required): SteamGridDB API key

**Response:**
```json
[
  {
    "id": 1234,
    "url": "https://...",
    "thumb": "https://...",
    "width": 920,
    "height": 430
  }
]
```

#### `POST /api/utilities/preferences`
Salva preferenze utility.

**Request Body:**
```json
{
  "service": "steamgriddb",
  "enabled": true,
  "apiKey": "your-api-key"
}
```

#### `DELETE /api/utilities/preferences`
Rimuove preferenze utility.

**Query Parameters:**
- `service` (required): Nome del servizio

### 🚂 Steam API

#### `POST /api/steam/auto-detect-config`
Rileva automaticamente la configurazione Steam.

**Response:**
```json
{
  "sharedAccounts": ["76561198000000001", "76561198000000002"],
  "steamPath": "C:\\Program Files (x86)\\Steam"
}
```

## 🔒 Gestione Errori

Tutte le API seguono uno schema di errore standard:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Codici di Errore Comuni

- `400` - Bad Request: Parametri mancanti o non validi
- `401` - Unauthorized: Autenticazione richiesta
- `403` - Forbidden: Permessi insufficienti
- `404` - Not Found: Risorsa non trovata
- `500` - Internal Server Error: Errore del server

## 📝 Rate Limiting

- **Richieste per minuto**: 60 (autenticato), 30 (non autenticato)
- **Header di risposta**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## 🧪 Testing

### Ambiente di Test
```bash
# Imposta variabili d'ambiente
cp .env.example .env.test

# Esegui test API
npm run test:api
```

### Esempio con cURL
```bash
# Get games
curl http://localhost:3000/api/games

# Create patch (autenticato)
curl -X POST http://localhost:3000/api/patches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"gameId":"1","name":"Test Patch"}'
```

## 🔗 SDK TypeScript

```typescript
// Esempio di client TypeScript
class GameStringerAPI {
  private baseURL = 'http://localhost:3000/api';
  
  async getGames(): Promise<Game[]> {
    const res = await fetch(`${this.baseURL}/games`);
    return res.json();
  }
  
  async createPatch(data: PatchData): Promise<Patch> {
    const res = await fetch(`${this.baseURL}/patches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }
}
```

---

**Ultimo aggiornamento**: 1 Luglio 2025
