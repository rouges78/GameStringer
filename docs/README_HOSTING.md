# GameStringer.ai - Hosting Instructions

Questa cartella contiene i file pronti per il deploy sul dominio **gamestringer.ai**.

## 📁 Struttura File

- `index.html`: Landing page principale (Italiano)
- `index-en.html`: Versione inglese
- `styles-v2.css`: CSS moderno con glassmorphism e animazioni
- `logo.svg`: Logo ufficiale (vettoriale)
- `logo.png`: Logo ufficiale (immagine)
- `favicon.png`: Icona del sito (è questa che caricano le pagine: `<link rel="icon" href="favicon.png">`)
- `favicon.svg`: variante SVG dello stesso marchio, non referenziata dalle pagine
- `images/`: Screenshot e asset grafici

## 🚀 Come Pubblicare

1. Carica tutti i file (tranne questo README) nella root del tuo web server (es. via FTP o File Manager dell'hosting).
2. Assicurati che la cartella `images/` venga caricata correttamente.
3. Il sito è statico (HTML/CSS/JS), quindi non richiede Node.js o database.

## 🛠️ Note Tecniche

- **Framework**: HTML5 / CSS3 (Custom) / Vanilla JS
- **Animazioni**: ScrollReveal.js (caricato via CDN)
- **Font**: Inter (Google Fonts)
- **Compatibilità**: Mobile Responsive, testato per Chrome/Edge/Firefox/Safari.

## 🌍 Gestione Lingue

Al momento il sito punta a `index.html` per l'italiano. Se desideri impostare l'inglese come default, rinomina `index-en.html` in `index.html`.
In alternativa, puoi aggiungere un selettore lingua nel menu (già predisposto strutturalmente).

---
© 2026 GameStringer Team
