#include <Windows.h>
#include "hooks.h"
#include "translator.h"
#include "ipc.h"
#include "utils.h"

using namespace GSTranslator;

HMODULE g_hModule = nullptr;

// Thread principale per inizializzazione
DWORD WINAPI MainThread(LPVOID lpParam) {
    // Aspetta che il gioco sia completamente caricato
    Sleep(3000);
    
    Utils::LogInfo("GameStringer Unreal Translator v1.0.0");
    Utils::LogInfo("Inizializzazione...");
    
    // Rileva versione UE
    UEVersion ueVersion = DetectUEVersion();
    Utils::LogInfo("Versione UE rilevata: %s", UEVersionToString(ueVersion));
    
    if (ueVersion == UEVersion::Unknown) {
        Utils::LogError("Impossibile rilevare versione Unreal Engine!");
        return 1;
    }
    
    // Connetti a GameStringer via IPC
    if (!IPC::Initialize()) {
        Utils::LogWarning("Impossibile connettersi a GameStringer, uso cache locale");
    } else {
        Utils::LogInfo("Connesso a GameStringer");
        IPC::StartReceiveThread();
    }
    
    // Configura traduttore
    TranslatorConfig config;
    config.targetLanguage = L"it";
    config.sourceLanguage = L"en";
    config.cachePath = Utils::GetDllDirectory() + L"\\translations_cache.dat";
    
    if (!InitializeTranslator(config)) {
        Utils::LogError("Errore inizializzazione traduttore!");
        return 1;
    }
    
    // Installa hooks
    if (!InitializeHooks()) {
        Utils::LogError("Errore installazione hooks!");
        ShutdownTranslator();
        return 1;
    }
    
    Utils::LogInfo("GameStringer Translator attivo!");
    
    return 0;
}

// Cleanup thread
DWORD WINAPI CleanupThread(LPVOID lpParam) {
    Utils::LogInfo("Shutdown GameStringer Translator...");
    
    // Rimuovi hooks
    ShutdownHooks();
    
    // Salva cache
    SaveCache();
    
    // Chiudi IPC
    IPC::StopReceiveThread();
    IPC::Shutdown();
    
    // Shutdown traduttore
    ShutdownTranslator();
    
    Utils::LogInfo("Shutdown completato");
    
    // Scarica DLL
    FreeLibraryAndExitThread(g_hModule, 0);
    
    return 0;
}

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
        case DLL_PROCESS_ATTACH:
            g_hModule = hModule;
            DisableThreadLibraryCalls(hModule);
            
            // Crea thread di inizializzazione
            CreateThread(nullptr, 0, MainThread, nullptr, 0, nullptr);
            break;
            
        case DLL_PROCESS_DETACH:
            if (lpReserved == nullptr) {
                // Cleanup normale (non terminazione processo)
                CreateThread(nullptr, 0, CleanupThread, nullptr, 0, nullptr);
            }
            break;
    }
    
    return TRUE;
}

// Export per controllo esterno
extern "C" {
    __declspec(dllexport) bool GST_IsActive() {
        return true; // TODO: stato reale
    }
    
    __declspec(dllexport) void GST_SetEnabled(bool enabled) {
        // TODO: abilita/disabilita traduzione
    }
    
    __declspec(dllexport) void GST_SetTargetLanguage(const wchar_t* lang) {
        // TODO: cambia lingua
    }
    
    __declspec(dllexport) void GST_GetStats(uint64_t* requests, uint64_t* hits, uint64_t* errors) {
        auto stats = GetStats();
        if (requests) *requests = stats.totalRequests;
        if (hits) *hits = stats.cacheHits;
        if (errors) *errors = stats.translationErrors;
    }
}
