# Supporto Autenticazione a Due Fattori (2FA) - GameStringer

## 🔐 Panoramica

GameStringer supporta l'autenticazione a due fattori per i provider che la richiedono, offrendo un'esperienza utente moderna e intuitiva.

## 📅 Cronologia Implementazioni

### 2 Luglio 2025 - GOG 2FA Support
Prima implementazione completa del supporto 2FA nell'applicazione.

## 🎮 Provider con Supporto 2FA

### GOG (Good Old Games)
**Status**: ✅ UI Completa, ⚠️ Backend da completare

#### Caratteristiche Implementate:
1. **Flusso a Due Step**
   - Step 1: Inserimento credenziali (email e password)
   - Step 2: Inserimento codice 2FA (6 cifre)

2. **UI Moderna**
   - Transizione fluida tra i due step
   - Campo codice con formattazione monospace
   - Auto-focus sul campo codice
   - Pulsante che cambia da "Collega Account" a "Verifica Codice"

3. **Feedback Utente**
   - Alert informativo blu che spiega il processo
   - Messaggi di errore specifici per problemi 2FA
   - Indicazioni chiare sul formato del codice (6 cifre)

4. **Integrazione Backend**
   - Le funzioni `handleGenericLogin` e `handleUbisoftLogin` supportano il parametro `twoFactorCode`
   - Il codice viene passato correttamente alle API di autenticazione

#### Limitazioni Attuali:
- GOG non fornisce API pubbliche per l'autenticazione
- L'implementazione backend richiede web scraping o SDK non ufficiali
- Le credenziali vengono salvate per uso futuro quando le API saranno disponibili

## 🔧 Implementazione Tecnica

### Component: GenericCredentialsModal
```tsx
// Supporto per flusso 2FA
const [showTwoFactorField, setShowTwoFactorField] = useState(false);
const [twoFactorCode, setTwoFactorCode] = useState('');

// Gestione submit con 2FA
const handleSubmit = async (e: React.FormEvent) => {
  if (provider === 'gog' && !showTwoFactorField) {
    setShowTwoFactorField(true);
    return;
  }
  
  await onSubmit(email, password, twoFactorCode);
};
```

### Funzioni di Login Aggiornate
```tsx
// Supporto parametro opzionale twoFactorCode
const handleGenericLogin = async (
  email: string, 
  password: string, 
  twoFactorCode?: string
) => {
  // Passa il codice 2FA al provider di autenticazione
  const result = await signIn(backendProviderId, {
    redirect: false,
    email,
    password,
    twoFactorCode,
    userId: session?.user.id,
  });
};
```

## 🚀 Prossimi Passi

### 1. Completamento Backend GOG
- Implementare web scraping per il login GOG
- Gestire il flusso completo di autenticazione 2FA
- Validare e salvare i token di sessione

### 2. Estensione ad Altri Provider
- **Ubisoft Connect**: Già predisposto per 2FA
- **EA App**: Potrebbe richiedere 2FA in futuro
- **Battle.net**: Supporta authenticator app

### 3. Miglioramenti UX
- Supporto per authenticator app (TOTP)
- Opzione "Ricorda questo dispositivo"
- Gestione codici di backup

## 🔒 Sicurezza

- I codici 2FA non vengono mai salvati
- Timeout automatico dopo inserimento codice
- Validazione lato client del formato codice
- Comunicazione sicura con il backend

## 📝 Note per gli Sviluppatori

Per aggiungere supporto 2FA a un nuovo provider:

1. Aggiornare `GenericCredentialsModal` per riconoscere il provider
2. Implementare la logica di gestione 2FA nel backend
3. Aggiornare la documentazione
4. Testare il flusso completo end-to-end

## 🧪 Testing

### Test Manuali Richiesti:
- [ ] Login con credenziali corrette
- [ ] Login con credenziali errate
- [ ] Inserimento codice 2FA corretto
- [ ] Inserimento codice 2FA errato
- [ ] Timeout sessione 2FA
- [ ] Cambio provider durante il flusso

### Test Automatici:
- Unit test per componenti UI
- Integration test per flusso completo
- E2E test con mock del provider
