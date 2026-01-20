//! Modulo per la gestione sicura della memoria sensibile

use std::ptr;
use std::ops::{Deref, DerefMut};
use std::fmt;

/// Wrapper per dati sensibili che vengono puliti dalla memoria quando escono dallo scope
#[derive(Clone)]
pub struct SecureMemory<T: Default + Clone> {
    /// Dati sensibili
    data: T,
}

impl<T: Default + Clone> SecureMemory<T> {
    /// Crea una nuova istanza di SecureMemory
    pub fn new(data: T) -> Self {
        Self { data }
    }

    /// Ottiene una copia dei dati
    pub fn get(&self) -> T {
        self.data.clone()
    }

    /// Imposta nuovi dati
    pub fn set(&mut self, data: T) {
        // Pulisci i vecchi dati
        self.clear();
        // Imposta i nuovi dati
        self.data = data;
    }

    /// Pulisce i dati in memoria
    pub fn clear(&mut self) {
        // Sovrascrivi con il valore di default
        self.data = T::default();
        // Assicura che il compilatore non ottimizzi via questa operazione
        std::sync::atomic::fence(std::sync::atomic::Ordering::SeqCst);
    }
}

impl<T: Default + Clone> Drop for SecureMemory<T> {
    fn drop(&mut self) {
        // Pulisci i dati quando l'oggetto viene deallocato
        self.clear();
    }
}

impl<T: Default + Clone> Deref for SecureMemory<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.data
    }
}

impl<T: Default + Clone> DerefMut for SecureMemory<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.data
    }
}

// Implementazione specifica per String per evitare leak di memoria
impl SecureMemory<String> {
    /// Pulisce una stringa in modo sicuro
    pub fn clear_string(&mut self) {
        let len = self.data.len();
        
        // Sovrascrivi con zeri
        unsafe {
            let ptr = self.data.as_mut_ptr();
            ptr::write_bytes(ptr, 0, len);
        }
        
        // Reimposta la stringa
        self.data.clear();
    }
}

// Implementazione specifica per Vec<u8> per evitare leak di memoria
impl SecureMemory<Vec<u8>> {
    /// Pulisce un vettore di byte in modo sicuro
    pub fn clear_bytes(&mut self) {
        let len = self.data.len();
        
        // Sovrascrivi con zeri
        unsafe {
            let ptr = self.data.as_mut_ptr();
            ptr::write_bytes(ptr, 0, len);
        }
        
        // Reimposta il vettore
        self.data.clear();
    }
}

// Previeni la visualizzazione dei dati sensibili nei log
impl<T: Default + Clone> fmt::Debug for SecureMemory<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[DATI SENSIBILI]")
    }
}

// Previeni la visualizzazione dei dati sensibili nei log
impl<T: Default + Clone> fmt::Display for SecureMemory<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[DATI SENSIBILI]")
    }
}

/// Funzione per pulire in modo sicuro una stringa
pub fn secure_clear_string(s: &mut String) {
    let len = s.len();
    
    // Sovrascrivi con zeri
    unsafe {
        let ptr = s.as_mut_ptr();
        ptr::write_bytes(ptr, 0, len);
    }
    
    // Reimposta la stringa
    s.clear();
}

/// Funzione per pulire in modo sicuro un vettore di byte
pub fn secure_clear_bytes(bytes: &mut Vec<u8>) {
    let len = bytes.len();
    
    // Sovrascrivi con zeri
    unsafe {
        let ptr = bytes.as_mut_ptr();
        ptr::write_bytes(ptr, 0, len);
    }
    
    // Reimposta il vettore
    bytes.clear();
}

/// Funzione per pulire in modo sicuro un array di byte
pub fn secure_clear_array<const N: usize>(arr: &mut [u8; N]) {
    // Sovrascrivi con zeri
    unsafe {
        let ptr = arr.as_mut_ptr();
        ptr::write_bytes(ptr, 0, N);
    }
}