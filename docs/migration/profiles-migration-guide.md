# 🔄 Guida Migrazione - Sistema Profili GameStringer

## 📋 Panoramica Migrazione

Questa guida ti aiuta a migrare da una versione precedente di GameStringer (senza sistema profili) alla nuova versione 3.2.2+ con sistema profili integrato.

---

## ⚠️ Importante - Prima di Iniziare

### Backup Obbligatorio
Prima di procedere con la migrazione, **fai sempre un backup completo**:

```bash
# Copia l'intera cartella di configurazione
cp -r ~/.gamestringer ~/.gamestringer-backup-$(date +%Y%m%d)
```

### Versioni Supportate
- **Da**: GameStringer 3.0.x - 3.2.1
- **A**: GameStringer 3.2.2+
- **Tipo**: Migrazione obbligatoria (sistema profili richiesto)

---

## 🔍 Processo di Migrazione

### Scenario 1: Migrazione Automatica (Consigliata)

#### Passo 1: Aggiornamento
1. **Chiudi** completamente GameStringer
2. **Aggiorna** alla versione 3.2.2+
3. **Avvia** l'applicazione

#### Passo 2: Wizard di Migrazione
Al primo avvio, vedrai il **Wizard di Migrazione**:

1. **Rilevamento Dati Esistenti**
   ```
   ✅ Credenziali Steam trovate
   ✅ Impostazioni utente trovate  
   ✅ Traduzioni salvate trovate
   ✅ Cache giochi trovata
   ```

2. **Creazione Profilo Principale**
   - Inserisci un nome per il profilo (es. "Principale", "Il mio profilo")
   - Imposta una password sicura
   - Seleziona un avatar/colore

3. **Migrazione Automatica**
   ```
   🔄 Migrazione credenziali Steam...
   🔄 Migrazione impostazioni utente...
   🔄 Migrazione traduzioni...
   🔄 Migrazione cache giochi...
   ✅ Migrazione completata!
   ```

4. **Verifica Migrazione**
   - Controlla che le credenziali Steam siano presenti
   - Verifica che le impostazioni siano corrette
   - Testa che le traduzioni siano disponibili

#### Passo 3: Primo Accesso
- Verrai automaticamente autenticato con il nuovo profilo
- Controlla che tutto funzioni correttamente
- Fai un backup del nuovo profilo

### Scenario 2: Migrazione Manuale

Se la migrazione automatica non funziona o preferisci il controllo manuale:

#### Passo 1: Preparazione
1. **Backup Dati Esistenti**
   ```bash
   # Salva configurazioni importanti
   cp ~/.gamestringer/config.json ~/backup-config.json
   cp ~/.gamestringer/credentials.json ~/backup-credentials.json
   cp -r ~/.gamestringer/translations ~/backup-translations/
   ```

2. **Installazione Pulita**
   - Disinstalla la versione precedente
   - Elimina `~/.gamestringer/` (dopo aver fatto backup!)
   - Installa GameStringer 3.2.2+

#### Passo 2: Configurazione Manuale
1. **Avvia GameStringer**
   - Crea il primo profilo normalmente

2. **Ripristino Credenziali**
   - Vai in **Impostazioni → Steam API**
   - Reinserisci manualmente API Key e Steam ID
   - Configura altre credenziali store

3. **Ripristino Impostazioni**
   - Riconfigura tema, lingua, notifiche
   - Imposta preferenze personalizzate

4. **Ripristino Traduzioni**
   - Le traduzioni dovranno essere rifatte
   - Oppure importa manualmente i file di backup

---

## 📊 Mappatura Dati

### Cosa Viene Migrato Automaticamente

| Dati Precedenti | Nuovo Profilo | Note |
|----------------|---------------|------|
| `config.json` → | Impostazioni Profilo | Tema, lingua, preferenze |
| `credentials.json` → | Credenziali Profilo | Steam, Epic, GOG, etc. |
| `translations/` → | Traduzioni Profilo | Tutte le traduzioni salvate |
| `cache/` → | Cache Profilo | Cache giochi e metadati |
| `logs/` → | Log Profilo | Cronologia attività |

### Struttura File Prima/Dopo

#### Prima (Versione 3.2.1)
```
~/.gamestringer/
├── config.json
├── credentials.json
├── translations/
├── cache/
└── logs/
```

#### Dopo (Versione 3.2.2+)
```
~/.gamestringer/
├── profiles/
│   ├── profile_abc123.json.enc
│   └── profiles.index
├── avatars/
└── backups/
```

---

## 🔧 Risoluzione Problemi Migrazione

### Problema: "Dati Esistenti Non Trovati"

**Causa**: I file di configurazione precedenti non sono nella posizione attesa.

**Soluzioni**:
1. **Verifica Posizione File**
   ```bash
   # Controlla se i file esistono
   ls -la ~/.gamestringer/
   ```

2. **Migrazione Manuale**
   - Se i file sono in una posizione diversa, copiali in `~/.gamestringer/`
   - Riavvia GameStringer per riattivare la migrazione automatica

3. **Configurazione da Zero**
   - Se i file sono persi, procedi con configurazione manuale

### Problema: "Migrazione Fallita"

**Causa**: Errore durante il processo di migrazione automatica.

**Soluzioni**:
1. **Riprova Migrazione**
   ```bash
   # Elimina profili parziali
   rm -rf ~/.gamestringer/profiles/
   # Riavvia GameStringer
   ```

2. **Controlla Log Errori**
   - Cerca file di log in `~/.gamestringer/logs/`
   - Invia log al supporto se necessario

3. **Migrazione Manuale**
   - Procedi con il Scenario 2 (migrazione manuale)

### Problema: "Credenziali Non Migrate"

**Causa**: File credenziali corrotto o formato non riconosciuto.

**Soluzioni**:
1. **Verifica File Credenziali**
   ```bash
   # Controlla contenuto file
   cat ~/.gamestringer/credentials.json
   ```

2. **Ripristino Manuale**
   - Apri il file di backup delle credenziali
   - Reinserisci manualmente in GameStringer

3. **Riconfigurazione**
   - Riconfigura tutte le credenziali da zero
   - Testa ogni connessione store

### Problema: "Traduzioni Perse"

**Causa**: Cartella traduzioni non trovata o corrotta.

**Soluzioni**:
1. **Verifica Backup**
   ```bash
   # Controlla backup traduzioni
   ls -la ~/backup-translations/
   ```

2. **Ripristino Manuale**
   - Copia i file di traduzione nel nuovo profilo
   - Riavvia GameStringer

3. **Ricostruzione**
   - Se le traduzioni sono perse, dovrai rifarle
   - Usa la cronologia se disponibile

---

## ✅ Checklist Post-Migrazione

### Verifica Immediata
- [ ] **Profilo Creato**: Il profilo principale è stato creato correttamente
- [ ] **Autenticazione**: Riesci ad accedere con la password impostata
- [ ] **Credenziali Steam**: API Key e Steam ID sono presenti e funzionanti
- [ ] **Altre Credenziali**: Epic, GOG, etc. sono migrate correttamente
- [ ] **Impostazioni**: Tema, lingua e preferenze sono corrette
- [ ] **Traduzioni**: Le traduzioni precedenti sono disponibili

### Test Funzionalità
- [ ] **Connessione Steam**: Testa la connessione alle API Steam
- [ ] **Caricamento Giochi**: Verifica che la libreria giochi si carichi
- [ ] **Traduzioni**: Testa che le traduzioni funzionino
- [ ] **Salvataggio**: Verifica che le modifiche vengano salvate
- [ ] **Riavvio**: Testa che tutto persista dopo riavvio

### Backup Post-Migrazione
- [ ] **Esporta Profilo**: Crea un backup del nuovo profilo
- [ ] **Salva Backup**: Conserva il backup in luogo sicuro
- [ ] **Testa Ripristino**: Verifica che il backup funzioni

---

## 🔄 Rollback (Solo Emergenza)

> ⚠️ **Attenzione**: Il rollback dovrebbe essere usato solo in caso di problemi gravi!

### Procedura Rollback
1. **Disinstalla Versione 3.2.2+**
2. **Ripristina Backup**
   ```bash
   rm -rf ~/.gamestringer/
   cp -r ~/.gamestringer-backup-YYYYMMDD ~/.gamestringer/
   ```
3. **Reinstalla Versione Precedente**
4. **Verifica Funzionamento**

### Limitazioni Rollback
- Perderai tutte le modifiche fatte dopo la migrazione
- Dovrai rifare la migrazione in futuro
- Alcune funzionalità potrebbero non essere disponibili

---

## 📞 Supporto Migrazione

### Prima di Contattare il Supporto

1. **Raccogli Informazioni**
   - Versione precedente di GameStringer
   - Versione corrente
   - Sistema operativo
   - Messaggio di errore esatto

2. **Prepara File**
   - Log di errore (se disponibili)
   - Screenshot del problema
   - Lista di cosa non funziona

### Contatti Supporto
- **Email**: migration-support@gamestringer.com
- **Discord**: [Link server Discord] - canale #migration-help
- **GitHub**: [Link repository] - apri un issue con tag "migration"

### Informazioni da Includere
```
Versione Precedente: 3.2.1
Versione Corrente: 3.2.2
Sistema Operativo: Windows 11 / macOS 13 / Ubuntu 22.04
Tipo Migrazione: Automatica / Manuale
Errore: [Descrizione dettagliata]
Passi Riproduzione: [Lista passi]
```

---

## 📚 Risorse Aggiuntive

- **Guida Utente Sistema Profili**: `docs/user-guide/profiles-system.md`
- **FAQ Sistema Profili**: `docs/faq/profiles-faq.md`
- **Documentazione Tecnica**: `docs/technical/profiles-architecture.md`
- **Video Tutorial Migrazione**: [Link tutorial]

---

*Guida migrazione aggiornata per GameStringer 3.2.2+ - Sistema Profili*

**Hai problemi con la migrazione?** Non esitare a contattare il supporto!