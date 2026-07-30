#pragma once

#include <string>
#include <Windows.h>

namespace GSTranslator {
namespace Utils {

// Conversione stringhe
std::wstring Utf8ToWide(const std::string& utf8);
std::string WideToUtf8(const std::wstring& wide);

// Pattern scanning
//
// ⚠️ PatternScan/PatternScanEx ritornano il PRIMO match e non dicono quanti ne
// esistono. Per decidere DOVE INSTALLARE UN HOOK non basta: un pattern che
// compare 100 volte in un binario fa agganciare una funzione a caso, con una
// firma sbagliata → crash o corruzione heap silenziosa. Misurato il 30/07/2026
// su 5 giochi UE reali: il pattern UE4.27 in uso faceva 89-127 match.
// Per gli hook usare PatternScanUnique, che ritorna un indirizzo SOLO se il
// match è unico e riporta il conteggio per la diagnostica.
uintptr_t PatternScan(HMODULE module, const char* signature);
uintptr_t PatternScanEx(uintptr_t start, size_t size, const char* signature);

/// Oltre questo numero di match il conteggio si ferma: al chiamante serve
/// distinguere "uno" da "più di uno", non conoscere il totale esatto.
constexpr size_t PATTERN_SCAN_COUNT_CAP = 64;

/// Ritorna l'indirizzo SOLO se il pattern compare esattamente una volta nelle
/// SEZIONI ESEGUIBILI del modulo (non su tutta l'immagine: le pagine non
/// leggibili dei giochi protetti farebbero saltare una access violation).
/// `outCount` (opzionale) riceve il numero di match, saturato a
/// PATTERN_SCAN_COUNT_CAP: 0 = mai trovato, 1 = candidato unico, >1 = firma
/// troppo generica, da rifiutare. Se è pari al cap, il totale vero può essere
/// più alto — vale come "molti", non come misura.
uintptr_t PatternScanUnique(HMODULE module, const char* signature, size_t* outCount);
uintptr_t PatternScanUniqueEx(uintptr_t start, size_t size, const char* signature,
                              size_t* outCount);

// Memory utilities
bool IsValidPointer(void* ptr);
bool IsExecutableMemory(void* ptr);

// Module info
HMODULE GetGameModule();
std::wstring GetModulePath(HMODULE module);
std::wstring GetGameDirectory();

// Logging
void Log(const char* level, const char* format, ...);
void LogDebug(const char* format, ...);
void LogInfo(const char* format, ...);
void LogWarning(const char* format, ...);
void LogError(const char* format, ...);

// File utilities
bool FileExists(const std::wstring& path);
bool CreateDirectoryRecursive(const std::wstring& path);
std::wstring GetDllDirectory();

// Hash per cache key
uint64_t HashString(const std::wstring& str);

// Timing
uint64_t GetTimestampMs();

} // namespace Utils
} // namespace GSTranslator
