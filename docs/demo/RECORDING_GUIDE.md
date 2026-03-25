# 🎬 Guida Registrazione GIF Demo

## Tool: ScreenToGif (già installato)
Apri dal menu Start → **ScreenToGif**

## GIF da registrare (5 totali)

### 1. `demo-library.gif` — Libreria Giochi (8-10s)
1. Apri ScreenToGif → **Recorder** → ridimensiona a **1280×720**
2. Posiziona sopra la finestra GameStringer sulla pagina **Library**
3. **Azioni da registrare:**
   - Scroll lento nella lista giochi
   - Clicca su un gioco per aprire il dettaglio
   - Mostra screenshot gallery
4. Salva: `docs/demo/demo-library.gif`
   - FPS: 15, Quantizer: Neural, Loop: forever

### 2. `demo-translator.gif` — AI Translator (10-12s)
1. Vai alla pagina **AI Translator**
2. **Azioni da registrare:**
   - Seleziona un file da tradurre
   - Scegli provider (es. Gemini)
   - Avvia traduzione
   - Mostra progress bar e risultati con Quality Badge
4. Salva: `docs/demo/demo-translator.gif`

### 3. `demo-patcher.gif` — Game Patcher (8-10s)
1. Vai alla pagina **Patcher Engine**
2. **Azioni da registrare:**
   - Seleziona un engine (Unity/Unreal)
   - Mostra opzioni patch
   - Clicca "Applica Patch" (o mostra il flusso)
4. Salva: `docs/demo/demo-patcher.gif`

### 4. `demo-chat.gif` — Community Chat (8-10s)
1. Vai alla pagina **Community Hub** → tab Chat
2. **Azioni da registrare:**
   - Mostra le stanze disponibili
   - Entra in una stanza
   - Scrivi un messaggio
   - Mostra utenti online
4. Salva: `docs/demo/demo-chat.gif`

### 5. `demo-tray.gif` — Tray Icon Menu (5-7s)
1. Minimizza GameStringer in tray
2. **Azioni da registrare:**
   - Click destro sull'icona tray
   - Mostra il menu completo con tutte le voci
   - Hover sul submenu "Strumenti"
4. Salva: `docs/demo/demo-tray.gif`

## Impostazioni ScreenToGif consigliate
- **FPS**: 15 (buon compromesso qualità/dimensione)
- **Risoluzione**: 1280×720 o area finestra
- **Editor** → Save As → GIF
  - Encoder: **FFmpeg** (migliore compressione)
  - Quantizer: **Neural** o **Octree**
  - Max colori: **256**
  - Loop: **Forever**
  - Target: **< 5 MB** per GIF (GitHub ha limite 10 MB)

## Ottimizzazione dimensioni
Se una GIF è troppo grande (>5 MB):
1. Riduci FPS a 10
2. Riduci risoluzione a 960×540
3. Taglia frame duplicati nell'editor
4. Usa "Remove duplicates" nell'editor ScreenToGif
