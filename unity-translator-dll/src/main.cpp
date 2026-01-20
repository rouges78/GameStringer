/**
 * Unity AutoTranslator DLL - Direct Injection
 * 
 * Bypassa BepInEx/MelonLoader - injection diretta nel processo Unity.
 * Hooka le funzioni di rendering testo a livello nativo.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <string>
#include <unordered_map>
#include <mutex>
#include <thread>
#include <MinHook.h>
#include "ipc_client.h"

// Configurazione
static bool g_TranslationEnabled = true;
static bool g_Initialized = false;
static std::mutex g_Mutex;
static std::unordered_map<std::wstring, std::wstring> g_TranslationCache;
static IPCClient* g_IPCClient = nullptr;

// Tipi per Unity/Mono
typedef void* MonoString;
typedef void* MonoObject;
typedef void* MonoDomain;
typedef void* MonoAssembly;
typedef void* MonoImage;
typedef void* MonoClass;
typedef void* MonoMethod;

// Funzioni Mono importate dinamicamente
typedef MonoDomain* (*mono_get_root_domain_t)();
typedef MonoAssembly* (*mono_domain_assembly_open_t)(MonoDomain*, const char*);
typedef MonoImage* (*mono_assembly_get_image_t)(MonoAssembly*);
typedef MonoClass* (*mono_class_from_name_t)(MonoImage*, const char*, const char*);
typedef MonoMethod* (*mono_class_get_method_from_name_t)(MonoClass*, const char*, int);
typedef MonoObject* (*mono_runtime_invoke_t)(MonoMethod*, void*, void**, MonoObject**);
typedef MonoString* (*mono_string_new_utf16_t)(MonoDomain*, const wchar_t*, int);
typedef wchar_t* (*mono_string_to_utf16_t)(MonoString*);
typedef int (*mono_string_length_t)(MonoString*);

static mono_get_root_domain_t mono_get_root_domain = nullptr;
static mono_string_new_utf16_t mono_string_new_utf16 = nullptr;
static mono_string_to_utf16_t mono_string_to_utf16 = nullptr;
static mono_string_length_t mono_string_length = nullptr;

// Hook per mono_string_new (intercetta creazione stringhe)
typedef MonoString* (*mono_string_new_t)(MonoDomain*, const char*);
static mono_string_new_t Original_mono_string_new = nullptr;

// Hook per mono_string_new_utf16
typedef MonoString* (*mono_string_new_utf16_hook_t)(MonoDomain*, const wchar_t*, int);
static mono_string_new_utf16_hook_t Original_mono_string_new_utf16 = nullptr;

// Contatore per debug
static int g_HookCount = 0;

// Contatore globale per debug
static int g_StringCount = 0;

MonoString* Hook_mono_string_new(MonoDomain* domain, const char* text) {
    g_StringCount++;
    
    // Log ogni 50 stringhe per vedere se hook funziona
    if (g_StringCount % 50 == 1) {
        char dbg[256];
        sprintf_s(dbg, "[Unity-Translator] Hook chiamato %d volte\n", g_StringCount);
        OutputDebugStringA(dbg);
    }
    
    if (!text) {
        return Original_mono_string_new(domain, text);
    }
    
    size_t len = strlen(text);
    
    // Log stringhe interessanti (testo leggibile)
    if (len >= 3 && len <= 200) {
        // Verifica se contiene lettere (testo reale)
        bool hasLetter = false;
        for (size_t i = 0; i < len && i < 50; i++) {
            if ((text[i] >= 'A' && text[i] <= 'Z') || (text[i] >= 'a' && text[i] <= 'z')) {
                hasLetter = true;
                break;
            }
        }
        if (hasLetter) {
            char dbg[512];
            sprintf_s(dbg, "[Unity-Translator] TEXT: %.100s\n", text);
            OutputDebugStringA(dbg);
        }
    }
    
    if (!g_TranslationEnabled || !g_Initialized || len < 3) {
        return Original_mono_string_new(domain, text);
    }
    
    // Filtra stringhe troppo lunghe
    if (len > 500) {
        return Original_mono_string_new(domain, text);
    }
    
    // Filtra stringhe che sembrano path/codice
    if (strchr(text, '/') || strchr(text, '\\') || strchr(text, '{') || strchr(text, '<')) {
        return Original_mono_string_new(domain, text);
    }
    
    // Converti a wstring per cache
    int wlen = MultiByteToWideChar(CP_UTF8, 0, text, -1, NULL, 0);
    if (wlen <= 0) return Original_mono_string_new(domain, text);
    
    std::wstring wtext(wlen - 1, 0);
    MultiByteToWideChar(CP_UTF8, 0, text, -1, &wtext[0], wlen);
    
    // Controlla cache
    {
        std::lock_guard<std::mutex> lock(g_Mutex);
        auto it = g_TranslationCache.find(wtext);
        if (it != g_TranslationCache.end() && !it->second.empty()) {
            return Original_mono_string_new_utf16(domain, it->second.c_str(), (int)it->second.length());
        }
    }
    
    // Richiedi traduzione async (non blocca)
    if (g_IPCClient && g_IPCClient->IsConnected()) {
        std::wstring translated = g_IPCClient->RequestTranslation(wtext);
        if (!translated.empty() && translated != wtext) {
            std::lock_guard<std::mutex> lock(g_Mutex);
            g_TranslationCache[wtext] = translated;
            return Original_mono_string_new_utf16(domain, translated.c_str(), (int)translated.length());
        }
    }
    
    return Original_mono_string_new(domain, text);
}

MonoString* Hook_mono_string_new_utf16(MonoDomain* domain, const wchar_t* text, int len) {
    if (!g_TranslationEnabled || !g_Initialized || !text || len < 3 || len > 500) {
        return Original_mono_string_new_utf16(domain, text, len);
    }
    
    // Filtra stringhe che sembrano path/codice
    std::wstring wtext(text, len);
    if (wtext.find(L'/') != std::wstring::npos || 
        wtext.find(L'\\') != std::wstring::npos ||
        wtext.find(L'{') != std::wstring::npos ||
        wtext.find(L'<') != std::wstring::npos) {
        return Original_mono_string_new_utf16(domain, text, len);
    }
    
    // Controlla cache
    {
        std::lock_guard<std::mutex> lock(g_Mutex);
        auto it = g_TranslationCache.find(wtext);
        if (it != g_TranslationCache.end() && !it->second.empty()) {
            return Original_mono_string_new_utf16(domain, it->second.c_str(), (int)it->second.length());
        }
    }
    
    // Richiedi traduzione async
    if (g_IPCClient && g_IPCClient->IsConnected()) {
        std::wstring translated = g_IPCClient->RequestTranslation(wtext);
        if (!translated.empty() && translated != wtext) {
            std::lock_guard<std::mutex> lock(g_Mutex);
            g_TranslationCache[wtext] = translated;
            return Original_mono_string_new_utf16(domain, translated.c_str(), (int)translated.length());
        }
    }
    
    return Original_mono_string_new_utf16(domain, text, len);
}

// Tipi per mono_runtime_invoke hook
typedef const char* (*mono_method_get_name_t)(MonoMethod*);
typedef MonoClass* (*mono_method_get_class_t)(MonoMethod*);
typedef const char* (*mono_class_get_name_t)(MonoClass*);
static mono_method_get_name_t mono_method_get_name = nullptr;
static mono_method_get_class_t mono_method_get_class = nullptr;
static mono_class_get_name_t mono_class_get_name = nullptr;

// Hook per mono_runtime_invoke - intercetta TUTTE le chiamate a metodi
typedef MonoObject* (*mono_runtime_invoke_t)(MonoMethod*, void*, void**, MonoObject**);
static mono_runtime_invoke_t Original_mono_runtime_invoke = nullptr;

static int g_InvokeCount = 0;

MonoObject* Hook_mono_runtime_invoke(MonoMethod* method, void* obj, void** params, MonoObject** exc) {
    g_InvokeCount++;
    
    // Log solo ogni 100000 chiamate (molto meno spam)
    if (g_InvokeCount % 100000 == 1) {
        char dbg[256];
        sprintf_s(dbg, "[Unity-Translator] invoke: %d\n", g_InvokeCount);
        OutputDebugStringA(dbg);
    }
    
    // Cerca SOLO metodi SetText (non Update!)
    if (method && mono_method_get_name && mono_method_get_class && mono_class_get_name) {
        const char* methodName = mono_method_get_name(method);
        if (methodName) {
            // Cerca solo SetText, set_text - NON Update!
            if (strstr(methodName, "SetText") || strstr(methodName, "set_text") ||
                strcmp(methodName, "set_Text") == 0 || strcmp(methodName, "SetCharArray") == 0) {
                MonoClass* klass = mono_method_get_class(method);
                const char* className = klass ? mono_class_get_name(klass) : "?";
                
                char dbg[512];
                sprintf_s(dbg, "[Unity-Translator] SETTEXT: %s.%s\n", className, methodName);
                OutputDebugStringA(dbg);
            }
        }
    }
    
    return Original_mono_runtime_invoke(method, obj, params, exc);
}

// Trova e hooka le funzioni Mono
bool InitializeMonoHooks() {
    HMODULE hMono = GetModuleHandleA("mono-2.0-bdwgc.dll");
    if (!hMono) {
        hMono = GetModuleHandleA("mono.dll");
    }
    if (!hMono) {
        OutputDebugStringA("[Unity-Translator] Mono DLL non trovata\n");
        return false;
    }
    
    OutputDebugStringA("[Unity-Translator] Mono DLL trovata!\n");
    
    // Importa funzioni Mono
    mono_get_root_domain = (mono_get_root_domain_t)GetProcAddress(hMono, "mono_get_root_domain");
    mono_string_new_utf16 = (mono_string_new_utf16_t)GetProcAddress(hMono, "mono_string_new_utf16");
    mono_string_to_utf16 = (mono_string_to_utf16_t)GetProcAddress(hMono, "mono_string_to_utf16");
    mono_string_length = (mono_string_length_t)GetProcAddress(hMono, "mono_string_length");
    mono_method_get_name = (mono_method_get_name_t)GetProcAddress(hMono, "mono_method_get_name");
    mono_method_get_class = (mono_method_get_class_t)GetProcAddress(hMono, "mono_method_get_class");
    mono_class_get_name = (mono_class_get_name_t)GetProcAddress(hMono, "mono_class_get_name");
    
    // Hook mono_runtime_invoke - intercetta TUTTE le chiamate
    void* pMonoRuntimeInvoke = GetProcAddress(hMono, "mono_runtime_invoke");
    if (pMonoRuntimeInvoke) {
        if (MH_CreateHook(pMonoRuntimeInvoke, &Hook_mono_runtime_invoke, (LPVOID*)&Original_mono_runtime_invoke) == MH_OK) {
            MH_EnableHook(pMonoRuntimeInvoke);
            OutputDebugStringA("[Unity-Translator] Hook mono_runtime_invoke attivo!\n");
        }
    }
    
    // Hook mono_string_new
    void* pMonoStringNew = GetProcAddress(hMono, "mono_string_new");
    if (pMonoStringNew) {
        if (MH_CreateHook(pMonoStringNew, &Hook_mono_string_new, (LPVOID*)&Original_mono_string_new) == MH_OK) {
            MH_EnableHook(pMonoStringNew);
            OutputDebugStringA("[Unity-Translator] Hook mono_string_new attivo!\n");
        }
    }
    
    // Hook mono_string_new_utf16
    void* pMonoStringNewUtf16 = GetProcAddress(hMono, "mono_string_new_utf16");
    if (pMonoStringNewUtf16) {
        if (MH_CreateHook(pMonoStringNewUtf16, &Hook_mono_string_new_utf16, (LPVOID*)&Original_mono_string_new_utf16) == MH_OK) {
            MH_EnableHook(pMonoStringNewUtf16);
            OutputDebugStringA("[Unity-Translator] Hook mono_string_new_utf16 attivo!\n");
        }
    }
    
    OutputDebugStringA("[Unity-Translator] Hooks inizializzati!\n");
    return true;
}

void TranslatorThread() {
    OutputDebugStringA("[Unity-Translator] Thread avviato\n");
    
    // Attendi che Mono sia caricato
    Sleep(2000);
    
    // Inizializza MinHook
    if (MH_Initialize() != MH_OK) {
        OutputDebugStringA("[Unity-Translator] Errore MinHook\n");
        return;
    }
    
    // Inizializza hook Mono
    if (!InitializeMonoHooks()) {
        OutputDebugStringA("[Unity-Translator] Hook Mono fallito\n");
        return;
    }
    
    // Connetti IPC
    g_IPCClient = new IPCClient();
    g_IPCClient->Connect();
    
    g_Initialized = true;
    OutputDebugStringA("[Unity-Translator] Inizializzazione completata!\n");
    
    // Loop principale
    while (g_Initialized) {
        if (g_IPCClient && !g_IPCClient->IsConnected()) {
            g_IPCClient->Connect();
        }
        if (g_IPCClient) {
            g_IPCClient->ProcessMessages();
        }
        Sleep(100);
    }
}

void Cleanup() {
    g_Initialized = false;
    MH_DisableHook(MH_ALL_HOOKS);
    MH_Uninitialize();
    if (g_IPCClient) {
        delete g_IPCClient;
        g_IPCClient = nullptr;
    }
    g_TranslationCache.clear();
}

BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID lpReserved) {
    switch (reason) {
        case DLL_PROCESS_ATTACH:
            DisableThreadLibraryCalls(hModule);
            OutputDebugStringA("[Unity-Translator] DLL caricata!\n");
            std::thread(TranslatorThread).detach();
            break;
        case DLL_PROCESS_DETACH:
            Cleanup();
            break;
    }
    return TRUE;
}

extern "C" __declspec(dllexport) void ToggleTranslation() {
    g_TranslationEnabled = !g_TranslationEnabled;
}

extern "C" __declspec(dllexport) int GetCacheSize() {
    std::lock_guard<std::mutex> lock(g_Mutex);
    return (int)g_TranslationCache.size();
}

extern "C" __declspec(dllexport) void ClearCache() {
    std::lock_guard<std::mutex> lock(g_Mutex);
    g_TranslationCache.clear();
}
