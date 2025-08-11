# 👤 Guida Sistema Profili - GameStringer

## 🎯 Panoramica

Il sistema profili di GameStringer ti permette di gestire multiple configurazioni utente, ognuna con le proprie credenziali, librerie di giochi e preferenze. Questo è particolarmente utile per:

- **Famiglie**: Ogni membro può avere il proprio profilo separato
- **Utenti multipli**: Gestire account diversi per diversi scopi
- **Sicurezza**: Mantenere credenziali e dati separati e protetti
- **Organizzazione**: Configurazioni personalizzate per ogni utente

---

## 🚀 Primo Avvio

### Creazione del Primo Profilo

Quando avvii GameStringer per la prima volta con il sistema profili:

1. **Schermata di Benvenuto**
   - Vedrai una schermata che ti invita a creare il tuo primo profilo
   - Se hai dati da una versione precedente, vedrai il **Wizard di Migrazione**
   - Clicca su **"Crea Nuovo Profilo"**

2. **Compilazione Dati**
   - **Nome Profilo**: Scegli un nome identificativo (es. "Mario", "Famiglia", "Gaming")
     - Deve essere unico (non può esistere un altro profilo con lo stesso nome)
     - Lunghezza: 3-50 caratteri
     - Caratteri consentiti: lettere, numeri, spazi, trattini
   - **Avatar**: Seleziona un colore/gradiente per il tuo profilo
   - **Password**: Imposta una password sicura
     - Minimo 4 caratteri (consigliati 8+)
     - Può contenere lettere, numeri e simboli
     - Verrà crittografata e non può essere recuperata

3. **Conferma Creazione**
   - Clicca **"Crea Profilo"**
   - Il sistema creerà e crittograferà il profilo
   - Verrai automaticamente autenticato e portato alla dashboard

> 💡 **Suggerimenti**:
> - Scegli una password che ricorderai facilmente ma che sia sicura
> - Annota la password in un luogo sicuro se necessario
> - Fai subito un backup del profilo dopo la creazione

---

## 🔐 Gestione Profili

### Accesso ai Profili

#### Selezione Profilo all'Avvio
- All'avvio dell'app, vedrai la **schermata di selezione profili**
- Clicca sul profilo desiderato
- Inserisci la password quando richiesta
- Clicca **"Accedi"**

#### Menu Profilo (Durante l'Uso)
- Nell'header dell'app, clicca sul **nome del profilo attivo**
- Si aprirà un menu con le opzioni:
  - **Cambia Profilo**: Torna alla selezione profili
  - **Gestisci Profili**: Apre il pannello di gestione
  - **Logout**: Disconnette il profilo corrente

### Creazione Profili Aggiuntivi

1. **Dal Menu Profilo**
   - Clicca sul nome profilo → **"Gestisci Profili"**
   - Clicca **"Aggiungi Nuovo Profilo"**

2. **Dalla Schermata Selezione**
   - Fai logout o cambia profilo
   - Nella schermata selezione, clicca **"Crea Nuovo Profilo"**

3. **Compila i Dati**
   - Segui la stessa procedura del primo profilo
   - Ogni profilo deve avere un nome unico

### Cambio Profilo

1. **Durante l'Uso dell'App**
   - Clicca sul nome profilo nell'header
   - Seleziona **"Cambia Profilo"**

2. **Selezione Nuovo Profilo**
   - Scegli il profilo desiderato dalla lista
   - Inserisci la password
   - Clicca **"Accedi"**

> ⚠️ **Importante**: Cambiando profilo, tutti i dati del profilo precedente vengono puliti dalla memoria per sicurezza.

---

## ⚙️ Configurazioni per Profilo

### Cosa è Separato per Profilo

Ogni profilo mantiene separatamente:

#### 🔑 Credenziali Store
- **Steam**: API Key, Steam ID, credenziali login
- **Epic Games**: Client ID, Client Secret, token di accesso
- **GOG**: Credenziali account (se configurate)
- **Origin/EA**: Credenziali account
- **Ubisoft Connect**: Credenziali account
- **Battle.net**: Credenziali account
- **Itch.io**: API Key e credenziali
- **Rockstar Games**: Credenziali account

#### 🎮 Libreria Giochi
- Lista giochi personalizzata per ogni store
- Traduzioni salvate e applicate
- Patch e modifiche applicate
- Preferenze specifiche per gioco
- Cache metadati giochi
- Cronologia traduzioni

#### 🎨 Impostazioni Interfaccia
- **Tema**: Scuro, Chiaro, Automatico
- **Lingua**: Italiano, Inglese, Francese, Tedesco, Spagnolo
- **Notifiche**: Configurazioni personalizzate per tipo
- **Layout**: Preferenze visualizzazione dashboard
- **Accessibilità**: Impostazioni per screen reader e navigazione

#### 📊 Dati Applicazione
- Cache traduzioni e metadati
- Cronologia attività e operazioni
- Backup automatici personalizzati
- Log e diagnostica personalizzati
- Impostazioni di performance
- Preferenze di sincronizzazione

#### 🔐 Sicurezza
- Sessioni di autenticazione separate
- Timeout personalizzati
- Impostazioni di sicurezza avanzate
- Audit log delle operazioni

### Configurazione Impostazioni

1. **Accedi alle Impostazioni**
   - Menu laterale → **"Impostazioni"**
   - Oppure: Menu profilo → **"Impostazioni"**

2. **Modifica Configurazioni**
   - Tutte le modifiche vengono salvate automaticamente per il profilo attivo
   - Le impostazioni non influenzano altri profili

3. **Salvataggio Automatico**
   - Non è necessario salvare manualmente
   - Le modifiche sono immediate e persistenti

---

## ⚡ Limiti e Considerazioni

### Limiti Tecnici

#### Numero Profili
- **Massimo consigliato**: 15 profili attivi
- **Limite tecnico**: Nessun limite rigido
- **Performance**: Più profili = caricamento iniziale più lento

#### Dimensioni Dati
- **Profilo singolo**: ~10-50 MB (dipende da traduzioni e cache)
- **Backup profilo**: File .gsp di dimensioni variabili
- **Spazio totale**: Calcola ~100 MB per profilo attivo

#### Compatibilità
- **Versioni**: Sistema profili disponibile dalla 3.2.2+
- **Migrazione**: Automatica da versioni 3.0.x - 3.2.1
- **Rollback**: Non possibile tornare a versioni senza profili

### Best Practices

#### Organizzazione Profili
- **Nomi Descrittivi**: Usa nomi chiari ("Mario Gaming", "Famiglia", "Lavoro")
- **Profili Specifici**: Crea profili per scopi diversi invece di uno generico
- **Pulizia Regolare**: Elimina profili non utilizzati

#### Gestione Password
- **Password Uniche**: Usa password diverse per ogni profilo
- **Sicurezza**: Bilancia sicurezza e facilità di ricordo
- **Backup**: Annota le password in un gestore password sicuro

#### Manutenzione
- **Backup Regolari**: Esporta profili almeno una volta al mese
- **Pulizia Cache**: Periodicamente pulisci cache e dati temporanei
- **Aggiornamenti**: Mantieni GameStringer sempre aggiornato

---

## 🔒 Sicurezza e Privacy

### Protezione Password

- **Crittografia**: Tutte le password sono crittografate con AES-256
- **Nessun Recupero**: Le password non possono essere recuperate, solo reimpostate
- **Timeout Sessione**: Le sessioni scadono automaticamente per sicurezza

### Isolamento Dati

- **Separazione Completa**: Ogni profilo ha accesso solo ai propri dati
- **Nessuna Condivisione**: Credenziali e impostazioni non sono condivise
- **Pulizia Memoria**: Al cambio profilo, la memoria viene pulita

### Best Practices Sicurezza

1. **Password Sicure**
   - Usa password diverse per ogni profilo
   - Evita password troppo semplici
   - Non condividere le password

2. **Logout Regolare**
   - Fai logout quando non usi l'app
   - Specialmente su computer condivisi

3. **Backup Profili**
   - Esporta regolarmente i tuoi profili
   - Conserva i backup in luogo sicuro

---

## 💾 Backup e Ripristino

### Esportazione Profili

1. **Accesso Gestione Profili**
   - Menu profilo → **"Gestisci Profili"**

2. **Esporta Profilo**
   - Seleziona il profilo da esportare
   - Clicca **"Esporta Profilo"**
   - Inserisci la password del profilo
   - Scegli dove salvare il file

3. **File di Backup**
   - Il file è crittografato e sicuro
   - Estensione: `.gsp` (GameStringer Profile)
   - Contiene tutti i dati del profilo

### Importazione Profili

1. **Dalla Schermata Selezione**
   - Clicca **"Importa Profilo"**
   - Oppure: Menu profilo → **"Gestisci Profili"** → **"Importa"**

2. **Selezione File**
   - Scegli il file `.gsp` da importare
   - Inserisci la password del profilo originale

3. **Conferma Importazione**
   - Verifica i dati del profilo
   - Clicca **"Importa"**
   - Il profilo sarà disponibile nella lista

> 💡 **Suggerimento**: Esporta i profili prima di aggiornamenti importanti!

---

## 🔧 Risoluzione Problemi

### Problemi Comuni

#### ❌ "Password Errata"
**Problema**: Non riesco ad accedere al mio profilo
**Soluzioni**:
- Verifica di aver digitato la password correttamente
- Controlla che Caps Lock non sia attivo
- Se hai dimenticato la password, dovrai reimpostare il profilo

#### ❌ "Profilo Corrotto"
**Problema**: Il profilo non si carica correttamente
**Soluzioni**:
- Riavvia l'applicazione
- Se hai un backup, importa il profilo
- Contatta il supporto per assistenza

#### ❌ "Credenziali Non Salvate"
**Problema**: Le credenziali Steam/Epic non vengono salvate
**Soluzioni**:
- Verifica di essere autenticato con il profilo corretto
- Controlla che le credenziali siano valide
- Riprova il salvataggio dopo aver fatto logout/login

#### ❌ "Impostazioni Non Persistenti"
**Problema**: Le impostazioni si resettano al riavvio
**Soluzioni**:
- Verifica che l'app abbia permessi di scrittura
- Controlla lo spazio disco disponibile
- Riavvia l'app e riprova

### Ripristino Sistema

#### Reset Profilo Singolo
1. Menu profilo → **"Gestisci Profili"**
2. Seleziona il profilo problematico
3. Clicca **"Reset Profilo"**
4. Conferma l'operazione

#### Reset Completo Sistema
1. Chiudi completamente GameStringer
2. Elimina la cartella `~/.gamestringer/profiles/`
3. Riavvia l'app
4. Ricrea i profili da zero

> ⚠️ **Attenzione**: Il reset completo elimina tutti i profili e dati!

---

## 🔧 Funzionalità Avanzate

### Comandi Rapidi

#### Scorciatoie Tastiera
- **Ctrl+Shift+P**: Apri menu profilo
- **Ctrl+Shift+L**: Logout rapido
- **Ctrl+Shift+S**: Cambia profilo
- **F12**: Apri pannello debug (solo sviluppo)

#### Operazioni Batch
- **Export Multipli**: Esporta più profili contemporaneamente
- **Pulizia Cache**: Pulisci cache di tutti i profili
- **Backup Automatico**: Configura backup automatici programmati

### Integrazione Sistema

#### File di Configurazione
```
~/.gamestringer/
├── profiles/
│   ├── profile_[id].json.enc    # Profili crittografati
│   └── profiles.index           # Indice profili
├── avatars/                     # Avatar personalizzati
├── backups/                     # Backup automatici
└── logs/                        # Log per profilo
```

#### Variabili Ambiente
- `GAMESTRINGER_PROFILES_DIR`: Directory personalizzata profili
- `GAMESTRINGER_SKIP_AUTH`: Salta autenticazione (solo sviluppo)
- `GAMESTRINGER_DEBUG_PROFILES`: Debug sistema profili

### API e Comandi Tauri

Il sistema profili espone questi comandi per l'interfaccia:

#### Gestione Profili
- `list_profiles()`: Lista tutti i profili disponibili
- `create_profile(data)`: Crea nuovo profilo
- `authenticate_profile(id, password)`: Autentica profilo
- `switch_profile(id, password)`: Cambia profilo attivo
- `delete_profile(id, password)`: Elimina profilo

#### Import/Export
- `export_profile(id, password)`: Esporta profilo
- `import_profile(data, password)`: Importa profilo
- `validate_profile_backup(data)`: Valida backup profilo

#### Impostazioni
- `get_current_profile()`: Ottieni profilo attivo
- `get_profile_settings(id)`: Ottieni impostazioni profilo
- `update_profile_settings(id, settings)`: Aggiorna impostazioni
- `load_global_settings()`: Carica impostazioni globali

---

## 📱 Migrazione da Versione Precedente

### Processo Automatico

Se stai aggiornando da una versione precedente di GameStringer:

1. **Rilevamento Automatico**
   - Al primo avvio, l'app rileva i dati esistenti
   - Viene mostrato un wizard di migrazione

2. **Creazione Profilo Principale**
   - Crea un profilo "Principale" o con il nome che preferisci
   - Imposta una password per il profilo

3. **Migrazione Dati**
   - Credenziali esistenti vengono migrate al nuovo profilo
   - Impostazioni vengono trasferite
   - Traduzioni e patch vengono mantenute

4. **Verifica Migrazione**
   - Controlla che tutti i dati siano stati migrati correttamente
   - Testa le funzionalità principali

### Migrazione Manuale

Se la migrazione automatica non funziona:

1. **Backup Dati Esistenti**
   - Copia la cartella `~/.gamestringer/` in un luogo sicuro

2. **Installazione Pulita**
   - Disinstalla la versione precedente
   - Installa la nuova versione con sistema profili

3. **Ricreazione Configurazione**
   - Crea un nuovo profilo
   - Reinserisci manualmente le credenziali
   - Riconfigura le impostazioni

---

## 🆘 Supporto e Assistenza

### Risorse Utili

- **Documentazione Tecnica**: `docs/technical/`
- **FAQ Estese**: `docs/faq/profiles-faq.md`
- **Video Tutorial**: [Link ai tutorial]
- **Community Forum**: [Link al forum]

### Contatti Supporto

- **Email**: support@gamestringer.com
- **Discord**: [Link server Discord]
- **GitHub Issues**: [Link repository]

### Informazioni per il Supporto

Quando contatti il supporto, includi:
- Versione GameStringer
- Sistema operativo
- Descrizione dettagliata del problema
- Log di errore (se disponibili)
- Passi per riprodurre il problema

---

## 📋 Checklist Utilizzo

### ✅ Setup Iniziale
- [ ] Primo profilo creato
- [ ] Password sicura impostata
- [ ] Credenziali store configurate
- [ ] Impostazioni personalizzate
- [ ] Backup profilo esportato

### ✅ Uso Quotidiano
- [ ] Login con profilo corretto
- [ ] Verifica credenziali attive
- [ ] Controllo impostazioni
- [ ] Logout al termine sessione

### ✅ Manutenzione
- [ ] Backup profili regolari
- [ ] Aggiornamento credenziali
- [ ] Pulizia dati obsoleti
- [ ] Verifica sicurezza

---

---

## 🔄 Aggiornamenti Recenti

### Versione 3.2.2+ - Novità Sistema Profili
- ✅ **Sistema profili completamente implementato** e testato
- ✅ **Migrazione automatica** da versioni precedenti
- ✅ **Crittografia AES-256** per massima sicurezza
- ✅ **Isolamento completo** tra profili
- ✅ **Backup/ripristino** profili con export/import
- ✅ **Integrazione completa** con tutti i sistemi esistenti

### Compatibilità
- **Versione minima**: 3.2.2
- **Sistemi supportati**: Windows, macOS, Linux
- **Migrazione**: Automatica da versioni 3.0.x - 3.2.1
- **Backup**: Compatibile con versioni future

---

*Questa guida è aggiornata alla versione 3.2.2+ di GameStringer con sistema profili completo.*