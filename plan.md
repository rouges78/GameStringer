# Piano di Sviluppo - GameStringer

## Note

- Il nome ufficiale del progetto è **GameStringer**.
- La roadmap di business (`GameStringer_Roadmap.md`) è il documento di riferimento per la visione a lungo termine.
- La scansione dei giochi attuale si basa sulla ricerca nel filesystem locale, non su connessioni API in tempo reale agli store (Steam, GOG, etc.). L'integrazione delle API è un passo futuro.

## Task List

- [x] Standardizzare il nome del progetto in "GameStringer" (`package.json`, `README.md`).
- [x] Gestire e integrare il logo dell'applicazione (`logo.png`).
  - [x] Creare la cartella `public` per le risorse statiche.
  - [x] Spostare il logo e integrarlo nel layout principale.
  - [x] Aggiornare tutti i riferimenti testuali da "GameTranslator" a "GameStringer".
- [x] Sostituire l'API di scansione dei giochi fittizia con una reale.
  - [x] Implementare la scansione del filesystem per le directory di default di Steam, GOG, ed Epic Games.
  - [x] Aggiungere la logica per leggere il file `libraryfolders.vdf` di Steam per trovare librerie personalizzate.
- [x] Risolvere bug tecnici.
  - [x] Correggere errori di tipo TypeScript nell'API di scansione.
  - [x] Risolvere l'errore di idratazione di React spostando il `ThemeProvider`.
- [ ] Testare e validare la nuova funzionalità di scansione dei giochi con l'utente.
- [ ] Salvare i giochi scansionati nel database (Prisma) per evitare nuove scansioni ad ogni avvio.
- [ ] Migliorare il recupero dei metadati dei giochi.
  - [ ] Estrarre le icone dei giochi direttamente dai file locali (es. `.exe`).
  - [ ] Implementare il recupero di metadati ufficiali (copertine, descrizioni) tramite API online (es. SteamGridDB, IGDB).
- [ ] Iniziare lo sviluppo delle funzionalità di traduzione principali.
  - [ ] Costruire l'interfaccia utente della pagina "Traduttore".
  - [ ] Sviluppare un proof-of-concept per l'iniezione/estrazione di testo su un gioco di test.

## Current Goal

Testare la funzionalità di scansione dei giochi e validare i risultati.
