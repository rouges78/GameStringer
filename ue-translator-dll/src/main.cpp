/**
 * UE AutoTranslator DLL
 * 
 * Questa DLL viene iniettata in giochi Unreal Engine per intercettare
 * e tradurre il testo in tempo reale.
 * 
 * Funzionamento:
 * 1. Hook delle funzioni FText e UTextBlock
 * 2. Intercetta il testo prima del rendering
 * 3. Invia a GameStringer via Named Pipe per traduzione
 * 4. Sostituisce il testo originale con la traduzione
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <string>
#include <unordered_map>
#include <mutex>
#include <thread>
#include <MinHook.h>
#include "ipc_client.h"
#include "text_hooks.h"

// Configurazione
static bool g_TranslationEnabled = true;
static bool g_Initialized = false;
static std::mutex g_Mutex;

// Cache locale delle traduzioni
static std::unordered_map<std::wstring, std::wstring> g_TranslationCache;

// Client IPC per comunicazione con GameStringer
static IPCClient* g_IPCClient = nullptr;

/**
 * Traduce un testo usando la cache o GameStringer
 */
std::wstring TranslateText(const std::wstring& originalText) {
    if (!g_TranslationEnabled || originalText.empty()) {
        return originalText;
    }
    
    std::lock_guard<std::mutex> lock(g_Mutex);
    
    // Controlla cache locale
    auto it = g_TranslationCache.find(originalText);
    if (it != g_TranslationCache.end()) {
        return it->second;
    }
    
    // Richiedi traduzione a GameStringer
    if (g_IPCClient && g_IPCClient->IsConnected()) {
        std::wstring translated = g_IPCClient->RequestTranslation(originalText);
        if (!translated.empty() && translated != originalText) {
            g_TranslationCache[originalText] = translated;
            return translated;
        }
    }
    
    return originalText;
}

/**
 * Inizializza gli hook
 */
bool InitializeHooks() {
    if (MH_Initialize() != MH_OK) {
        OutputDebugStringA("[UE-Translator] Errore inizializzazione MinHook\n");
        return false;
    }
    
    // Inizializza hook per FText e UTextBlock
    if (!InitializeTextHooks()) {
        OutputDebugStringA("[UE-Translator] Errore inizializzazione text hooks\n");
        return false;
    }
    
    // Abilita tutti gli hook
    if (MH_EnableHook(MH_ALL_HOOKS) != MH_OK) {
        OutputDebugStringA("[UE-Translator] Errore abilitazione hooks\n");
        return false;
    }
    
    OutputDebugStringA("[UE-Translator] Hook inizializzati con successo\n");
    return true;
}

/**
 * Cleanup
 */
void Cleanup() {
    MH_DisableHook(MH_ALL_HOOKS);
    MH_Uninitialize();
    
    if (g_IPCClient) {
        g_IPCClient->Disconnect();
        delete g_IPCClient;
        g_IPCClient = nullptr;
    }
    
    g_TranslationCache.clear();
    g_Initialized = false;
    
    OutputDebugStringA("[UE-Translator] Cleanup completato\n");
}

/**
 * Thread principale del translator
 */
void TranslatorThread() {
    OutputDebugStringA("[UE-Translator] Thread avviato\n");
    
    // Connetti a GameStringer
    g_IPCClient = new IPCClient();
    if (!g_IPCClient->Connect()) {
        OutputDebugStringA("[UE-Translator] Impossibile connettersi a GameStringer\n");
        // Continua comunque, riproverà la connessione
    }
    
    // Inizializza hook
    if (!InitializeHooks()) {
        OutputDebugStringA("[UE-Translator] Inizializzazione fallita\n");
        return;
    }
    
    g_Initialized = true;
    OutputDebugStringA("[UE-Translator] Inizializzazione completata!\n");
    
    // Loop principale - mantiene la connessione e gestisce comandi
    while (g_Initialized) {
        if (g_IPCClient && !g_IPCClient->IsConnected()) {
            // Riprova connessione
            g_IPCClient->Connect();
        }
        
        // Processa messaggi in arrivo
        if (g_IPCClient) {
            g_IPCClient->ProcessMessages();
        }
        
        Sleep(100);
    }
}

/**
 * Entry point DLL
 */
BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID lpReserved) {
    switch (reason) {
        case DLL_PROCESS_ATTACH:
            DisableThreadLibraryCalls(hModule);
            OutputDebugStringA("[UE-Translator] DLL caricata!\n");
            
            // Avvia thread del translator
            std::thread(TranslatorThread).detach();
            break;
            
        case DLL_PROCESS_DETACH:
            Cleanup();
            break;
    }
    
    return TRUE;
}

/**
 * Esporta funzione per toggle traduzione (può essere chiamata da hotkey)
 */
extern "C" __declspec(dllexport) void ToggleTranslation() {
    g_TranslationEnabled = !g_TranslationEnabled;
    
    char msg[128];
    sprintf_s(msg, "[UE-Translator] Traduzione: %s\n", 
              g_TranslationEnabled ? "ATTIVA" : "DISATTIVA");
    OutputDebugStringA(msg);
}

/**
 * Esporta funzione per ottenere statistiche
 */
extern "C" __declspec(dllexport) int GetCacheSize() {
    std::lock_guard<std::mutex> lock(g_Mutex);
    return static_cast<int>(g_TranslationCache.size());
}

/**
 * Esporta funzione per pulire cache
 */
extern "C" __declspec(dllexport) void ClearCache() {
    std::lock_guard<std::mutex> lock(g_Mutex);
    g_TranslationCache.clear();
    OutputDebugStringA("[UE-Translator] Cache pulita\n");
}
