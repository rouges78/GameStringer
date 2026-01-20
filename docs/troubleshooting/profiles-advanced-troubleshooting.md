# 🔧 Troubleshooting Avanzato - Sistema Profili

## 🚨 Problemi Critici

### Profilo Corrotto - Recupero Dati

#### Sintomi
- Errore "Profilo corrotto" all'accesso
- App si blocca durante caricamento profilo
- Dati profilo parzialmente mancanti

#### Diagnosi
```bash
# Controlla integrità file profilo
ls -la ~/.gamestringer/profiles/
file ~/.gamestringer/profiles/profile_*.json.enc

# Verifica log errori
tail -f ~/.gamestringer/logs/profiles.log
```

#### Soluzioni Progressive

**Livello 1: Riavvio Semplice**
```bash
# Chiudi completamente GameStringer
pkill gamestringer
# Riavvia applicazione
```

**Livello 2: Reset Cache**
```bash
# Elimina cache temporanea
rm -rf ~/.gamestringer/cache/profiles/
rm -rf ~/.gamestringer/temp/
```

**Livello 3: Ripristino da Backup**
1. Importa ultimo backup .gsp disponibile
2. Se non hai backup, prova recupero parziale:
```bash
# Crea backup del profilo corrotto
cp ~/.gamestringer/profiles/profile_*.json.enc ~/backup-corrotto.enc
# Prova importazione forzata (solo per sviluppatori)
```

**Livello 4: Recupero Manuale**
```bash
# Estrai metadati dal file indice
cat ~/.gamestringer/profiles/profiles.index
# Ricrea profilo con stesso nome e importa dati manualmente
```

### Perdita Password Profilo

#### Situazione
- Password dimenticata, nessun backup disponibile
- Profilo contiene dati importanti

#### Opzioni Disponibili

**Opzione 1: Reset Profilo (Perdita Dati)**
```bash
# Elimina profilo specifico
rm ~/.gamestringer/profiles/profile_[ID].json.enc
# Aggiorna indice
# Ricrea profilo con stesso nome
```

**Opzione 2: Recupero Parziale**
- Se hai backup parziali o export precedenti
- Importa quello che è disponibile
- Riconfigura il resto manualmente

**Opzione 3: Supporto Specializzato**
- Contatta supporto con dettagli specifici
- Possibile recupero parziale in casi eccezionali
- Richiede verifica identità

---

## ⚡ Problemi Performance

### Avvio Lento - Ottimizzazione

#### Diagnosi Performance
```bash
# Controlla dimensioni profili
du -sh ~/.gamestringer/profiles/*

# Verifica numero profili
ls ~/.gamestringer/profiles/*.json.enc | wc -l

# Controlla spazio disco
df -h ~/.gamestringer/
```

#### Ottimizzazioni

**Cache Profili**
```bash
# Pulisci cache obsoleta
find ~/.gamestringer/cache/ -type f -mtime +30 -delete

# Ricostruisci indice profili
rm ~/.gamestringer/profiles/profiles.index
# Riavvia app per ricostruzione automatica
```

**Compressione Dati**
- Esporta e reimporta profili per compressione
- Elimina profili non utilizzati
- Pulisci cronologia traduzioni vecchie

**Configurazione Sistema**
```bash
# Aumenta limite file aperti (Linux/macOS)
ulimit -n 4096

# Ottimizza I/O disco
# Sposta profili su SSD se possibile
```

### Memoria Elevata - Debug

#### Monitoraggio Memoria
```bash
# Monitor uso memoria GameStringer
ps aux | grep gamestringer
top -p $(pgrep gamestringer)

# Analisi dettagliata (Linux)
pmap $(pgrep gamestringer)
```

#### Cause Comuni
1. **Troppi profili caricati**: Limite a 10-15 profili attivi
2. **Cache non pulita**: Pulizia automatica non funzionante
3. **Memory leak**: Bug specifico da segnalare
4. **Dati profilo troppo grandi**: Profili > 100MB

#### Soluzioni
```bash
# Forza pulizia memoria
kill -USR1 $(pgrep gamestringer)  # Se supportato

# Riavvio pulito
pkill gamestringer
sleep 2
gamestringer --clean-start
```

---

## 🔐 Problemi Sicurezza

### Crittografia Fallita

#### Sintomi
- Errore "Decryption failed"
- "Invalid password" con password corretta
- File profilo non leggibile

#### Diagnosi Crittografia
```bash
# Verifica integrità file
hexdump -C ~/.gamestringer/profiles/profile_*.json.enc | head

# Controlla dimensioni file
stat ~/.gamestringer/profiles/profile_*.json.enc

# Verifica permessi
ls -la ~/.gamestringer/profiles/
```

#### Possibili Cause
1. **Corruzione file**: Disco danneggiato, interruzione scrittura
2. **Cambio password**: Password modificata esternamente
3. **Versione incompatibile**: Formato crittografia cambiato
4. **Attacco**: Tentativo di manomissione file

#### Soluzioni
```bash
# Backup immediato file corrotto
cp ~/.gamestringer/profiles/profile_*.json.enc ~/emergency-backup.enc

# Prova recupero con backup precedente
# Se disponibile, importa ultimo backup .gsp valido

# Verifica integrità sistema
fsck /dev/[disco]  # Linux
diskutil verifyVolume /  # macOS
```

### Isolamento Profili Compromesso

#### Sintomi
- Credenziali di un profilo appaiono in altro profilo
- Impostazioni condivise tra profili
- Dati "mescolati" tra profili

#### Verifica Isolamento
```bash
# Controlla file profili separati
ls -la ~/.gamestringer/profiles/
# Ogni profilo deve avere file .json.enc separato

# Verifica log accessi
grep "profile_switch" ~/.gamestringer/logs/*.log
grep "credential_load" ~/.gamestringer/logs/*.log
```

#### Azioni Immediate
1. **Logout immediato** da tutti i profili
2. **Backup separato** di ogni profilo
3. **Verifica credenziali** in ogni profilo
4. **Segnala bug** se confermato

---

## 🔄 Problemi Migrazione

### Migrazione Incompleta

#### Sintomi
- Alcuni dati non migrati
- Credenziali parzialmente trasferite
- Impostazioni mancanti

#### Diagnosi Migrazione
```bash
# Controlla log migrazione
grep "migration" ~/.gamestringer/logs/*.log

# Verifica dati originali ancora presenti
ls -la ~/.gamestringer-backup/
ls -la ~/.gamestringer/legacy/
```

#### Recupero Post-Migrazione
```bash
# Backup stato attuale
cp -r ~/.gamestringer ~/.gamestringer-post-migration

# Ripristina dati originali
cp -r ~/.gamestringer-backup/* ~/.gamestringer/legacy/

# Riavvia migrazione
gamestringer --force-migration
```

### Conflitti Versione

#### Problema
- Profili creati con versione più recente
- Incompatibilità formato dati
- Errori di deserializzazione

#### Soluzioni
```bash
# Verifica versione profili
grep "version" ~/.gamestringer/profiles/profiles.index

# Downgrade controllato (sconsigliato)
# Meglio aggiornare GameStringer all'ultima versione

# Conversione formato (se disponibile)
gamestringer --convert-profiles --from-version=3.2.3 --to-version=3.2.2
```

---

## 🛠️ Strumenti Debug

### Modalità Debug

#### Attivazione Debug
```bash
# Variabili ambiente debug
export GAMESTRINGER_DEBUG=1
export GAMESTRINGER_DEBUG_PROFILES=1
export GAMESTRINGER_LOG_LEVEL=debug

# Avvio con debug
gamestringer --debug --verbose
```

#### Log Dettagliati
```bash
# Posizione log
tail -f ~/.gamestringer/logs/debug.log
tail -f ~/.gamestringer/logs/profiles.log
tail -f ~/.gamestringer/logs/encryption.log

# Filtri utili
grep "ERROR" ~/.gamestringer/logs/*.log
grep "profile_" ~/.gamestringer/logs/*.log
grep "encrypt\|decrypt" ~/.gamestringer/logs/*.log
```

### Comandi Diagnostici

#### Verifica Stato Sistema
```bash
# Comando diagnostico integrato
gamestringer --diagnose-profiles

# Output esempio:
# ✅ Profiles directory exists
# ✅ Profiles index valid
# ✅ 3 profiles found
# ❌ Profile 'abc123' corrupted
# ✅ Encryption working
# ✅ Permissions correct
```

#### Test Crittografia
```bash
# Test crittografia isolato
gamestringer --test-encryption

# Test specifico profilo
gamestringer --test-profile-encryption --profile-id=abc123
```

#### Validazione Profili
```bash
# Valida tutti i profili
gamestringer --validate-all-profiles

# Valida profilo specifico
gamestringer --validate-profile --id=abc123 --password="test"
```

---

## 📞 Supporto Avanzato

### Informazioni per Supporto Tecnico

#### Dati da Raccogliere
```bash
# Informazioni sistema
uname -a
gamestringer --version

# Stato profili
ls -la ~/.gamestringer/profiles/
cat ~/.gamestringer/profiles/profiles.index

# Log errori recenti
tail -100 ~/.gamestringer/logs/error.log

# Diagnostica automatica
gamestringer --generate-support-bundle
```

#### Pacchetto Supporto
Il comando `--generate-support-bundle` crea un file zip con:
- Log anonimizzati (senza credenziali)
- Informazioni sistema
- Stato profili (metadati only)
- Configurazione app
- Diagnostica automatica

### Contatti Supporto Specializzato

#### Livelli Supporto
1. **Community**: Discord, Forum, GitHub Issues
2. **Standard**: Email support con risposta 24-48h
3. **Priority**: Supporto tecnico avanzato per problemi critici
4. **Enterprise**: Supporto dedicato per installazioni aziendali

#### Escalation Critica
Per problemi che causano:
- Perdita dati profili
- Impossibilità accesso applicazione
- Sospetti problemi sicurezza
- Corruzione dati estesa

**Contatto immediato**: critical-support@gamestringer.com

---

## 🔬 Sviluppatori e Integrazioni

### API Debug

#### Comandi Tauri Debug
```javascript
// Test connessione profili
await invoke('debug_profiles_status');

// Verifica crittografia
await invoke('debug_test_encryption', { data: 'test' });

// Diagnostica profilo
await invoke('debug_profile_info', { profileId: 'abc123' });
```

#### Hook Sviluppo
```javascript
// Listener eventi profili
window.__GAMESTRINGER_DEBUG__ = {
  onProfileSwitch: (oldId, newId) => console.log('Profile switch:', oldId, '->', newId),
  onEncryptionError: (error) => console.error('Encryption error:', error),
  onProfileCorruption: (profileId) => console.error('Profile corrupted:', profileId)
};
```

### Estensioni e Plugin

#### Interfacce Sviluppatori
- **Profile Events**: Hook per eventi profili
- **Encryption API**: Accesso controllato crittografia
- **Storage API**: Interfaccia storage personalizzato
- **Migration API**: Hook per migrazioni personalizzate

#### Limitazioni Sicurezza
- Nessun accesso diretto a password
- Crittografia non bypassabile
- Isolamento profili mantenuto
- Audit log obbligatorio

---

*Troubleshooting avanzato aggiornato alla versione 3.2.2+ - Sistema Profili*

**Problema non risolto?** Contatta il supporto tecnico con i dati diagnostici raccolti.