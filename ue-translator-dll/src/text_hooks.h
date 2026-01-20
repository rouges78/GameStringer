#pragma once
/**
 * Hook per funzioni di testo Unreal Engine
 * 
 * Intercetta FText e UTextBlock per tradurre il testo in tempo reale.
 */

#include <windows.h>
#include <psapi.h>
#include <string>
#include <MinHook.h>

// Forward declaration
std::wstring TranslateText(const std::wstring& originalText);

// Pattern per trovare funzioni UE in memoria
// Questi pattern sono per UE4/UE5 x64

// Typedef per le funzioni originali
typedef void* (*FText_FromString_t)(void* result, const wchar_t* str);
typedef void (*UTextBlock_SetText_t)(void* thisPtr, void* text);

// Puntatori alle funzioni originali
static FText_FromString_t Original_FText_FromString = nullptr;
static UTextBlock_SetText_t Original_UTextBlock_SetText = nullptr;

// Indirizzi delle funzioni (da trovare con pattern scanning)
static void* Addr_FText_FromString = nullptr;
static void* Addr_UTextBlock_SetText = nullptr;

/**
 * Hook per FText::FromString
 * Questa funzione viene chiamata quando si crea un FText da stringa
 */
void* Hook_FText_FromString(void* result, const wchar_t* str) {
    if (str && wcslen(str) > 0) {
        std::wstring original(str);
        std::wstring translated = TranslateText(original);
        
        if (translated != original) {
            // Usa la traduzione
            return Original_FText_FromString(result, translated.c_str());
        }
    }
    
    return Original_FText_FromString(result, str);
}

/**
 * Cerca pattern in memoria
 */
void* FindPattern(const char* module, const char* pattern, const char* mask) {
    HMODULE hModule = GetModuleHandleA(module);
    if (!hModule) return nullptr;
    
    MODULEINFO moduleInfo;
    GetModuleInformation(GetCurrentProcess(), hModule, &moduleInfo, sizeof(moduleInfo));
    
    DWORD_PTR base = (DWORD_PTR)hModule;
    DWORD size = moduleInfo.SizeOfImage;
    
    size_t patternLen = strlen(mask);
    
    for (DWORD_PTR i = 0; i < size - patternLen; i++) {
        bool found = true;
        for (size_t j = 0; j < patternLen; j++) {
            if (mask[j] == 'x' && pattern[j] != *(char*)(base + i + j)) {
                found = false;
                break;
            }
        }
        if (found) {
            return (void*)(base + i);
        }
    }
    
    return nullptr;
}

/**
 * Trova le funzioni UE tramite pattern scanning
 */
bool FindUEFunctions() {
    // Pattern per FText::FromString (UE4/UE5 x64)
    // Questi pattern possono variare tra versioni UE
    
    // Metodo alternativo: cerca export o vtable
    
    // Per ora, usiamo un approccio basato su signature scanning generico
    // In produzione, questi pattern andrebbero calibrati per ogni versione UE
    
    OutputDebugStringA("[UE-Translator] Ricerca funzioni UE...\n");
    
    // Lista moduli da cercare
    const char* modules[] = {
        nullptr,  // Modulo principale (exe)
        "UnrealEngine.dll",
        "Engine.dll",
        NULL
    };
    
    // Per ogni modulo, cerca le funzioni
    for (int i = 0; modules[i] || i == 0; i++) {
        HMODULE hMod = GetModuleHandleA(modules[i]);
        if (!hMod && i > 0) continue;
        
        // TODO: Implementare pattern scanning specifico per versione UE
        // Per ora, logga che stiamo cercando
        char msg[256];
        sprintf_s(msg, "[UE-Translator] Scanning modulo: %s\n", 
                  modules[i] ? modules[i] : "(main)");
        OutputDebugStringA(msg);
    }
    
    // NOTA: La ricerca delle funzioni richiede pattern specifici per ogni versione UE
    // Per una demo funzionante, potremmo usare IAT hooking invece
    
    return true;  // Per ora ritorna sempre true per continuare l'inizializzazione
}

/**
 * Inizializza gli hook per le funzioni di testo
 */
bool InitializeTextHooks() {
    OutputDebugStringA("[UE-Translator] Inizializzazione text hooks...\n");
    
    // Trova le funzioni UE
    if (!FindUEFunctions()) {
        OutputDebugStringA("[UE-Translator] Funzioni UE non trovate\n");
        // Non è un errore fatale - alcune funzioni potrebbero non esistere
    }
    
    // Crea hook per FText::FromString se trovata
    if (Addr_FText_FromString) {
        if (MH_CreateHook(Addr_FText_FromString, 
                          &Hook_FText_FromString,
                          (LPVOID*)&Original_FText_FromString) != MH_OK) {
            OutputDebugStringA("[UE-Translator] Errore creazione hook FText::FromString\n");
        } else {
            OutputDebugStringA("[UE-Translator] Hook FText::FromString creato\n");
        }
    }
    
    // Crea hook per UTextBlock::SetText se trovata
    if (Addr_UTextBlock_SetText) {
        if (MH_CreateHook(Addr_UTextBlock_SetText,
                          nullptr,  // TODO: Implementare hook
                          (LPVOID*)&Original_UTextBlock_SetText) != MH_OK) {
            OutputDebugStringA("[UE-Translator] Errore creazione hook UTextBlock::SetText\n");
        } else {
            OutputDebugStringA("[UE-Translator] Hook UTextBlock::SetText creato\n");
        }
    }
    
    OutputDebugStringA("[UE-Translator] Text hooks inizializzati\n");
    return true;
}
