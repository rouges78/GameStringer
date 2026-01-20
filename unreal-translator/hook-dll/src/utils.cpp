#include "utils.h"
#include <cstdarg>
#include <cstdio>
#include <Psapi.h>

namespace GSTranslator {
namespace Utils {

std::wstring Utf8ToWide(const std::string& utf8) {
    if (utf8.empty()) return L"";
    
    int size = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, nullptr, 0);
    if (size <= 0) return L"";
    
    std::wstring result(size - 1, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, &result[0], size);
    
    return result;
}

std::string WideToUtf8(const std::wstring& wide) {
    if (wide.empty()) return "";
    
    int size = WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), -1, nullptr, 0, nullptr, nullptr);
    if (size <= 0) return "";
    
    std::string result(size - 1, '\0');
    WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), -1, &result[0], size, nullptr, nullptr);
    
    return result;
}

// Pattern scanning implementation
uintptr_t PatternScan(HMODULE module, const char* signature) {
    if (!module) return 0;
    
    MODULEINFO modInfo;
    if (!GetModuleInformation(GetCurrentProcess(), module, &modInfo, sizeof(modInfo))) {
        return 0;
    }
    
    return PatternScanEx((uintptr_t)modInfo.lpBaseOfDll, modInfo.SizeOfImage, signature);
}

uintptr_t PatternScanEx(uintptr_t start, size_t size, const char* signature) {
    // Parse signature
    std::vector<int> pattern;
    const char* sig = signature;
    
    while (*sig) {
        if (*sig == ' ') {
            sig++;
            continue;
        }
        
        if (*sig == '?') {
            pattern.push_back(-1); // Wildcard
            sig += (sig[1] == '?') ? 2 : 1;
        } else {
            char byte[3] = { sig[0], sig[1], 0 };
            pattern.push_back((int)strtol(byte, nullptr, 16));
            sig += 2;
        }
    }
    
    if (pattern.empty()) return 0;
    
    // Scan memory
    uint8_t* data = (uint8_t*)start;
    size_t patternSize = pattern.size();
    
    for (size_t i = 0; i < size - patternSize; i++) {
        bool found = true;
        
        for (size_t j = 0; j < patternSize; j++) {
            if (pattern[j] != -1 && data[i + j] != (uint8_t)pattern[j]) {
                found = false;
                break;
            }
        }
        
        if (found) {
            return start + i;
        }
    }
    
    return 0;
}

bool IsValidPointer(void* ptr) {
    if (!ptr) return false;
    
    MEMORY_BASIC_INFORMATION mbi;
    if (VirtualQuery(ptr, &mbi, sizeof(mbi)) == 0) {
        return false;
    }
    
    return (mbi.State == MEM_COMMIT) && 
           (mbi.Protect & (PAGE_READONLY | PAGE_READWRITE | PAGE_EXECUTE_READ | PAGE_EXECUTE_READWRITE));
}

bool IsExecutableMemory(void* ptr) {
    if (!ptr) return false;
    
    MEMORY_BASIC_INFORMATION mbi;
    if (VirtualQuery(ptr, &mbi, sizeof(mbi)) == 0) {
        return false;
    }
    
    return (mbi.State == MEM_COMMIT) && 
           (mbi.Protect & (PAGE_EXECUTE | PAGE_EXECUTE_READ | PAGE_EXECUTE_READWRITE));
}

HMODULE GetGameModule() {
    return GetModuleHandleA(nullptr);
}

std::wstring GetModulePath(HMODULE module) {
    wchar_t path[MAX_PATH];
    GetModuleFileNameW(module, path, MAX_PATH);
    return path;
}

std::wstring GetGameDirectory() {
    std::wstring path = GetModulePath(GetGameModule());
    size_t pos = path.find_last_of(L"\\/");
    if (pos != std::wstring::npos) {
        return path.substr(0, pos);
    }
    return path;
}

std::wstring GetDllDirectory() {
    extern HMODULE g_hModule;
    std::wstring path = GetModulePath(g_hModule);
    size_t pos = path.find_last_of(L"\\/");
    if (pos != std::wstring::npos) {
        return path.substr(0, pos);
    }
    return path;
}

// Logging
static FILE* g_logFile = nullptr;

void Log(const char* level, const char* format, ...) {
    char buffer[4096];
    
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    
    // Console output
    printf("[GST][%s] %s\n", level, buffer);
    
    // File output
    if (!g_logFile) {
        std::wstring logPath = GetDllDirectory() + L"\\gs_translator.log";
        g_logFile = _wfopen(logPath.c_str(), L"a");
    }
    
    if (g_logFile) {
        fprintf(g_logFile, "[%s] %s\n", level, buffer);
        fflush(g_logFile);
    }
}

void LogDebug(const char* format, ...) {
    char buffer[4096];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    Log("DEBUG", "%s", buffer);
}

void LogInfo(const char* format, ...) {
    char buffer[4096];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    Log("INFO", "%s", buffer);
}

void LogWarning(const char* format, ...) {
    char buffer[4096];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    Log("WARN", "%s", buffer);
}

void LogError(const char* format, ...) {
    char buffer[4096];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    Log("ERROR", "%s", buffer);
}

bool FileExists(const std::wstring& path) {
    DWORD attrs = GetFileAttributesW(path.c_str());
    return (attrs != INVALID_FILE_ATTRIBUTES) && !(attrs & FILE_ATTRIBUTE_DIRECTORY);
}

bool CreateDirectoryRecursive(const std::wstring& path) {
    size_t pos = 0;
    while ((pos = path.find_first_of(L"\\/", pos + 1)) != std::wstring::npos) {
        CreateDirectoryW(path.substr(0, pos).c_str(), nullptr);
    }
    return CreateDirectoryW(path.c_str(), nullptr) || GetLastError() == ERROR_ALREADY_EXISTS;
}

uint64_t HashString(const std::wstring& str) {
    // FNV-1a hash
    uint64_t hash = 14695981039346656037ULL;
    for (wchar_t c : str) {
        hash ^= (uint64_t)c;
        hash *= 1099511628211ULL;
    }
    return hash;
}

uint64_t GetTimestampMs() {
    FILETIME ft;
    GetSystemTimeAsFileTime(&ft);
    ULARGE_INTEGER uli;
    uli.LowPart = ft.dwLowDateTime;
    uli.HighPart = ft.dwHighDateTime;
    return uli.QuadPart / 10000; // 100ns -> ms
}

} // namespace Utils
} // namespace GSTranslator
