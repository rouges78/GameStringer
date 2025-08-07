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
   - Clicca su **"Crea Nuovo Profilo"**

2. **Compilazione Dati**
   - **Nome Profilo**: Scegli un nome identificativo (es. "Mario", "Famiglia", "Gaming")
   - **Avatar**: Seleziona un colore/gradiente per il tuo profilo
   - **Password**: Imposta una password sicura (minimo 4 caratteri)

3. **Conferma Creazione**
   - Clicca **"Crea Profilo"**
   - Verrai automaticamente autenticato e portato alla dashboard

> 💡 **Suggerimento**: Scegli una password che ricorderai facilmente ma che sia sicura!

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
- **Steam API Key e Steam ID**
- **Epic Games credenziali**
- **GOG, Origin, Ubisoft** credenziali
- **Itch.io** credenziali

#### 🎮 Libreria Giochi
- Lista giochi personalizzata
- Traduzioni salvate
- Patch applicate
- Preferenze giochi

#### 🎨 Impostazioni Interfaccia
- **Tema**: Scuro, Chiaro, Automatico
- **Lingua**: Italiano, Inglese, etc.
- **Notifiche**: Configurazioni personalizzate
- **Layout**: Preferenze visualizzazione

#### 📊 Dati Applicazione
- Cache traduzioni
- Cronologia attività
- Backup automatici
- Log personalizzati

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

*Questa guida è aggiornata alla versione 3.2.2 di GameStringer con sistema profili.*