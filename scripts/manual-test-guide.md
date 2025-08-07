# 🧪 Guida Test Manuali - Sistema Profili End-to-End

## Panoramica
Questa guida ti accompagna attraverso i test manuali per verificare che il sistema profili funzioni correttamente end-to-end.

## Pre-requisiti
- [ ] Applicazione compilata e funzionante
- [ ] Database/storage pulito per test freschi
- [ ] Browser/app in modalità sviluppo

---

## 🚀 Test 1: Flusso Startup → Selezione Profilo → Uso App

### Obiettivo
Verificare il flusso completo dall'avvio dell'app all'utilizzo normale.

### Passi da seguire:

#### 1.1 Avvio Applicazione (Prima volta)
- [ ] **Azione**: Avvia l'applicazione
- [ ] **Risultato atteso**: Mostra schermata di creazione primo profilo
- [ ] **Verifica**: Non dovrebbe mostrare lista profili vuota
- [ ] **Note**: _______________

#### 1.2 Creazione Primo Profilo
- [ ] **Azione**: Clicca "Crea Nuovo Profilo"
- [ ] **Risultato atteso**: Apre dialog di creazione profilo
- [ ] **Verifica**: Form con campi nome, avatar, password
- [ ] **Note**: _______________

#### 1.3 Compilazione Form Profilo
- [ ] **Azione**: Inserisci dati profilo (es. "TestUser1", password "test123")
- [ ] **Risultato atteso**: Validazione in tempo reale
- [ ] **Verifica**: Password minimo 4 caratteri, nome non vuoto
- [ ] **Note**: _______________

#### 1.4 Salvataggio Profilo
- [ ] **Azione**: Clicca "Crea Profilo"
- [ ] **Risultato atteso**: Profilo creato e autenticazione automatica
- [ ] **Verifica**: Reindirizzamento alla dashboard principale
- [ ] **Note**: _______________

#### 1.5 Verifica Dashboard
- [ ] **Azione**: Osserva interfaccia principale
- [ ] **Risultato atteso**: Header mostra nome profilo attivo
- [ ] **Verifica**: Sidebar con menu profilo visibile
- [ ] **Note**: _______________

### ✅ Risultato Test 1: PASS / FAIL
**Note aggiuntive**: _______________

---

## 🔄 Test 2: Cambio Profilo Durante Utilizzo

### Obiettivo
Verificare che il cambio profilo funzioni correttamente durante l'uso dell'app.

### Preparazione
- [ ] Crea un secondo profilo ("TestUser2", password "test456")
- [ ] Assicurati di essere autenticato come "TestUser1"

### Passi da seguire:

#### 2.1 Accesso Menu Profilo
- [ ] **Azione**: Clicca sull'avatar/nome profilo nell'header
- [ ] **Risultato atteso**: Menu dropdown con opzioni profilo
- [ ] **Verifica**: Opzioni "Cambia Profilo", "Logout", "Gestisci Profili"
- [ ] **Note**: _______________

#### 2.2 Inizia Cambio Profilo
- [ ] **Azione**: Clicca "Cambia Profilo"
- [ ] **Risultato atteso**: Torna alla schermata selezione profili
- [ ] **Verifica**: Lista mostra entrambi i profili creati
- [ ] **Note**: _______________

#### 2.3 Selezione Nuovo Profilo
- [ ] **Azione**: Clicca su "TestUser2"
- [ ] **Risultato atteso**: Richiede password per autenticazione
- [ ] **Verifica**: Campo password e pulsante "Accedi"
- [ ] **Note**: _______________

#### 2.4 Autenticazione Nuovo Profilo
- [ ] **Azione**: Inserisci password "test456" e clicca "Accedi"
- [ ] **Risultato atteso**: Autenticazione riuscita
- [ ] **Verifica**: Header ora mostra "TestUser2"
- [ ] **Note**: _______________

#### 2.5 Verifica Pulizia Dati Precedenti
- [ ] **Azione**: Controlla che non ci siano dati del profilo precedente
- [ ] **Risultato atteso**: Interfaccia pulita per nuovo profilo
- [ ] **Verifica**: Nessuna credenziale o impostazione di TestUser1
- [ ] **Note**: _______________

### ✅ Risultato Test 2: PASS / FAIL
**Note aggiuntive**: _______________

---

## 💾 Test 3: Persistenza Dati Tra Sessioni

### Obiettivo
Verificare che i dati del profilo persistano correttamente tra le sessioni.

### Preparazione
- [ ] Assicurati di essere autenticato come "TestUser2"
- [ ] Modifica alcune impostazioni (es. tema, lingua)
- [ ] Salva alcune credenziali di test

### Passi da seguire:

#### 3.1 Modifica Impostazioni Profilo
- [ ] **Azione**: Vai in Settings e modifica tema da "dark" a "light"
- [ ] **Risultato atteso**: Interfaccia cambia immediatamente
- [ ] **Verifica**: Tema applicato correttamente
- [ ] **Note**: _______________

#### 3.2 Salva Credenziali Test
- [ ] **Azione**: Vai in Store Manager e aggiungi credenziali Steam fake
- [ ] **Risultato atteso**: Credenziali salvate per profilo corrente
- [ ] **Verifica**: Conferma salvataggio
- [ ] **Note**: _______________

#### 3.3 Logout Completo
- [ ] **Azione**: Menu profilo → "Logout"
- [ ] **Risultato atteso**: Torna alla schermata selezione profili
- [ ] **Verifica**: Nessun profilo autenticato
- [ ] **Note**: _______________

#### 3.4 Chiusura e Riapertura App
- [ ] **Azione**: Chiudi completamente l'applicazione e riaprila
- [ ] **Risultato atteso**: Torna alla schermata selezione profili
- [ ] **Verifica**: Lista profili ancora presente
- [ ] **Note**: _______________

#### 3.5 Re-autenticazione
- [ ] **Azione**: Seleziona "TestUser2" e inserisci password
- [ ] **Risultato atteso**: Autenticazione riuscita
- [ ] **Verifica**: Accesso alla dashboard
- [ ] **Note**: _______________

#### 3.6 Verifica Persistenza Impostazioni
- [ ] **Azione**: Controlla che il tema sia ancora "light"
- [ ] **Risultato atteso**: Impostazioni mantenute
- [ ] **Verifica**: Tema light ancora attivo
- [ ] **Note**: _______________

#### 3.7 Verifica Persistenza Credenziali
- [ ] **Azione**: Vai in Store Manager e controlla credenziali Steam
- [ ] **Risultato atteso**: Credenziali ancora presenti
- [ ] **Verifica**: Dati salvati correttamente
- [ ] **Note**: _______________

### ✅ Risultato Test 3: PASS / FAIL
**Note aggiuntive**: _______________

---

## 🔒 Test 4: Sicurezza e Isolamento Profili

### Obiettivo
Verificare che i profili siano isolati correttamente e sicuri.

### Passi da seguire:

#### 4.1 Test Isolamento Credenziali
- [ ] **Azione**: Cambia da "TestUser2" a "TestUser1"
- [ ] **Risultato atteso**: TestUser1 non vede credenziali di TestUser2
- [ ] **Verifica**: Store Manager vuoto per TestUser1
- [ ] **Note**: _______________

#### 4.2 Test Isolamento Impostazioni
- [ ] **Azione**: Controlla tema in TestUser1
- [ ] **Risultato atteso**: Tema dovrebbe essere "dark" (default)
- [ ] **Verifica**: Impostazioni separate per profilo
- [ ] **Note**: _______________

#### 4.3 Test Password Errata
- [ ] **Azione**: Logout e prova ad accedere con password sbagliata
- [ ] **Risultato atteso**: Errore di autenticazione
- [ ] **Verifica**: Messaggio di errore chiaro
- [ ] **Note**: _______________

#### 4.4 Test Timeout Sessione (se implementato)
- [ ] **Azione**: Lascia app inattiva per tempo configurato
- [ ] **Risultato atteso**: Logout automatico per sicurezza
- [ ] **Verifica**: Richiede re-autenticazione
- [ ] **Note**: _______________

### ✅ Risultato Test 4: PASS / FAIL
**Note aggiuntive**: _______________

---

## 📊 RIEPILOGO FINALE

### Risultati Test Manuali
- [ ] **Test 1 - Flusso Startup**: PASS / FAIL
- [ ] **Test 2 - Cambio Profilo**: PASS / FAIL  
- [ ] **Test 3 - Persistenza Dati**: PASS / FAIL
- [ ] **Test 4 - Sicurezza**: PASS / FAIL

### Problemi Riscontrati
1. _______________
2. _______________
3. _______________

### Raccomandazioni
1. _______________
2. _______________
3. _______________

### Stato Complessivo
- [ ] **TUTTI I TEST PASSATI** - Sistema pronto per produzione
- [ ] **PROBLEMI MINORI** - Necessarie piccole correzioni
- [ ] **PROBLEMI SIGNIFICATIVI** - Richiede interventi importanti

---

## 📝 Note Aggiuntive
_______________
_______________
_______________

**Data Test**: _______________
**Tester**: _______________
**Versione App**: _______________