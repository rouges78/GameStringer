#pragma once

#include <string>
#include <functional>

namespace GSTranslator {

// Configurazione del traduttore
struct TranslatorConfig {
    std::wstring targetLanguage = L"it";      // Lingua destinazione
    std::wstring sourceLanguage = L"en";      // Lingua sorgente
    bool enabled = true;                       // Traduzione attiva
    bool cacheEnabled = true;                  // Cache locale attiva
    int maxCacheSize = 10000;                  // Max entries in cache
    std::wstring cachePath;                    // Path cache su disco
};

// Inizializza il sistema di traduzione
bool InitializeTranslator(const TranslatorConfig& config);

// Shutdown
void ShutdownTranslator();

// Traduce un testo
// Ritorna il testo tradotto, o il testo originale se non disponibile
std::wstring Translate(const std::wstring& originalText);

// Traduzione asincrona con callback
void TranslateAsync(const std::wstring& originalText, 
                    std::function<void(const std::wstring&)> callback);

// Verifica se un testo è già in cache
bool IsInCache(const std::wstring& text);

// Aggiunge manualmente una traduzione alla cache
void AddToCache(const std::wstring& original, const std::wstring& translated);

// Salva la cache su disco
bool SaveCache();

// Carica la cache da disco
bool LoadCache();

// Statistiche
struct TranslatorStats {
    uint64_t totalRequests = 0;
    uint64_t cacheHits = 0;
    uint64_t cacheMisses = 0;
    uint64_t translationErrors = 0;
    uint64_t averageLatencyMs = 0;
};

TranslatorStats GetStats();

// Callback per logging
using LogCallback = std::function<void(const char* level, const char* message)>;
void SetLogCallback(LogCallback callback);

} // namespace GSTranslator
