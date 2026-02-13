# 🎮 GameStringer - Guida Completa Passo-Passo

## 🎯 Obiettivo: Dal Login alla Traduzione Giochi

Questa guida ti accompagna dall'inizio alla fine per utilizzare GameStringer al massimo delle sue potenzialità.

---

## 📋 FASE 1: SETUP INIZIALE E ACCESSO

### Passo 1.1: Primo Avvio e Creazione Profilo

1. **Avvia GameStringer**
   - Doppio click sull'icona dell'applicazione
   - Se è la prima volta, vedrai la schermata di creazione profilo

2. **Crea il Tuo Profilo**

   ```text
   📝 Nome Profilo: [Il tuo nome] (es. "Mario Gaming")
   🎨 Avatar: Scegli un colore/gradiente che ti piace
   🔒 Password: Imposta una password sicura (minimo 4 caratteri)
   ```

3. **Conferma Creazione**
   - Clicca **"Crea Profilo"**
   - Verrai automaticamente autenticato
   - Vedrai la dashboard principale

> 💡 **Suggerimento**: Annota la password in un posto sicuro!

### Passo 1.2: Familiarizzare con l'Interfaccia

**Elementi Principali:**

- **Header**: Nome profilo (in alto a destra)
- **Menu Laterale**: Navigazione principale
- **Dashboard**: Panoramica giochi e attività
- **Store Manager**: Gestione credenziali store

---

## 🔗 FASE 2: COLLEGAMENTO STORE E CREDENZIALI

### Passo 2.1: Accedere al Store Manager

1. **Naviga al Store Manager**
   - Menu laterale → **"Store Manager"**
   - Oppure: Dashboard → **"Gestisci Store"**

2. **Panoramica Store Disponibili**

   ```text
   🎮 Steam - Il più importante per PC gaming
   🏪 Epic Games Store - Giochi gratuiti settimanali
   🎯 GOG - Giochi DRM-free
   🎮 Ubisoft Connect - Giochi Ubisoft
   🎮 Origin/EA - Giochi Electronic Arts
   ⚔️ Battle.net - Giochi Blizzard
   🎨 Itch.io - Giochi indie
   🎮 Rockstar Games - GTA, Red Dead, etc.
   ```

### Passo 2.2: Configurare Steam (PRIORITÀ ALTA)

**Steam è il più importante - inizia da qui!**

1. **Ottieni Steam API Key**

   ```text
   🌐 Vai su: https://steamcommunity.com/dev/apikey
   🔑 Inserisci Domain Name: localhost
   📋 Copia la API Key generata
   ```

2. **Trova il tuo Steam ID**

   ```text
   🌐 Vai su: https://steamid.io/
   📝 Inserisci il tuo username Steam
   📋 Copia il "steamID64" (numero lungo)
   ```

3. **Configura in GameStringer**

   ```text
   📍 Store Manager → Sezione Steam
   🔑 Steam API Key: [Incolla la tua API Key]
   🆔 Steam ID: [Incolla il tuo steamID64]
   💾 Clicca "Salva Credenziali"
   ✅ Vedrai "Connessione Steam: Attiva"
   ```

### Passo 2.3: Configurare Epic Games Store

1. **Ottieni Credenziali Epic**

   ```text
   🌐 Vai su: https://dev.epicgames.com/portal/
   📝 Crea account sviluppatore (gratuito)
   🔑 Crea una nuova "Application"
   📋 Copia Client ID e Client Secret
   ```

2. **Configura in GameStringer**

   ```text
   📍 Store Manager → Sezione Epic Games
   🔑 Client ID: [Incolla Client ID]
   🔐 Client Secret: [Incolla Client Secret]
   💾 Clicca "Salva Credenziali"
   ```

### Passo 2.4: Configurare Altri Store (Opzionale)

**Per ogni store che usi:**

#### GOG

```text
🌐 Account GOG esistente
📝 Username e Password del tuo account
⚠️ Nota: GOG ha API limitate
```

#### Ubisoft Connect

```text
🌐 Account Ubisoft esistente
📝 Email e Password del tuo account
🎮 Assicurati di avere Ubisoft Connect installato
```

#### Origin/EA

```text
🌐 Account EA/Origin esistente
📝 Email e Password del tuo account
🎮 Assicurati di avere EA App installato
```

#### Itch.io

```text
🌐 Vai su: https://itch.io/user/settings/api-keys
🔑 Genera una nuova API Key
📋 Copia la API Key
```

---

## 🎮 FASE 3: GENERAZIONE LISTA GIOCHI

### Passo 3.1: Sincronizzazione Automatica

1. **Torna alla Dashboard**
   - Menu laterale → **"Dashboard"**
   - Vedrai la sezione "I Tuoi Giochi"

2. **Avvia Sincronizzazione**

   ```text
   🔄 Clicca "Aggiorna Libreria Giochi"
   ⏳ Attendi il caricamento (può richiedere 1-2 minuti)
   📊 Vedrai il progresso per ogni store configurato
   ```

3. **Verifica Risultati**

   ```text
   ✅ Steam: X giochi trovati
   ✅ Epic: Y giochi trovati
   ✅ Altri store: Z giochi trovati
   📊 Totale: XXX giochi nella tua libreria
   ```

### Passo 3.2: Risoluzione Problemi Comuni

**Se non vedi giochi:**

#### Steam Non Funziona

```text
❌ Problema: "0 giochi Steam trovati"
🔧 Soluzione:
   1. Verifica API Key corretta
   2. Controlla che il profilo Steam sia pubblico
   3. Vai su Steam → Profilo → Modifica Profilo → Privacy
   4. Imposta "Dettagli Gioco" su "Pubblico"
```

#### Epic Games Non Funziona

```text
❌ Problema: "Errore connessione Epic"
🔧 Soluzione:
   1. Verifica Client ID e Secret corretti
   2. Epic ha limitazioni API - normale avere meno giochi
   3. Riprova dopo qualche minuto
```

#### Altri Store

```text
❌ Problema: Store non risponde
🔧 Soluzione:
   1. Verifica credenziali corrette
   2. Assicurati che il client del store sia installato
   3. Controlla connessione internet
   4. Riprova più tardi
```

---

## 🌍 FASE 4: TRADUZIONE GIOCHI (LA PARTE PIÙ IMPORTANTE!)

### Passo 4.1: Selezionare un Gioco da Tradurre

1. **Naviga alla Lista Giochi**
   - Dashboard → **"Visualizza Tutti i Giochi"**
   - Oppure: Menu laterale → **"I Miei Giochi"**

2. **Scegli un Gioco**

   ```text
   🎯 Criteri di Scelta:
   ✅ Gioco che conosci bene
   ✅ Gioco con testo in inglese
   ✅ Gioco che giochi spesso
   ❌ Evita giochi online competitivi (potrebbero avere anti-cheat)
   ```

3. **Clicca sul Gioco**
   - Vedrai la pagina dettagli del gioco
   - Informazioni: Store, data installazione, dimensione, etc.

### Passo 4.2: Avviare il Processo di Traduzione

1. **Clicca "Traduci Gioco"**
   - Pulsante grande nella pagina del gioco
   - Si aprirà il **Translation Manager**

2. **Scegli Modalità Traduzione**

   ```text
   🤖 Traduzione Automatica (Consigliata per iniziare)
   ├── Usa AI per tradurre automaticamente
   ├── Più veloce ma meno precisa
   └── Buona per avere una base di partenza
   
   ✋ Traduzione Manuale (Per esperti)
   ├── Traduci ogni stringa manualmente
   ├── Più lenta ma più precisa
   └── Controllo completo sul risultato
   
   🔄 Traduzione Ibrida (Migliore opzione)
   ├── AI traduce automaticamente
   ├── Tu rivedi e correggi
   └── Bilanciamento perfetto velocità/qualità
   ```

### Passo 4.3: Configurazione Traduzione

1. **Impostazioni Traduzione**

   ```text
   🌍 Lingua Origine: English (di solito auto-rilevata)
   🇮🇹 Lingua Destinazione: Italiano
   🤖 Motore AI: GPT-4 (consigliato) / Claude / Gemini
   📝 Stile Traduzione: Naturale / Letterale / Gaming
   ```

2. **Opzioni Avanzate**

   ```text
   🎮 Mantieni Termini Gaming: ✅ (mantiene "boss", "quest", etc.)
   🔤 Mantieni Nomi Propri: ✅ (mantiene nomi personaggi)
   💬 Traduci Dialoghi: ✅
   📋 Traduci Menu: ✅
   🏷️ Traduci Tooltip: ✅
   ```

### Passo 4.4: Processo di Traduzione Automatica

1. **Avvia Scansione File**

   ```text
   🔍 GameStringer scansiona i file del gioco
   📁 Trova file di testo/localizzazione
   📊 Mostra progresso: "Trovati X file, Y stringhe"
   ```

2. **Traduzione AI**

   ```text
   🤖 L'AI inizia a tradurre le stringhe
   📊 Progresso in tempo reale: "Tradotte X/Y stringhe"
   ⏱️ Tempo stimato: dipende dal numero di stringhe
   ```

3. **Revisione e Correzioni**

   ```text
   📝 Vedrai lista stringhe tradotte
   ✏️ Clicca su una stringa per modificarla
   🔍 Cerca stringhe specifiche
   📂 Filtra per categoria (menu, dialoghi, etc.)
   ```

### Passo 4.5: Applicazione Traduzione

1. **Anteprima Modifiche**

   ```text
   👁️ Clicca "Anteprima" per vedere le modifiche
   📊 Statistiche: X stringhe tradotte, Y modificate
   ⚠️ Backup automatico dei file originali
   ```

2. **Applica Traduzione**

   ```text
   ✅ Clicca "Applica Traduzione"
   💾 GameStringer modifica i file del gioco
   🔄 Crea backup dei file originali
   ✅ Conferma: "Traduzione applicata con successo!"
   ```

3. **Test del Gioco**

   ```text
   🎮 Avvia il gioco per testare la traduzione
   👀 Controlla menu, dialoghi, interfaccia
   📝 Annota eventuali problemi o errori
   ```

---

## 🔧 FASE 5: GESTIONE E OTTIMIZZAZIONE

### Passo 5.1: Gestione Traduzioni

1. **Cronologia Traduzioni**

   ```text
   📚 Menu → "Le Mie Traduzioni"
   📊 Vedi tutte le traduzioni fatte
   📅 Data, gioco, stato, qualità
   ```

2. **Backup e Ripristino**

   ```text
   💾 Backup automatici creati sempre
   🔄 Ripristina versione originale se necessario
   📤 Esporta traduzioni per condividerle
   📥 Importa traduzioni da altri utenti
   ```

### Passo 5.2: Miglioramento Traduzioni

1. **Revisione Post-Gioco**

   ```text
   🎮 Dopo aver giocato, torna su GameStringer
   📝 Menu → "Migliora Traduzione"
   ✏️ Correggi errori trovati durante il gioco
   💾 Salva miglioramenti
   ```

2. **Condivisione Community**

   ```text
   🌍 Condividi traduzioni di qualità
   ⭐ Vota traduzioni di altri utenti
   💬 Commenta e suggerisci miglioramenti
   🏆 Guadagna reputazione nella community
   ```

---

## 🎮 FASE 6: DANGANRONPA — TRADUZIONE COMPLETA

### Passo 6.1: Apertura Danganronpa Patcher

1. **Naviga al Patcher**
   - Menu laterale → **"Patcher"** → **"Danganronpa Patcher"**
   - Oppure: Dashboard → Strumenti → Danganronpa

2. **Selezione Gioco Steam**
   - Nel tab **"Applica Patch"**, seleziona il gioco dalla lista Steam rilevati
   - Vedrai i file WAD del gioco con stato (Patchato/Non patchato)

### Passo 6.2: Estrazione e Traduzione Testi

1. **Tab WAD Extractor**
   - Clicca sul tab **"WAD Extractor"**
   - Carica il JSON delle stringhe estratte (35.865 stringhe disponibili)
   - Cerca, filtra e modifica le stringhe

2. **Traduzione Batch AI**
   - Seleziona le stringhe da tradurre
   - Clicca "Traduci con AI"
   - Progresso in tempo reale
   - Esporta traduzioni in JSON

### Passo 6.3: Applicazione Patch WAD

1. **Applica Patch**
   - Tab **"Applica Patch"** → seleziona file WAD patchato
   - Backup automatico del file originale
   - Conferma applicazione

2. **Attivazione In-Gioco**
   - Avvia Danganronpa
   - Impostazioni → Control Hints → "Keyboard and Mouse"
   - Il testo sarà in italiano!

### Passo 6.4: Esportare Patch Distribuibile

1. **Export .zip**
   - Tab **"Applica Patch"** → sezione **"Esporta Patch Distribuibile"**
   - Clicca **"Esporta .zip"**
   - Scegli dove salvare il file (~630 MB)

2. **Contenuto ZIP**
   - `dr1_data_keyboard_us.wad` — WAD patchato italiano
   - `install.bat` — Installer automatico Steam
   - `LEGGIMI.txt` — Istruzioni installazione
   - `translations.json` — Traduzioni sorgente

3. **Distribuzione**
   - Condividi lo .zip con altri giocatori
   - L'installer automatico gestisce backup e installazione

---

## 🧠 FASE 7: TRANSLATION MEMORY E STATISTICHE

### Passo 7.1: Translation Memory

1. **Cos'è la TM**
   - Memoria di traduzione che salva ogni coppia originale/traduzione
   - Riutilizza traduzioni precedenti per velocizzare il lavoro
   - Backend Rust per performance ottimali

2. **Uso Automatico**
   - Dashboard → "Entry TM" mostra il totale delle entry
   - Le traduzioni vengono automaticamente salvate nella TM
   - Stringhe già tradotte vengono suggerite automaticamente

### Passo 7.2: Dashboard Statistiche Reali

La dashboard mostra dati reali dal backend:

- **Traduzioni Totali**: conteggio da activity history
- **Giochi Patchati**: patch applicate registrate
- **Tempo Risparmiato**: calcolato da TM entries + traduzioni
- **Entry TM**: conteggio reale unità nelle Translation Memory

---

## 🔐 FASE 8: SICUREZZA — RECOVERY KEY

### Passo 8.1: Recovery Key alla Creazione Profilo

1. **Generazione Automatica**
   - Alla creazione del profilo, viene generata una Recovery Key
   - 12 parole mnemoniche (es. "albero corvo stella...")

2. **Salva la Recovery Key**
   - Copia negli appunti o scarica come file .txt
   - **IMPORTANTE**: Salva in un posto sicuro!

### Passo 8.2: Recupero Password

1. **Se Dimentichi la Password**
   - Schermata login → **"Password dimenticata?"**
   - Inserisci le 12 parole della Recovery Key
   - Imposta una nuova password

---

## 🚨 RISOLUZIONE PROBLEMI COMUNI

### Problema: "Gioco Non Trovato"

- Verifica che il gioco sia installato
- Controlla che Steam/Epic sia aperto
- Aggiorna la libreria giochi
- Riavvia GameStringer

### Problema: "Traduzione Non Applicata"

- Riavvia il gioco completamente
- Verifica che i file non siano protetti da scrittura
- Esegui GameStringer come amministratore
- Controlla che l'antivirus non blocchi le modifiche

### Problema: "AI Non Risponde"

- Verifica connessione internet
- Controlla crediti API (se applicabile)
- Prova un motore AI diverso
- Riprova più tardi (limiti rate API)

### Problema: "Gioco Crashato"

- Ripristina backup originale
- Verifica integrità file del gioco su Steam
- Riapplica traduzione con impostazioni conservative
- Contatta supporto con dettagli specifici

---

## 📋 CHECKLIST COMPLETAMENTO

### ✅ Setup Iniziale

- [ ] Profilo GameStringer creato
- [ ] Password profilo annotata in sicurezza
- [ ] Interfaccia esplorata e compresa

### ✅ Configurazione Store

- [ ] Steam API Key configurata
- [ ] Steam ID configurato
- [ ] Connessione Steam testata e funzionante
- [ ] Epic Games configurato (se usato)
- [ ] Altri store configurati (se usati)

### ✅ Libreria Giochi

- [ ] Sincronizzazione giochi completata
- [ ] Lista giochi visibile e corretta
- [ ] Giochi da tradurre identificati
- [ ] Problemi di sincronizzazione risolti

### ✅ Prima Traduzione

- [ ] Gioco di test selezionato
- [ ] Modalità traduzione scelta
- [ ] Impostazioni traduzione configurate
- [ ] Traduzione applicata con successo
- [ ] Gioco testato e funzionante

### ✅ Gestione Avanzata

- [ ] Backup verificati e funzionanti
- [ ] Sistema revisione compreso
- [ ] Condivisione community esplorata
- [ ] Problemi comuni risolti

---

## 🎯 CONSIGLI PRO

### 🏆 Per Ottenere i Migliori Risultati

1. **Inizia Piccolo**
   - Prova prima con giochi indie semplici
   - Evita RPG enormi per la prima traduzione
   - Fai esperienza con giochi che conosci

2. **Qualità vs Velocità**
   - Usa traduzione ibrida per bilanciare
   - Rivedi sempre le traduzioni automatiche
   - Non aver fretta: qualità è meglio di velocità

3. **Backup Sempre**
   - Verifica sempre che i backup siano creati
   - Testa le traduzioni prima di giocare seriamente
   - Tieni copie dei file originali

4. **Community**
   - Condividi traduzioni di qualità
   - Usa traduzioni della community per giochi popolari
   - Contribuisci con feedback e miglioramenti

### 🚀 Workflow Ottimale

```text
1. 🎮 Scegli gioco → 2. 🤖 Traduzione automatica → 3. ✏️ Revisione manuale → 
4. 💾 Applica → 5. 🎯 Testa → 6. 🔄 Migliora → 7. 🌍 Condividi
```

---

## 📞 Supporto e Risorse

### 🆘 Se Hai Problemi

- **Documentazione**: Leggi le guide dettagliate in `docs/`
- **FAQ**: Controlla `docs/faq/profiles-faq.md`
- **Community**: Forum, Reddit
- **Supporto**: <support@gamestringer.com>

### 📚 Risorse Utili

- **Video Tutorial**: [Link ai tutorial]
- **Esempi Traduzioni**: [Link esempi]
- **Best Practices**: [Link guide avanzate]
- **API Documentation**: Per sviluppatori

---

**Congratulazioni! Ora sai come usare GameStringer dall'inizio alla fine!**
