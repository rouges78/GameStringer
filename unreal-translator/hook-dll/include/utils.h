#pragma once

#include <string>
#include <Windows.h>

namespace GSTranslator {
namespace Utils {

// Conversione stringhe
std::wstring Utf8ToWide(const std::string& utf8);
std::string WideToUtf8(const std::wstring& wide);

// Pattern scanning
uintptr_t PatternScan(HMODULE module, const char* signature);
uintptr_t PatternScanEx(uintptr_t start, size_t size, const char* signature);

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
