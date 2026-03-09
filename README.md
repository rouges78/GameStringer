# GameStringer Landing Page

Questa cartella contiene tutti i file necessari per la landing page del sito web GameStringer.

## 🌐 Supporto Multilingua

Il sito supporta **9 lingue** con cambio dinamico senza reload:

| Codice | Lingua | Bandiera |
|--------|--------|----------|
| `en` | English | 🇬🇧 |
| `it` | Italiano | 🇮🇹 |
| `es` | Español | 🇪🇸 |
| `de` | Deutsch | 🇩🇪 |
| `fr` | Français | 🇫🇷 |
| `ja` | 日本語 | 🇯🇵 |
| `zh` | 中文 | 🇨🇳 |
| `ko` | 한국어 | 🇰🇷 |
| `pt` | Português | 🇧🇷 |

### Come funziona

- **Selettore lingua** nel nav (dropdown con bandiere)
- **Auto-detect** lingua del browser
- **Persistenza** in localStorage
- **URL params**: `?lang=en`, `?lang=ja`, etc.

### File i18n

- `site-i18n.js` - Contiene tutte le traduzioni e la logica di switching

## Struttura File

```text
sito/
├── index.html          # Pagina principale con i18n
├── index-en.html       # Redirect a index.html?lang=en
├── index-external.html # Versione senza i18n
├── site-i18n.js        # Sistema traduzioni (9 lingue)
├── styles-v2.css       # Stili v2 (dark theme)
├── styles.css          # Stili legacy
├── favicon.svg         # Icona del sito (SVG)
├── logo.png            # Logo GameStringer
├── logo.svg            # Logo (SVG)
├── images/
│   ├── screenshot-*.png    # Screenshot app
│   └── og-image.svg        # Immagine per social media
└── README.md           # Questo file
```text

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
```text

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
