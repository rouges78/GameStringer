# GameStringer Satellite Plugin

Plugin BepInEx per la traduzione in-game di giochi Unity.

## Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                    GameStringer Desktop                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Tauri     │  │    Rust     │  │  Translation        │  │
│  │  Frontend   │◄─┤   Backend   │◄─┤  Memory (HashMap)   │  │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ Shared Memory IPC
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Unity Game Process                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              GameStringer.Satellite.dll              │    │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────────────┐  │    │
│  │  │  BepInEx  │  │ HarmonyX  │  │  Local Cache    │  │    │
│  │  │  Loader   │  │  Patches  │  │  (Dictionary)   │  │    │
│  │  └───────────┘  └─────┬─────┘  └─────────────────┘  │    │
│  └───────────────────────┼─────────────────────────────┘    │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  TMPro.TMP_Text  │  UI.Text  │  TextMesh           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Componenti

### 1. Plugin.cs
Entry point del plugin BepInEx. Inizializza il bridge di traduzione e applica le patch Harmony.

### 2. TranslationBridge.cs
Gestisce la comunicazione con il backend Rust tramite shared memory. Include:
- Connessione/disconnessione dalla shared memory
- Cache locale per traduzioni frequenti
- Hash FNV-1a compatibile con l'implementazione Rust

### 3. Patches/TextPatches.cs
Patch Harmony per intercettare i setter di testo Unity:
- `TMPro.TMP_Text.set_text` - TextMeshPro moderno
- `TMPro.TextMeshProUGUI.set_text` - TextMeshPro UI
- `UnityEngine.UI.Text.set_text` - Legacy UI Text
- `UnityEngine.TextMesh.set_text` - 3D Text

## Installazione

### Per giochi Mono (Unity < 2021)
1. Installa BepInEx 5.x nella cartella del gioco
2. Copia `GameStringer.Satellite.dll` in `BepInEx/plugins/`

### Per giochi IL2CPP (Unity 2021+)
1. Installa BepInEx 6.x (IL2CPP) nella cartella del gioco
2. Copia `GameStringer.Satellite.dll` in `BepInEx/plugins/`

## Configurazione

Il plugin cerca automaticamente il backend GameStringer. Se non disponibile, funziona in modalità offline caricando traduzioni da file JSON locali.

### File di traduzione locale
Posiziona un file `translations.json` nella cartella del plugin:
```json
{
  "Hello": "Ciao",
  "World": "Mondo",
  "Start Game": "Inizia Gioco"
}
```

## Compatibilità

- ✅ Unity 2018.x - 2023.x
- ✅ Mono runtime
- ✅ IL2CPP runtime
- ✅ TextMeshPro
- ✅ Legacy UI.Text
- ✅ 3D TextMesh

## Performance

- **Latenza**: < 1ms per traduzione (con shared memory)
- **Cache hit**: ~100ns (lookup in HashMap locale)
- **Memoria**: ~10MB per 100.000 traduzioni

## Troubleshooting

### Il testo non viene tradotto
1. Verifica che BepInEx sia installato correttamente
2. Controlla i log in `BepInEx/LogOutput.log`
3. Assicurati che GameStringer Desktop sia in esecuzione

### Caratteri mancanti (quadrati □)
Il gioco non ha i font necessari. Vedi la sezione Font Bundle nel README principale.
