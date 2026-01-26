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
   ```
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
   ```
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
   ```
   🌐 Vai su: https://steamcommunity.com/dev/apikey
   🔑 Inserisci Domain Name: localhost
   📋 Copia la API Key generata
   ```

2. **Trova il tuo Steam ID**
   ```
   🌐 Vai su: https://steamid.io/
   📝 Inserisci il tuo username Steam
   📋 Copia il "steamID64" (numero lungo)
   ```

3. **Configura in GameStringer**
   ```
   📍 Store Manager → Sezione Steam
   🔑 Steam API Key: [Incolla la tua API Key]
   🆔 Steam ID: [Incolla il tuo steamID64]
   💾 Clicca "Salva Credenziali"
   ✅ Vedrai "Connessione Steam: Attiva"
   ```

### Passo 2.3: Configurare Epic Games Store

1. **Ottieni Credenziali Epic**
   ```
   🌐 Vai su: https://dev.epicgames.com/portal/
   📝 Crea account sviluppatore (gratuito)
   🔑 Crea una nuova "Application"
   📋 Copia Client ID e Client Secret
   ```

2. **Configura in GameStringer**
   ```
   📍 Store Manager → Sezione Epic Games
   🔑 Client ID: [Incolla Client ID]
   🔐 Client Secret: [Incolla Client Secret]
   💾 Clicca "Salva Credenziali"
   ```

### Passo 2.4: Configurare Altri Store (Opzionale)

**Per ogni store che usi:**

#### GOG
```
🌐 Account GOG esistente
📝 Username e Password del tuo account
⚠️ Nota: GOG ha API limitate
```

#### Ubisoft Connect
```
🌐 Account Ubisoft esistente
📝 Email e Password del tuo account
🎮 Assicurati di avere Ubisoft Connect installato
```

#### Origin/EA
```
🌐 Account EA/Origin esistente
📝 Email e Password del tuo account
🎮 Assicurati di avere EA App installato
```

#### Itch.io
```
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
   ```
   🔄 Clicca "Aggiorna Libreria Giochi"
   ⏳ Attendi il caricamento (può richiedere 1-2 minuti)
   📊 Vedrai il progresso per ogni store configurato
   ```

3. **Verifica Risultati**
   ```
   ✅ Steam: X giochi trovati
   ✅ Epic: Y giochi trovati
   ✅ Altri store: Z giochi trovati
   📊 Totale: XXX giochi nella tua libreria
   ```

### Passo 3.2: Risoluzione Problemi Comuni

**Se non vedi giochi:**

#### Steam Non Funziona
```
❌ Problema: "0 giochi Steam trovati"
🔧 Soluzione:
   1. Verifica API Key corretta
   2. Controlla che il profilo Steam sia pubblico
   3. Vai su Steam → Profilo → Modifica Profilo → Privacy
   4. Imposta "Dettagli Gioco" su "Pubblico"
```

#### Epic Games Non Funziona
```
❌ Problema: "Errore connessione Epic"
🔧 Soluzione:
   1. Verifica Client ID e Secret corretti
   2. Epic ha limitazioni API - normale avere meno giochi
   3. Riprova dopo qualche minuto
```

#### Altri Store
```
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
   ```
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
   ```
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
   ```
   🌍 Lingua Origine: English (di solito auto-rilevata)
   🇮🇹 Lingua Destinazione: Italiano
   🤖 Motore AI: GPT-4 (consigliato) / Claude / Gemini
   📝 Stile Traduzione: Naturale / Letterale / Gaming
   ```

2. **Opzioni Avanzate**
   ```
   🎮 Mantieni Termini Gaming: ✅ (mantiene "boss", "quest", etc.)
   🔤 Mantieni Nomi Propri: ✅ (mantiene nomi personaggi)
   💬 Traduci Dialoghi: ✅
   📋 Traduci Menu: ✅
   🏷️ Traduci Tooltip: ✅
   ```

### Passo 4.4: Processo di Traduzione Automatica

1. **Avvia Scansione File**
   ```
   🔍 GameStringer scansiona i file del gioco
   📁 Trova file di testo/localizzazione
   📊 Mostra progresso: "Trovati X file, Y stringhe"
   ```

2. **Traduzione AI**
   ```
   🤖 L'AI inizia a tradurre le stringhe
   📊 Progresso in tempo reale: "Tradotte X/Y stringhe"
   ⏱️ Tempo stimato: dipende dal numero di stringhe
   ```

3. **Revisione e Correzioni**
   ```
   📝 Vedrai lista stringhe tradotte
   ✏️ Clicca su una stringa per modificarla
   🔍 Cerca stringhe specifiche
   📂 Filtra per categoria (menu, dialoghi, etc.)
   ```

### Passo 4.5: Applicazione Traduzione

1. **Anteprima Modifiche**
   ```
   👁️ Clicca "Anteprima" per vedere le modifiche
   📊 Statistiche: X stringhe tradotte, Y modificate
   ⚠️ Backup automatico dei file originali
   ```

2. **Applica Traduzione**
   ```
   ✅ Clicca "Applica Traduzione"
   💾 GameStringer modifica i file del gioco
   🔄 Crea backup dei file originali
   ✅ Conferma: "Traduzione applicata con successo!"
   ```

3. **Test del Gioco**
   ```
   🎮 Avvia il gioco per testare la traduzione
   👀 Controlla menu, dialoghi, interfaccia
   📝 Annota eventuali problemi o errori
   ```

---

## 🔧 FASE 5: GESTIONE E OTTIMIZZAZIONE

### Passo 5.1: Gestione Traduzioni

1. **Cronologia Traduzioni**
   ```
   📚 Menu → "Le Mie Traduzioni"
   📊 Vedi tutte le traduzioni fatte
   📅 Data, gioco, stato, qualità
   ```

2. **Backup e Ripristino**
   ```
   💾 Backup automatici creati sempre
   🔄 Ripristina versione originale se necessario
   📤 Esporta traduzioni per condividerle
   📥 Importa traduzioni da altri utenti
   ```

### Passo 5.2: Miglioramento Traduzioni

1. **Revisione Post-Gioco**
   ```
   🎮 Dopo aver giocato, torna su GameStringer
   📝 Menu → "Migliora Traduzione"
   ✏️ Correggi errori trovati durante il gioco
   💾 Salva miglioramenti
   ```

2. **Condivisione Community**
   ```
   🌍 Condividi traduzioni di qualità
   ⭐ Vota traduzioni di altri utenti
   💬 Commenta e suggerisci miglioramenti
   🏆 Guadagna reputazione nella community
   ```

---

## 🚨 RISOLUZIONE PROBLEMI COMUNI

### Problema: "Gioco Non Trovato"

```
❌ Sintomo: GameStringer non trova il gioco installato
🔧 Soluzioni:
   1. Verifica che il gioco sia installato
   2. Controlla che Steam/Epic sia aperto
   3. Aggiorna la libreria giochi
   4. Riavvia GameStringer
   5. Controlla che il gioco sia nel percorso standard
```

### Problema: "Traduzione Non Applicata"

```
❌ Sintomo: Il gioco è ancora in inglese dopo la traduzione
🔧 Soluzioni:
   1. Riavvia il gioco completamente
   2. Verifica che i file non siano protetti da scrittura
   3. Esegui GameStringer come amministratore
   4. Controlla che l'antivirus non blocchi le modifiche
   5. Verifica che il gioco non abbia verificazione integrità attiva
```

### Problema: "AI Non Risponde"

```
❌ Sintomo: La traduzione automatica non funziona
🔧 Soluzioni:
   1. Verifica connessione internet
   2. Controlla crediti API (se applicabile)
   3. Prova un motore AI diverso
   4. Riduci il numero di stringhe per batch
   5. Riprova più tardi (limiti rate API)
```

### Problema: "Gioco Crashato"

```
❌ Sintomo: Il gioco si blocca dopo la traduzione
🔧 Soluzioni:
   1. Ripristina backup originale
   2. Verifica integrità file del gioco
   3. Riapplica traduzione con impostazioni conservative
   4. Escludi file problematici dalla traduzione
   5. Contatta supporto con dettagli specifici
```

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

```
1. 🎮 Scegli gioco → 2. 🤖 Traduzione automatica → 3. ✏️ Revisione manuale → 
4. 💾 Applica → 5. 🎯 Testa → 6. 🔄 Migliora → 7. 🌍 Condividi
```

---

## 📞 Supporto e Risorse

### 🆘 Se Hai Problemi
- **Documentazione**: Leggi le guide dettagliate in `docs/`
- **FAQ**: Controlla `docs/faq/profiles-faq.md`
- **Community**: Forum, Reddit
- **Supporto**: support@gamestringer.com

### 📚 Risorse Utili
- **Video Tutorial**: [Link ai tutorial]
- **Esempi Traduzioni**: [Link esempi]
- **Best Practices**: [Link guide avanzate]
- **API Documentation**: Per sviluppatori

---

**🎉 Congratulazioni! Ora sai come usare GameStringer dall'inizio alla fine!**

*Buona traduzione e buon gaming! 🎮🌍*