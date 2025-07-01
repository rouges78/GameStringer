# Store Integrations - GameStringer

## Stato Attuale delle Integrazioni

### ✅ Funzionanti
1. **Steam** - Completamente funzionante con autenticazione tramite SteamID
2. **itch.io** - Funzionante con API key

### ⚠️ Implementati ma con Limitazioni
3. **Epic Games** - OAuth implementato, richiede:
   - Registrazione app su Epic Developer Portal
   - Configurazione corretta del redirect URI: `http://localhost:3000/api/auth/callback/epicgames`
   - Le credenziali attuali potrebbero essere di test

4. **Ubisoft Connect** - Credenziali implementate, ma:
   - Usa la libreria `ubisoft-demux` che potrebbe avere problemi con 2FA
   - L'API Ubisoft non è ufficialmente pubblica

### Implementati con Funzionalità Limitata
5. **GOG** - Supporto 2FA implementato (UI completa)
   - **✅ Nuovo**: Supporto completo per autenticazione a due fattori nell'interfaccia
   - Flusso UI moderno a due step: prima email/password, poi codice 2FA
   - Campo dedicato per inserimento codice 2FA a 6 cifre
   - Alert informativi che spiegano i requisiti di autenticazione GOG
   - **Limitazione**: GOG non fornisce API pubbliche, quindi l'autenticazione effettiva richiede integrazione backend
   - Le credenziali e il codice 2FA vengono passati al backend per elaborazione futura

6. **EA App / Origin** - Salvataggio credenziali solo
   - EA non fornisce API pubbliche per l'autenticazione
   - Le credenziali vengono salvate per uso futuro
   - Richiede Origin SDK per funzionalità complete

7. **Battle.net** - Salvataggio credenziali solo
   - Battle.net ha OAuth ma richiede approvazione da Blizzard
   - Le credenziali vengono salvate per uso futuro
   - Per OAuth completo: https://develop.battle.net/

### ❌ Non Implementati
8. **Rockstar** - Non ancora supportato

## Risoluzione Problemi

### Epic Games
Se Epic Games non funziona:
1. Verifica che `EPIC_CLIENT_ID` e `EPIC_CLIENT_SECRET` siano validi
2. Registra la tua app su: https://dev.epicgames.com/
3. Configura il redirect URI correttamente
4. Controlla i log per errori OAuth

### Ubisoft
Se Ubisoft non funziona:
1. Verifica che non sia attivo il 2FA sull'account
2. Controlla che la libreria `ubisoft-demux` sia aggiornata
3. I problemi comuni includono:
   - Rate limiting dell'API
   - Cambiamenti nell'API non documentati
   - Problemi di autenticazione con account regionali

## Implementazione Futura

Per completare le integrazioni mancanti:

### GOG
- Opzione 1: Implementare web scraping per il login
- Opzione 2: Usare GOG Galaxy SDK (richiede approvazione)
- Opzione 3: Parsing dei file locali di GOG Galaxy

### EA App / Origin
- Opzione 1: Reverse engineering del protocollo Origin
- Opzione 2: Parsing dei file di configurazione locali
- Opzione 3: Integrazione con Origin SDK (non pubblico)

### Battle.net
- Richiedere accesso OAuth a Blizzard
- Implementare il flusso OAuth standard una volta approvati
- Alternative: parsing dei file di configurazione locali

### Rockstar
- Analizzare Rockstar Games Launcher
- Implementare autenticazione tramite Social Club API
- Parsing dei file di configurazione locali

## Note di Sicurezza

- Le password non vengono mai salvate in chiaro
- Tutti i token sono criptati nel database
- Le credenziali sono associate all'utente corrente
- Implementare sempre HTTPS in produzione