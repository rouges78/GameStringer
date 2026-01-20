#pragma once

#include <string>
#include <unordered_map>
#include <mutex>

namespace GSTranslator {

class TranslationCache {
public:
    TranslationCache(size_t maxSize = 10000);
    ~TranslationCache();
    
    // Cerca traduzione in cache
    bool Get(const std::wstring& original, std::wstring& translated);
    
    // Aggiunge traduzione
    void Put(const std::wstring& original, const std::wstring& translated);
    
    // Verifica esistenza
    bool Contains(const std::wstring& original);
    
    // Rimuove entry
    void Remove(const std::wstring& original);
    
    // Pulisce tutta la cache
    void Clear();
    
    // Numero di entries
    size_t Size() const;
    
    // Salva su file
    bool SaveToFile(const std::wstring& path);
    
    // Carica da file
    bool LoadFromFile(const std::wstring& path);
    
    // Statistiche
    uint64_t GetHits() const { return m_hits; }
    uint64_t GetMisses() const { return m_misses; }
    
private:
    std::unordered_map<std::wstring, std::wstring> m_cache;
    mutable std::mutex m_mutex;
    size_t m_maxSize;
    uint64_t m_hits = 0;
    uint64_t m_misses = 0;
    
    // LRU eviction quando piena
    void EvictOldest();
};

// Cache globale singleton
TranslationCache& GetGlobalCache();

} // namespace GSTranslator
