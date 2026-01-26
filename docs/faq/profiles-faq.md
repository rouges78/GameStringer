# ❓ FAQ - Sistema Profili GameStringer

## 🔍 Domande Frequenti

### 🚀 Configurazione Iniziale

#### Q: È obbligatorio usare il sistema profili?
**A**: Sì, dalla versione 3.2.2 il sistema profili è obbligatorio per garantire sicurezza e organizzazione dei dati. Tuttavia, se sei un utente singolo, puoi semplicemente creare un profilo e usare sempre quello.

#### Q: Posso migrare i miei dati dalla versione precedente?
**A**: Sì! Al primo avvio, GameStringer rileva automaticamente i dati esistenti e ti guida attraverso un processo di migrazione. I tuoi dati verranno trasferiti in un nuovo profilo.

#### Q: Quanti profili posso creare?
**A**: Non c'è un limite tecnico al numero di profili. Tuttavia, per prestazioni ottimali, si consiglia di non superare i 10-15 profili attivi.

#### Q: Posso cambiare il nome di un profilo dopo averlo creato?
**A**: Attualmente non è possibile modificare il nome di un profilo esistente. Dovrai creare un nuovo profilo ed esportare/importare i dati se necessario.

---

### 🔐 Sicurezza e Password

#### Q: Ho dimenticato la password del mio profilo, come posso recuperarla?
**A**: Le password non possono essere recuperate per motivi di sicurezza. Dovrai:
1. Eliminare il profilo problematico
2. Creare un nuovo profilo con lo stesso nome
3. Importare un backup se disponibile

#### Q: Posso cambiare la password di un profilo?
**A**: Attualmente non è possibile cambiare la password direttamente. Dovrai:
1. Esportare il profilo con la vecchia password
2. Eliminare il profilo originale
3. Importare il profilo e impostare una nuova password

#### Q: Quanto sono sicure le mie credenziali?
**A**: Molto sicure! Utilizziamo:
- **Crittografia AES-256-GCM** per tutti i dati sensibili
- **PBKDF2 con 100.000 iterazioni** per la derivazione delle chiavi
- **Salt unici** per ogni profilo (prevenzione rainbow table)
- **Nonce casuali** per ogni operazione di crittografia
- **Isolamento completo** tra profili (nessuna condivisione dati)
- **Pulizia automatica memoria** al cambio profilo
- **Verifica integrità** con MAC per prevenire manomissioni
- **Timeout sessioni** automatico per sicurezza aggiuntiva

#### Q: Cosa succede se qualcuno accede al mio computer?
**A**: Senza la password del profilo, non può accedere ai tuoi dati. Inoltre:
- Le sessioni scadono automaticamente
- I dati sono crittografati su disco
- È necessaria autenticazione per ogni accesso

---

### 🔄 Gestione Profili

#### Q: Come faccio a sapere quale profilo è attivo?
**A**: Il nome del profilo attivo è sempre visibile nell'header dell'applicazione, in alto a destra.

#### Q: Posso usare lo stesso nome per profili diversi?
**A**: No, ogni profilo deve avere un nome unico per evitare confusione.

#### Q: Cosa succede quando cambio profilo?
**A**: Quando cambi profilo:
1. Tutti i dati del profilo precedente vengono rimossi dalla memoria
2. Le credenziali vengono pulite per sicurezza
3. Vengono caricate le impostazioni del nuovo profilo
4. La sessione del profilo precedente viene terminata

#### Q: Posso essere connesso con più profili contemporaneamente?
**A**: No, per motivi di sicurezza e prestazioni, puoi essere autenticato con un solo profilo alla volta.

---

### 💾 Backup e Ripristino

#### Q: Dove vengono salvati i backup dei profili?
**A**: I backup vengono salvati dove scegli tu durante l'esportazione. Il file ha estensione `.gsp` ed è completamente crittografato.

#### Q: Posso importare un profilo su un altro computer?
**A**: Sì! I file di backup sono portabili. Basta:
1. Copiare il file `.gsp` sull'altro computer
2. Aprire GameStringer
3. Usare la funzione "Importa Profilo"
4. Inserire la password originale

#### Q: Quanto spesso dovrei fare backup?
**A**: Si consiglia di fare backup:
- Prima di aggiornamenti importanti
- Dopo aver configurato nuove credenziali
- Almeno una volta al mese per uso regolare
- Prima di modifiche importanti al sistema

#### Q: Il backup include anche le traduzioni e patch?
**A**: Sì, il backup include **tutti** i dati del profilo:
- **Credenziali store** (Steam, Epic, GOG, etc.) - crittografate
- **Impostazioni personalizzate** (tema, lingua, preferenze)
- **Traduzioni salvate** e cronologia traduzioni
- **Patch applicate** e modifiche giochi
- **Cache metadati** giochi e store
- **Cronologia attività** e log operazioni
- **Configurazioni avanzate** (performance, sicurezza)
- **Avatar personalizzato** e preferenze UI

Il file di backup (.gsp) è completamente **crittografato** e **portabile** tra diversi computer.

---

### ⚙️ Impostazioni e Configurazioni

#### Q: Le impostazioni sono condivise tra profili?
**A**: No, ogni profilo ha le proprie impostazioni completamente separate:
- Tema dell'interfaccia
- Lingua
- Configurazioni notifiche
- Preferenze di visualizzazione

#### Q: Posso copiare le impostazioni da un profilo all'altro?
**A**: Attualmente non c'è una funzione diretta per copiare impostazioni. Dovrai configurare manualmente ogni profilo.

#### Q: Le credenziali Steam sono separate per ogni profilo?
**A**: Sì, ogni profilo può avere le proprie credenziali Steam (API Key e Steam ID). Questo permette di gestire account Steam diversi.

---

### 🎮 Giochi e Traduzioni

#### Q: I giochi sono separati per profilo?
**A**: Sì, ogni profilo mantiene la propria lista di giochi, traduzioni e patch. Questo permette configurazioni personalizzate per ogni utente.

#### Q: Posso condividere traduzioni tra profili?
**A**: Attualmente non c'è una funzione per condividere traduzioni tra profili. Ogni profilo mantiene le proprie traduzioni separate.

#### Q: Cosa succede alle traduzioni quando elimino un profilo?
**A**: Quando elimini un profilo, tutte le traduzioni associate vengono eliminate permanentemente. Assicurati di fare un backup prima!

---

### 🔧 Problemi Tecnici

#### Q: L'app si blocca durante il cambio profilo
**A**: Prova questi passaggi:
1. Riavvia completamente l'applicazione
2. Verifica di avere spazio disco sufficiente
3. Controlla che non ci siano processi GameStringer in background
4. Se persiste, contatta il supporto

#### Q: Il profilo non si carica correttamente
**A**: Possibili soluzioni:
1. Riavvia l'app
2. Verifica l'integrità del file profilo
3. Prova a importare da un backup
4. Come ultima risorsa, ricrea il profilo

#### Q: Le credenziali non vengono salvate
**A**: Controlla che:
1. Sei autenticato con il profilo corretto
2. Le credenziali inserite siano valide
3. L'app abbia permessi di scrittura
4. Ci sia spazio disco sufficiente

#### Q: L'app non ricorda l'ultimo profilo usato
**A**: Questo è normale per sicurezza. Devi sempre selezionare e autenticare il profilo ad ogni avvio.

---

### 🔄 Migrazione e Aggiornamenti

#### Q: Cosa succede ai miei profili quando aggiorno GameStringer?
**A**: I profili vengono mantenuti durante gli aggiornamenti. Tuttavia, si consiglia sempre di fare backup prima di aggiornare.

#### Q: La migrazione automatica non ha funzionato
**A**: Se la migrazione automatica fallisce:
1. Fai backup manuale dei dati esistenti
2. Crea un nuovo profilo
3. Riconfigura manualmente le impostazioni
4. Contatta il supporto se hai problemi

#### Q: Posso tornare alla versione precedente senza profili?
**A**: No, una volta migrato al sistema profili, non è possibile tornare indietro. Il sistema profili è obbligatorio dalle versioni 3.2.2+.

---

### 👥 Uso Familiare

#### Q: Come configuro GameStringer per tutta la famiglia?
**A**: 
1. Crea un profilo per ogni membro della famiglia
2. Ogni persona configura le proprie credenziali
3. Insegna a ogni membro come selezionare il proprio profilo
4. Considera di fare backup regolari di tutti i profili

#### Q: I bambini possono accedere ai profili degli adulti?
**A**: No, se ogni profilo ha una password diversa. Ogni profilo è completamente isolato e protetto da password.

#### Q: Posso creare un profilo "ospite" senza password?
**A**: No, tutti i profili richiedono una password per motivi di sicurezza. Puoi però creare un profilo con una password semplice per ospiti.

---

### 🔧 Aspetti Tecnici

#### Q: Dove vengono salvati fisicamente i profili?
**A**: I profili sono salvati in:
- **Windows**: `%APPDATA%\gamestringer\profiles\`
- **macOS**: `~/Library/Application Support/gamestringer/profiles/`
- **Linux**: `~/.config/gamestringer/profiles/`

Ogni profilo è un file `.json.enc` crittografato con nome univoco.

#### Q: Posso spostare i profili su un altro disco?
**A**: Sì, puoi:
1. Esportare tutti i profili (backup .gsp)
2. Disinstallare e reinstallare GameStringer nella nuova posizione
3. Importare i profili dai backup

Oppure usare la variabile ambiente `GAMESTRINGER_PROFILES_DIR`.

#### Q: Che algoritmi di crittografia usate esattamente?
**A**: Dettagli tecnici della crittografia:
- **Algoritmo simmetrico**: AES-256-GCM
- **Key derivation**: PBKDF2-SHA256 con 100.000 iterazioni
- **Salt**: 32 byte casuali per profilo
- **Nonce**: 12 byte casuali per operazione
- **MAC**: Incluso in GCM per verifica integrità
- **Password hashing**: Argon2id per verifica password

#### Q: I profili sono compatibili tra versioni diverse?
**A**: Compatibilità versioni:
- **Forward**: Profili 3.2.2 funzionano su versioni successive
- **Backward**: Profili nuovi NON funzionano su versioni precedenti
- **Migrazione**: Automatica durante aggiornamenti
- **Formato**: Il formato .gsp è stabile e mantenuto

#### Q: Posso accedere ai dati del profilo programmaticamente?
**A**: Per sviluppatori:
- **API Tauri**: Comandi disponibili per integrazioni
- **File crittografati**: Non accessibili direttamente senza password
- **SDK**: Non disponibile, usa i comandi Tauri esposti
- **Database**: SQLite interno per metadati (non credenziali)

---

### 📊 Performance e Ottimizzazione

#### Q: Il sistema profili rallenta l'app?
**A**: Il sistema profili è ottimizzato per prestazioni minime. Potresti notare:
- Leggero ritardo al primo avvio (caricamento profili)
- Breve pausa durante il cambio profilo (pulizia memoria)
- Questi ritardi sono normali e necessari per sicurezza

#### Q: Posso disabilitare il sistema profili?
**A**: No, il sistema profili non può essere disabilitato. È parte integrante della sicurezza di GameStringer.

#### Q: Troppi profili rallentano l'app?
**A**: Con un numero ragionevole di profili (< 15), non dovrebbero esserci problemi di performance. Se hai molti profili, considera di eliminare quelli non utilizzati.

---

### 🆘 Supporto

#### Q: Dove posso ottenere aiuto aggiuntivo?
**A**: Puoi contattare il supporto tramite:
- Email: support@gamestringer.com
- GitHub Issues: [Link repository]
- Documentazione: `docs/` nella cartella di installazione

#### Q: Cosa devo includere quando contatto il supporto?
**A**: Includi sempre:
- Versione GameStringer
- Sistema operativo
- Descrizione dettagliata del problema
- Passi per riprodurre il problema
- Screenshot se utili
- Log di errore (se disponibili)

#### Q: C'è un modo per segnalare bug o suggerire miglioramenti?
**A**: Sì! Puoi:
- Aprire un issue su GitHub
- Inviare feedback tramite email
- Usare la funzione feedback nell'app (se disponibile)

---

## 🔗 Risorse Utili

- **Guida Utente Completa**: `docs/user-guide/profiles-system.md`
- **Documentazione Tecnica**: `docs/technical/`
- **Video Tutorial**: [Link ai tutorial]
- **Community**: [Link forum]

---

*FAQ aggiornata alla versione 3.2.2 - Sistema Profili*

**Non trovi la risposta alla tua domanda?** Contatta il supporto o consulta la documentazione completa!