#include "cache.h"
#include "utils.h"
#include <fstream>
#include <algorithm>

namespace GSTranslator {

// Singleton cache globale
static TranslationCache* g_globalCache = nullptr;

TranslationCache& GetGlobalCache() {
    if (!g_globalCache) {
        g_globalCache = new TranslationCache(10000);
    }
    return *g_globalCache;
}

TranslationCache::TranslationCache(size_t maxSize) 
    : m_maxSize(maxSize) {
}

TranslationCache::~TranslationCache() {
}

bool TranslationCache::Get(const std::wstring& original, std::wstring& translated) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    auto it = m_cache.find(original);
    if (it != m_cache.end()) {
        translated = it->second;
        m_hits++;
        return true;
    }
    
    m_misses++;
    return false;
}

void TranslationCache::Put(const std::wstring& original, const std::wstring& translated) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    // Evict se piena
    if (m_cache.size() >= m_maxSize) {
        EvictOldest();
    }
    
    m_cache[original] = translated;
}

bool TranslationCache::Contains(const std::wstring& original) {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_cache.find(original) != m_cache.end();
}

void TranslationCache::Remove(const std::wstring& original) {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_cache.erase(original);
}

void TranslationCache::Clear() {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_cache.clear();
}

size_t TranslationCache::Size() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_cache.size();
}

void TranslationCache::EvictOldest() {
    // Semplice: rimuove primo elemento (non vero LRU)
    // TODO: Implementare LRU reale con lista ordinata
    if (!m_cache.empty()) {
        m_cache.erase(m_cache.begin());
    }
}

bool TranslationCache::SaveToFile(const std::wstring& path) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    std::ofstream file(path, std::ios::binary);
    if (!file.is_open()) {
        Utils::LogError("Impossibile aprire file cache per scrittura: %ls", path.c_str());
        return false;
    }
    
    // Header
    uint32_t magic = 0x47535443; // "GSTC"
    uint32_t version = 1;
    uint32_t count = (uint32_t)m_cache.size();
    
    file.write(reinterpret_cast<char*>(&magic), sizeof(magic));
    file.write(reinterpret_cast<char*>(&version), sizeof(version));
    file.write(reinterpret_cast<char*>(&count), sizeof(count));
    
    // Entries
    for (const auto& pair : m_cache) {
        // Original
        uint32_t origLen = (uint32_t)pair.first.length();
        file.write(reinterpret_cast<char*>(&origLen), sizeof(origLen));
        file.write(reinterpret_cast<const char*>(pair.first.c_str()), origLen * sizeof(wchar_t));
        
        // Translated
        uint32_t transLen = (uint32_t)pair.second.length();
        file.write(reinterpret_cast<char*>(&transLen), sizeof(transLen));
        file.write(reinterpret_cast<const char*>(pair.second.c_str()), transLen * sizeof(wchar_t));
    }
    
    Utils::LogInfo("Cache salvata: %u entries", count);
    return true;
}

bool TranslationCache::LoadFromFile(const std::wstring& path) {
    std::lock_guard<std::mutex> lock(m_mutex);
    
    std::ifstream file(path, std::ios::binary);
    if (!file.is_open()) {
        return false; // File non esiste, ok
    }
    
    // Header
    uint32_t magic, version, count;
    file.read(reinterpret_cast<char*>(&magic), sizeof(magic));
    file.read(reinterpret_cast<char*>(&version), sizeof(version));
    file.read(reinterpret_cast<char*>(&count), sizeof(count));
    
    if (magic != 0x47535443 || version != 1) {
        Utils::LogWarning("File cache non valido o versione incompatibile");
        return false;
    }
    
    m_cache.clear();
    
    // Entries
    for (uint32_t i = 0; i < count && file.good(); i++) {
        uint32_t origLen, transLen;
        
        file.read(reinterpret_cast<char*>(&origLen), sizeof(origLen));
        std::wstring original(origLen, L'\0');
        file.read(reinterpret_cast<char*>(&original[0]), origLen * sizeof(wchar_t));
        
        file.read(reinterpret_cast<char*>(&transLen), sizeof(transLen));
        std::wstring translated(transLen, L'\0');
        file.read(reinterpret_cast<char*>(&translated[0]), transLen * sizeof(wchar_t));
        
        if (file.good()) {
            m_cache[original] = translated;
        }
    }
    
    Utils::LogInfo("Cache caricata: %zu entries", m_cache.size());
    return true;
}

} // namespace GSTranslator
