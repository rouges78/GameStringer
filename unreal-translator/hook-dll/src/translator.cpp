#include "translator.h"
#include "cache.h"
#include "ipc.h"
#include "utils.h"
#include <atomic>

namespace GSTranslator {

static TranslatorConfig g_config;
static std::atomic<bool> g_initialized(false);
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
    
    // Se connesso a GameStringer, chiedi traduzione
    if (IPC::IsConnected()) {
        uint64_t startTime = Utils::GetTimestampMs();
        
        uint32_t requestId = IPC::SendTranslateRequest(originalText);
        if (requestId > 0) {
            if (IPC::ReceiveTranslateResponse(requestId, translated, 2000)) {
                // Aggiorna latenza media
                uint64_t latency = Utils::GetTimestampMs() - startTime;
                g_stats.averageLatencyMs = (g_stats.averageLatencyMs + latency) / 2;
                
                // Salva in cache
                GetGlobalCache().Put(originalText, translated);
                
                return translated;
            }
        }
        
        g_stats.translationErrors++;
    }
    
    // Fallback: ritorna originale
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
