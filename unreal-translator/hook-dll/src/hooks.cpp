#include "hooks.h"
#include "translator.h"
#include "utils.h"
#include <MinHook.h>

namespace GSTranslator {

// Puntatori alle funzioni originali
UE::FText_ToString_t Original_FText_ToString = nullptr;
UE::UTextBlock_SetText_t Original_UTextBlock_SetText = nullptr;

// Versione UE rilevata
static UEVersion g_ueVersion = UEVersion::Unknown;

// Hook per FText::ToString
UE::FString* __fastcall Hooked_FText_ToString(const UE::FText* This, UE::FString* OutString) {
    // Chiama funzione originale
    UE::FString* result = Original_FText_ToString(This, OutString);
    
    if (result && result->Data && result->Len() > 0) {
        std::wstring originalText(result->Data, result->Len());
        
        // Salta stringhe troppo corte o che sembrano codice
        if (originalText.length() > 2 && 
            originalText.find(L"::") == std::wstring::npos &&
            originalText.find(L"//") == std::wstring::npos) {
            
            // Traduci
            std::wstring translated = Translate(originalText);
            
            if (translated != originalText && !translated.empty()) {
                // Copia traduzione nel buffer UE
                // NOTA: Questo è semplificato, in realtà serve gestire l'allocazione UE
                size_t len = translated.length();
                if (len < (size_t)result->ArrayMax) {
                    wcscpy_s(result->Data, result->ArrayMax, translated.c_str());
                    result->ArrayNum = (int32_t)(len + 1);
                }
            }
        }
    }
    
    return result;
}

// Hook per UTextBlock::SetText
void __fastcall Hooked_UTextBlock_SetText(UE::UTextBlock* This, const UE::FText& InText) {
    // Per ora passa direttamente - la traduzione avviene in FText::ToString
    // In futuro potremmo intercettare qui per widget specifici
    Original_UTextBlock_SetText(This, InText);
}

// Pattern scanner
uintptr_t FindPattern(const char* moduleName, const char* pattern) {
    HMODULE hModule = GetModuleHandleA(moduleName);
    if (!hModule) {
        hModule = GetModuleHandleA(nullptr); // Main module
    }
    
    if (!hModule) return 0;
    
    return Utils::PatternScan(hModule, pattern);
}

// Rileva versione UE analizzando il modulo
UEVersion DetectUEVersion() {
    // Cerca stringhe caratteristiche nel modulo principale
    HMODULE gameModule = GetModuleHandleA(nullptr);
    if (!gameModule) return UEVersion::Unknown;
    
    // Metodo 1: Cerca file Engine/Binaries
    std::wstring gameDir = Utils::GetGameDirectory();
    
    // UE5 ha cartella Engine/Binaries/Win64 con UnrealEditor*.dll
    if (Utils::FileExists(gameDir + L"\\Engine\\Binaries\\Win64\\UnrealEditor-Core.dll")) {
        return UEVersion::UE5_0; // O superiore
    }
    
    // UE4 ha UE4Game-*.dll o simili
    WIN32_FIND_DATAW findData;
    HANDLE hFind = FindFirstFileW((gameDir + L"\\*.dll").c_str(), &findData);
    if (hFind != INVALID_HANDLE_VALUE) {
        do {
            std::wstring filename(findData.cFileName);
            if (filename.find(L"UE4") != std::wstring::npos) {
                FindClose(hFind);
                return UEVersion::UE4_27; // Assume 4.27 come default UE4
            }
            if (filename.find(L"UE5") != std::wstring::npos) {
                FindClose(hFind);
                return UEVersion::UE5_0;
            }
        } while (FindNextFileW(hFind, &findData));
        FindClose(hFind);
    }
    
    // Metodo 2: Cerca pattern specifici in memoria
    // TODO: Implementare pattern scanning per versioni specifiche
    
    // Default: assume UE4.27 se non rilevato
    return UEVersion::UE4_27;
}

const char* UEVersionToString(UEVersion version) {
    switch (version) {
        case UEVersion::UE4_25: return "Unreal Engine 4.25";
        case UEVersion::UE4_26: return "Unreal Engine 4.26";
        case UEVersion::UE4_27: return "Unreal Engine 4.27";
        case UEVersion::UE5_0:  return "Unreal Engine 5.0";
        case UEVersion::UE5_1:  return "Unreal Engine 5.1";
        case UEVersion::UE5_2:  return "Unreal Engine 5.2";
        case UEVersion::UE5_3:  return "Unreal Engine 5.3";
        case UEVersion::UE5_4:  return "Unreal Engine 5.4";
        default: return "Unknown";
    }
}

// Seleziona pattern in base alla versione
const char* GetFTextToStringPattern(UEVersion version) {
    switch (version) {
        case UEVersion::UE4_25:
        case UEVersion::UE4_26:
        case UEVersion::UE4_27:
            return UE::Patterns::FText_ToString_UE427;
        case UEVersion::UE5_0:
        case UEVersion::UE5_1:
        case UEVersion::UE5_2:
        case UEVersion::UE5_3:
        case UEVersion::UE5_4:
            return UE::Patterns::FText_ToString_UE5;
        default:
            return nullptr;
    }
}

bool InitializeHooks() {
    Utils::LogInfo("Inizializzazione hooks...");
    
    // Inizializza MinHook
    if (MH_Initialize() != MH_OK) {
        Utils::LogError("Errore inizializzazione MinHook");
        return false;
    }
    
    g_ueVersion = DetectUEVersion();
    
    // Trova FText::ToString
    const char* pattern = GetFTextToStringPattern(g_ueVersion);
    if (!pattern) {
        Utils::LogError("Pattern non disponibile per questa versione UE");
        return false;
    }
    
    uintptr_t fTextToString = FindPattern(nullptr, pattern);
    if (!fTextToString) {
        Utils::LogWarning("FText::ToString non trovato, provo pattern alternativi...");
        // TODO: Provare pattern alternativi
        return false;
    }
    
    Utils::LogInfo("FText::ToString trovato a 0x%p", (void*)fTextToString);
    
    // Crea hook
    if (MH_CreateHook((LPVOID)fTextToString, 
                      (LPVOID)&Hooked_FText_ToString,
                      (LPVOID*)&Original_FText_ToString) != MH_OK) {
        Utils::LogError("Errore creazione hook FText::ToString");
        return false;
    }
    
    // Abilita hook
    if (MH_EnableHook((LPVOID)fTextToString) != MH_OK) {
        Utils::LogError("Errore abilitazione hook FText::ToString");
        return false;
    }
    
    Utils::LogInfo("Hook FText::ToString installato!");
    
    return true;
}

void ShutdownHooks() {
    Utils::LogInfo("Rimozione hooks...");
    
    MH_DisableHook(MH_ALL_HOOKS);
    MH_Uninitialize();
    
    Utils::LogInfo("Hooks rimossi");
}

} // namespace GSTranslator
