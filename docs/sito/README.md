# GameStringer Landing Page

Questa cartella contiene tutti i file necessari per la landing page del sito web GameStringer.

## Struttura File

```text
website/
├── index.html          # Versione con CSS inline (singolo file)
├── index-external.html # Versione con CSS esterno
├── styles.css          # Foglio di stile separato
├── favicon.svg         # Icona del sito (SVG)
├── logo.svg            # Logo GameStringer (SVG)
├── images/
│   ├── screenshot-placeholder.svg  # Screenshot libreria
│   ├── hero-screenshot.svg         # Screenshot hero section
│   └── og-image.svg                # Immagine per social media
└── README.md           # Questo file
```

## Utilizzo

### Opzione 1: File Singolo (Consigliato per iniziare)

Usa `index.html` - contiene tutto il CSS inline, basta copiarlo e funziona.

### Opzione 2: File Separati

Usa `index-external.html` + `styles.css` per una gestione più pulita.

## Deploy

### GitHub Pages

1. Copia i file nella root del repo o in `/docs`
2. Abilita GitHub Pages nelle impostazioni del repo
3. Seleziona la branch e cartella

### Netlify / Vercel

1. Carica la cartella `website/`
2. Deploy automatico

### Hosting tradizionale

1. Carica tutti i file via FTP
2. Assicurati che `index.html` sia nella root

## Personalizzazione

### Cambiare i colori

Modifica le variabili CSS in `:root`:

```css
:root {
  --primary-500: #0ea5e9;  /* Colore principale (Blu) */
  --teal-500: #14b8a6;     /* Colore secondario (Verde/Teal) */
  /* ... */
}
```

### Aggiungere screenshot reali

Sostituisci i file SVG in `images/` con screenshot PNG/JPG reali.

### Modificare i link

Cerca e sostituisci:

- `https://github.com/rouges78/GameStringer` → tuo repo
- `https://ko-fi.com/gamestringer` → tuo Ko-fi

## SEO

I meta tag sono già configurati in `<head>`:
- `title` e `description`
- Open Graph per Facebook/LinkedIn
- Keywords per motori di ricerca

Per l'immagine OG, converti `og-image.svg` in PNG 1200x630px.

## Note

- Font: Inter (Google Fonts)
- Icone: Emoji Unicode (nessuna dipendenza esterna)
- Responsive: Mobile, Tablet, Desktop
- Dark theme con gradient blu/verde
