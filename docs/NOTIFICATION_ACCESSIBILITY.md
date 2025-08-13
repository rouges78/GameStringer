# Sistema Notifiche - Supporto Accessibilità e Screen Reader

## Panoramica

Il sistema di notifiche di GameStringer include un supporto completo per l'accessibilità e gli screen reader, implementando le migliori pratiche WCAG 2.1 AA per garantire un'esperienza inclusiva per tutti gli utenti.

## Funzionalità Implementate

### 1. Annunci Automatici Screen Reader

#### Live Regions
- **Notifiche Toast**: Utilizzano `aria-live="polite"` per notifiche normali e `aria-live="assertive"` per notifiche urgenti
- **Conteggio Notifiche**: Annunci automatici quando arrivano nuove notifiche
- **Operazioni Batch**: Conferme vocali per operazioni multiple (lettura, eliminazione, selezione)

#### Annunci Personalizzati
```typescript
// Esempio di annuncio per nuova notifica
announceToScreenReader(
  "Notifica di sistema: Aggiornamento disponibile. Versione 3.2.2 pronta per l'installazione.",
  'polite'
);
```

### 2. Etichette ARIA e Descrizioni Semantiche

#### NotificationToast
- `role="alert"` per notifiche importanti
- `aria-labelledby` e `aria-describedby` per collegare titolo e messaggio
- `aria-atomic="true"` per lettura completa del contenuto
- Testo di aiuto nascosto con istruzioni per l'uso

#### NotificationCenter
- `role="dialog"` con `aria-modal="true"`
- `aria-labelledby` per il titolo del centro
- `aria-describedby` per descrizione completa delle funzionalità
- Supporto per navigazione con Tab e scorciatoie tastiera

#### NotificationIndicator
- Descrizioni dinamiche basate sul conteggio notifiche
- Annunci automatici per nuove notifiche
- Testo di aiuto per l'utilizzo

### 3. Navigazione Tastiera

#### Scorciatoie Globali
- **Escape**: Chiude centro notifiche o esce dalla modalità selezione
- **Ctrl+A**: Seleziona tutte le notifiche o marca tutte come lette
- **Ctrl+F**: Focus sulla barra di ricerca
- **Delete**: Elimina notifiche selezionate
- **Ctrl+Delete**: Elimina tutte le notifiche

#### Navigazione Elementi
- **Tab/Shift+Tab**: Navigazione tra elementi
- **Enter**: Attiva elemento selezionato
- **Space**: Seleziona/deseleziona in modalità selezione
- **Arrow Keys**: Navigazione tra notifiche (implementazione futura)

### 4. Gestione Focus

#### FocusManager
```typescript
const focusManager = NotificationFocusManager.getInstance();

// Salva focus corrente e sposta al centro notifiche
focusManager.focusNotificationCenter();

// Ripristina focus precedente
focusManager.restoreFocus();

// Focus su prima notifica
focusManager.focusFirstNotification();
```

#### Indicatori Visivi
- Ring di focus visibili su tutti gli elementi interattivi
- Contrasto elevato per modalità high contrast
- Rispetto delle preferenze `prefers-reduced-motion`

## Componenti Accessibili

### NotificationToast

```typescript
<div
  role="alert"
  aria-live={priority === 'urgent' ? 'assertive' : 'polite'}
  aria-atomic="true"
  aria-labelledby={titleId}
  aria-describedby={`${messageId} ${helpId}`}
  tabIndex={0}
  onKeyDown={handleKeyDown}
>
  <div id={helpId} className="sr-only">
    Notifica toast. Premi Escape per chiudere o clicca il pulsante X.
  </div>
  {/* Contenuto notifica */}
</div>
```

### NotificationCenter

```typescript
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="notification-center-title"
  aria-describedby="notification-center-description"
>
  <div id="notification-center-description" className="sr-only">
    Centro notifiche con {count} notifiche. Usa i filtri per cercare.
    Premi Escape per chiudere, Ctrl+A per selezionare tutto.
  </div>
  {/* Contenuto centro */}
</div>
```

### NotificationIndicator

```typescript
<Button
  aria-label={getAriaLabel()}
  aria-describedby="notification-help"
  type="button"
>
  <div id="notification-help" className="sr-only">
    Indicatore notifiche. Clicca per aprire il centro notifiche.
  </div>
  {/* Icona e badge */}
</Button>
```

## Utility di Accessibilità

### Funzioni Helper

```typescript
// Annunci screen reader
announceToScreenReader(message, priority, duration);

// Annunci conteggio notifiche
announceNotificationCount(newCount, previousCount);

// Annunci operazioni batch
announceBatchOperation('read' | 'delete' | 'select', count);

// Testi di aiuto contestuali
createHelpText('toast' | 'center' | 'indicator');

// Descrizioni scorciatoie tastiera
getKeyboardShortcuts();
```

### Rilevamento Preferenze Utente

```typescript
// Controlla se l'utente preferisce animazioni ridotte
const shouldReduceMotion = prefersReducedMotion();

// Rileva uso di screen reader
const usingScreenReader = isUsingScreenReader();
```

## Classi CSS per Accessibilità

### Screen Reader Only

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Focus Visibile

```css
.focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}
```

## Test di Accessibilità

### Pagina di Test
Visita `/test-accessibility` per testare tutte le funzionalità:

- Annunci screen reader con diverse priorità
- Operazioni batch con conferme vocali
- Navigazione tastiera completa
- Componenti con supporto ARIA

### Test con Screen Reader

#### NVDA (Windows)
1. Avvia NVDA
2. Naviga alla pagina di test
3. Usa i pulsanti per testare gli annunci
4. Verifica la navigazione con Tab

#### VoiceOver (macOS)
1. Attiva VoiceOver (Cmd+F5)
2. Usa il rotor per navigare tra elementi
3. Testa le scorciatoie tastiera
4. Verifica gli annunci automatici

#### JAWS (Windows)
1. Avvia JAWS
2. Usa la modalità virtuale per navigazione
3. Testa la modalità applicazione per interazioni
4. Verifica la lettura delle live regions

## Conformità WCAG 2.1

### Livello AA Raggiunto

#### 1.3.1 Info and Relationships
- ✅ Struttura semantica con heading e landmark
- ✅ Relazioni tra elementi tramite ARIA

#### 2.1.1 Keyboard
- ✅ Tutte le funzionalità accessibili da tastiera
- ✅ Nessun trap di tastiera

#### 2.1.2 No Keyboard Trap
- ✅ Focus può sempre essere spostato
- ✅ Escape per uscire da dialoghi

#### 2.4.3 Focus Order
- ✅ Ordine di focus logico e prevedibile
- ✅ Gestione focus per componenti dinamici

#### 2.4.6 Headings and Labels
- ✅ Heading descrittivi e informativi
- ✅ Label chiari per tutti i controlli

#### 2.4.7 Focus Visible
- ✅ Indicatori di focus sempre visibili
- ✅ Contrasto sufficiente per indicatori

#### 3.2.2 On Input
- ✅ Nessun cambio di contesto inaspettato
- ✅ Conferme per azioni distruttive

#### 4.1.2 Name, Role, Value
- ✅ Tutti gli elementi hanno nome accessibile
- ✅ Ruoli ARIA appropriati
- ✅ Stati e proprietà comunicate correttamente

#### 4.1.3 Status Messages
- ✅ Messaggi di stato annunciati automaticamente
- ✅ Live regions appropriate per il contenuto

## Migliori Pratiche Implementate

### 1. Annunci Progressivi
- Evita spam di annunci multipli
- Raggruppa operazioni correlate
- Usa priorità appropriate (polite/assertive)

### 2. Contenuto Descrittivo
- Titoli e messaggi informativi
- Contesto sufficiente per comprensione
- Istruzioni chiare per l'uso

### 3. Feedback Immediato
- Conferme per tutte le azioni
- Stati di caricamento annunciati
- Errori comunicati chiaramente

### 4. Navigazione Efficiente
- Scorciatoie per azioni comuni
- Skip links per contenuto principale
- Landmark per navigazione rapida

## Risoluzione Problemi

### Screen Reader Non Annuncia
1. Verifica che le live regions siano presenti nel DOM
2. Controlla che `aria-live` sia impostato correttamente
3. Assicurati che il contenuto cambi dinamicamente

### Focus Non Visibile
1. Verifica che gli stili di focus siano applicati
2. Controlla il contrasto degli indicatori
3. Testa con diversi browser

### Navigazione Tastiera Problematica
1. Verifica l'ordine di tabulazione
2. Controlla che tutti gli elementi interattivi siano raggiungibili
3. Testa le scorciatoie personalizzate

## Sviluppi Futuri

### Funzionalità Pianificate
- [ ] Navigazione con frecce direzionali
- [ ] Supporto per gesture touch accessibili
- [ ] Personalizzazione verbosità annunci
- [ ] Integrazione con tecnologie assistive avanzate

### Miglioramenti Continui
- Feedback utenti con disabilità
- Test con diverse tecnologie assistive
- Aggiornamenti per nuove specifiche WCAG
- Ottimizzazioni performance per screen reader

## Risorse

### Documentazione
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)

### Strumenti di Test
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Web Accessibility Evaluator](https://wave.webaim.org/)
- [Lighthouse Accessibility Audit](https://developers.google.com/web/tools/lighthouse)