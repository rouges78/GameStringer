//
// dllmain.cpp — orchestratore di gs-hook (Universal Text Interception Framework).
//
// All'iniezione nel processo del gioco:
//   1. inizializza MinHook + IPC verso GameStringer + il translator (cache/IPC)
//   2. crea tutte le sorgenti registrate, ordinate per livello (L1 → L2 → L3)
//   3. attiva la PRIMA sorgente applicabile per livello:
//        - se una sorgente L1 (per-engine) si attiva, ci fermiamo lì (è la migliore)
//        - altrimenti scende a L2 (GDI/DirectWrite/FreeType, universale)
//        - altrimenti L3 (OCR-fusion)
//   4. riporta a GameStringer quale livello è attivo (per l'UI: "permanente"
//      vs "in tempo reale").
//
// Il translate-bridge (g_TranslateBridge) collega le sorgenti al core di
// traduzione: cache locale → IPC verso l'app se manca. Il core vive nei moduli
// generici translator.cpp / cache.cpp / ipc.cpp riusati da unreal-translator.
//
#include "text_source.h"
#include "gs_log.h"
#include "gs_overlay_ipc.h"
#include "translator.h"   // core generico riusato: namespace GSTranslator
#include "ipc.h"          // client pipe GameStringerTranslator (stesso core)
#include <Windows.h>
#include <MinHook.h>
#include <vector>
#include <string>

// Richiesto dal core riusato (utils.cpp fa `extern HMODULE g_hModule` in
// GSTranslator::Utils per ricavare la directory della DLL). In unreal-translator
// è definito nel suo dllmain; qui lo definiamo noi.
namespace GSTranslator { namespace Utils { HMODULE g_hModule = nullptr; } }

namespace {

std::vector<std::unique_ptr<gs::ITextSource>> g_active;

// Bridge passato a ogni sorgente: punto unico verso cache/IPC del core.
std::wstring TranslateBridge(const std::wstring& original) {
    return GSTranslator::Translate(original);
}

void LogA(const char* msg) { gs::LogLineA(msg); }

DWORD WINAPI MainThread(LPVOID) {
    Sleep(3000); // attendi il caricamento del gioco

    if (MH_Initialize() != MH_OK) { LogA("[gs-hook] MinHook init FAILED\n"); return 1; }

    // Connetti a GameStringer (pipe GameStringerTranslator, server Rust in
    // translator_pipe.rs). Senza backend si prosegue in sola cache locale.
    if (GSTranslator::IPC::Initialize()) {
        GSTranslator::IPC::StartReceiveThread();
        LogA("[gs-hook] connesso a GameStringer via IPC\n");
    } else {
        LogA("[gs-hook] GameStringer non raggiungibile, solo cache locale\n");
    }

    // Lingue: in produzione arrivano da GameStringer via IPC/config. Default qui.
    GSTranslator::TranslatorConfig cfg;
    cfg.targetLanguage = L"it";
    cfg.sourceLanguage = L"en";
    // Override da env per test SENZA backend: GS_HOOK_CACHE = path di un file
    // cache GSTC pre-seedato (formato di cache.cpp). In produzione il path
    // arriva da GameStringer via IPC/config; speculare a GS_HOOK_LOG.
    wchar_t cacheEnv[MAX_PATH] = {};
    if (GetEnvironmentVariableW(L"GS_HOOK_CACHE", cacheEnv, MAX_PATH) > 0) {
        cfg.cachePath = cacheEnv;
    }
    GSTranslator::InitializeTranslator(cfg);
    if (!cfg.cachePath.empty()) {
        char buf[320];
        sprintf_s(buf, "[gs-hook] cache pre-seedata da GS_HOOK_CACHE: %ls\n",
                  cfg.cachePath.c_str());
        LogA(buf);
    }

    auto sources = gs::SourceRegistry::Instance().CreateAllSorted();

    int activatedLevel = 0;
    for (auto& src : sources) {
        if (!src->IsApplicable()) continue;

        // Una volta attivato un livello, non scendiamo più in basso: L1 batte L2
        // batte L3. (Più sorgenti dello STESSO livello possono coesistere, es.
        // GDI + DirectWrite insieme a L2.)
        if (activatedLevel != 0 &&
            static_cast<int>(src->GetLevel()) > activatedLevel) {
            continue;
        }

        auto res = src->Activate(&TranslateBridge);
        if (res == gs::Activation::Activated) {
            char buf[160];
            sprintf_s(buf, "[gs-hook] sorgente attiva: %s (livello %d)\n",
                      src->Name(), static_cast<int>(src->GetLevel()));
            LogA(buf);
            activatedLevel = static_cast<int>(src->GetLevel());
            g_active.push_back(std::move(src));
        }
    }

    if (activatedLevel == 0) {
        LogA("[gs-hook] nessuna sorgente di testo attivabile in questo processo\n");
    }
    // TODO: notificare a GameStringer via IPC il livello attivo (per l'UI).
    return 0;
}

DWORD WINAPI CleanupThread(LPVOID) {
    for (auto& src : g_active) src->Deactivate();
    g_active.clear();
    MH_DisableHook(MH_ALL_HOOKS);
    MH_Uninitialize();
    // Ordine obbligato: StopReceiveThread cancella le I/O overlapped in corso
    // e joina i thread; solo dopo Shutdown può chiudere l'handle (chiuderlo
    // mentre un thread attende su un OVERLAPPED è use-after-free).
    GSTranslator::IPC::StopReceiveThread();
    GSTranslator::IPC::Shutdown();
    GSTranslator::ShutdownTranslator();
    gs::overlay::Shutdown();
    return 0;
}

} // namespace

BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID) {
    switch (reason) {
        case DLL_PROCESS_ATTACH:
            GSTranslator::Utils::g_hModule = hModule;
            DisableThreadLibraryCalls(hModule);
            CreateThread(nullptr, 0, MainThread, nullptr, 0, nullptr);
            break;
        case DLL_PROCESS_DETACH:
            CreateThread(nullptr, 0, CleanupThread, nullptr, 0, nullptr);
            break;
    }
    return TRUE;
}
