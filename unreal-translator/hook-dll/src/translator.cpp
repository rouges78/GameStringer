#include "translator.h"
#include "cache.h"
#include "ipc.h"
#include "utils.h"
#include <atomic>
#include <mutex>
#include <unordered_set>

namespace GSTranslator {

static TranslatorConfig g_config;
static std::atomic<bool> g_initialized(false);
// Testi già richiesti via IPC e in attesa di risposta: evita di reinviare la
// stessa richiesta a ogni draw call mentre l'AI fallback lavora.
static std::mutex g_pendingMutex;
static std::unordered_set<std::wstring> g_pendingRequests;
static TranslatorStats g_stats;
static LogCallback g_logCallback = nullptr;

bool InitializeTranslator(const TranslatorConfig& config) {
    g_config = config;
    
    // Carica cache da disco
    if (g_config.cacheEnabled && !g_config.cachePath.empty()) {
        if (LoadCache()) {
            Utils::LogInfo("Cache caricata: %zu entries", GetGlobalCache().Size());
        }
    }
    
    // Le risposte IPC arrivano dal receive thread: dritte in cache, mai un
    // blocco sul thread che disegna. La cache ha il suo mutex interno.
    IPC::SetTranslationArrivedCallback([](const std::wstring& original,
                                          const std::wstring& translated) {
        if (!translated.empty()) {
            GetGlobalCache().Put(original, translated);
        }
        std::lock_guard<std::mutex> lock(g_pendingMutex);
        g_pendingRequests.erase(original);
    });

    g_initialized = true;
    return true;
}

void ShutdownTranslator() {
    if (!g_initialized) return;
    
    // Salva cache
    if (g_config.cacheEnabled) {
        SaveCache();
    }
    
    g_initialized = false;
}

std::wstring Translate(const std::wstring& originalText) {
    if (!g_initialized || !g_config.enabled) {
        return originalText;
    }
    
    g_stats.totalRequests++;
    
    // Cerca in cache
    std::wstring translated;
    if (GetGlobalCache().Get(originalText, translated)) {
        g_stats.cacheHits++;
        return translated;
    }
    
    g_stats.cacheMisses++;
    
    // Se connesso a GameStringer, chiedi la traduzione SENZA bloccare:
    // fire-and-forget, la risposta arriva dal receive thread e finisce in
    // cache (vedi il callback in InitializeTranslator). Questo gira dentro
    // gli hook di rendering: un'attesa qui congelerebbe il gioco.
    if (IPC::IsConnected()) {
        std::lock_guard<std::mutex> lock(g_pendingMutex);
        if (g_pendingRequests.insert(originalText).second) {
            if (IPC::SendTranslateRequest(originalText) == 0) {
                g_pendingRequests.erase(originalText);
                g_stats.translationErrors++;
            }
        }
    }
    
    // Il primo draw mostra l'originale; dal prossimo, se la risposta è
    // arrivata, la cache fa hit.
    return originalText;
}

void TranslateAsync(const std::wstring& originalText, 
                    std::function<void(const std::wstring&)> callback) {
    // Per ora sincrono, TODO: implementare async
    std::wstring result = Translate(originalText);
    if (callback) {
        callback(result);
    }
}

bool IsInCache(const std::wstring& text) {
    return GetGlobalCache().Contains(text);
}

void AddToCache(const std::wstring& original, const std::wstring& translated) {
    GetGlobalCache().Put(original, translated);
}

bool SaveCache() {
    if (g_config.cachePath.empty()) return false;
    return GetGlobalCache().SaveToFile(g_config.cachePath);
}

bool LoadCache() {
    if (g_config.cachePath.empty()) return false;
    return GetGlobalCache().LoadFromFile(g_config.cachePath);
}

TranslatorStats GetStats() {
    return g_stats;
}

void SetLogCallback(LogCallback callback) {
    g_logCallback = callback;
}

} // namespace GSTranslator
