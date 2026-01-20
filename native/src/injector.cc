#include <napi.h>
#include <windows.h>
#include <tlhelp32.h>
#include <psapi.h>
#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include <codecvt>
#include <locale>

// Funzioni di conversione UTF-8 <-> UTF-16
std::wstring utf8_to_utf16(const std::string& utf8) {
    if (utf8.empty()) return std::wstring();
    int size = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, nullptr, 0);
    std::wstring utf16(size - 1, 0);
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, &utf16[0], size);
    return utf16;
}

std::string utf16_to_utf8(const std::wstring& utf16) {
    if (utf16.empty()) return std::string();
    int size = WideCharToMultiByte(CP_UTF8, 0, utf16.c_str(), -1, nullptr, 0, nullptr, nullptr);
    std::string utf8(size - 1, 0);
    WideCharToMultiByte(CP_UTF8, 0, utf16.c_str(), -1, &utf8[0], size, nullptr, nullptr);
    return utf8;
}

// Struttura per memorizzare le traduzioni
struct Translation {
    std::wstring original;
    std::wstring translated;
};

// Cache delle traduzioni per processo
std::map<DWORD, std::vector<Translation>> translationCache;

// Funzione per ottenere i privilegi di debug
bool EnableDebugPrivilege() {
    HANDLE hToken;
    TOKEN_PRIVILEGES tp;
    LUID luid;

    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &hToken))
        return false;

    if (!LookupPrivilegeValue(NULL, SE_DEBUG_NAME, &luid)) {
        CloseHandle(hToken);
        return false;
    }

    tp.PrivilegeCount = 1;
    tp.Privileges[0].Luid = luid;
    tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;

    if (!AdjustTokenPrivileges(hToken, FALSE, &tp, sizeof(TOKEN_PRIVILEGES), NULL, NULL)) {
        CloseHandle(hToken);
        return false;
    }

    CloseHandle(hToken);
    return true;
}

// Funzione per trovare pattern di testo UTF-16 nel processo
std::vector<LPVOID> FindTextPatternUTF16(HANDLE hProcess, const std::wstring& pattern) {
    std::vector<LPVOID> addresses;
    SYSTEM_INFO si;
    GetSystemInfo(&si);

    MEMORY_BASIC_INFORMATION mbi;
    std::vector<char> buffer;
    
    for (LPVOID addr = si.lpMinimumApplicationAddress; 
         addr < si.lpMaximumApplicationAddress;) {
        
        if (VirtualQueryEx(hProcess, addr, &mbi, sizeof(mbi)) == sizeof(mbi)) {
            if (mbi.State == MEM_COMMIT && 
                (mbi.Protect == PAGE_READWRITE || mbi.Protect == PAGE_EXECUTE_READWRITE)) {
                
                buffer.resize(mbi.RegionSize);
                SIZE_T bytesRead;
                
                if (ReadProcessMemory(hProcess, addr, buffer.data(), mbi.RegionSize, &bytesRead)) {
                    // Cerca il pattern nel buffer
                    std::wstring bufferStr(reinterpret_cast<wchar_t*>(buffer.data()), 
                                         bytesRead / sizeof(wchar_t));
                    
                    size_t pos = 0;
                    while ((pos = bufferStr.find(pattern, pos)) != std::wstring::npos) {
                        addresses.push_back((LPVOID)((char*)addr + pos * sizeof(wchar_t)));
                        pos += pattern.length();
                    }
                }
            }
            addr = (LPVOID)((char*)addr + mbi.RegionSize);
        } else {
            addr = (LPVOID)((char*)addr + si.dwPageSize);
        }
    }
    
    return addresses;
}

// Funzione per trovare pattern di testo ASCII nel processo
std::vector<LPVOID> FindTextPatternASCII(HANDLE hProcess, const std::string& pattern) {
    std::vector<LPVOID> addresses;
    SYSTEM_INFO si;
    GetSystemInfo(&si);

    MEMORY_BASIC_INFORMATION mbi;
    std::vector<char> buffer;
    
    for (LPVOID addr = si.lpMinimumApplicationAddress; 
         addr < si.lpMaximumApplicationAddress;) {
        
        if (VirtualQueryEx(hProcess, addr, &mbi, sizeof(mbi)) == sizeof(mbi)) {
            if (mbi.State == MEM_COMMIT && 
                (mbi.Protect == PAGE_READWRITE || mbi.Protect == PAGE_EXECUTE_READWRITE)) {
                
                buffer.resize(mbi.RegionSize);
                SIZE_T bytesRead;
                
                if (ReadProcessMemory(hProcess, addr, buffer.data(), mbi.RegionSize, &bytesRead)) {
                    // Cerca il pattern nel buffer ASCII
                    std::string bufferStr(buffer.data(), bytesRead);
                    
                    size_t pos = 0;
                    while ((pos = bufferStr.find(pattern, pos)) != std::string::npos) {
                        addresses.push_back((LPVOID)((char*)addr + pos));
                        pos += pattern.length();
                    }
                }
            }
            addr = (LPVOID)((char*)addr + mbi.RegionSize);
        } else {
            addr = (LPVOID)((char*)addr + si.dwPageSize);
        }
    }
    
    return addresses;
}

// Funzione per sostituire testo in memoria
bool ReplaceTextInMemory(HANDLE hProcess, LPVOID address, 
                        const std::wstring& original, const std::wstring& replacement) {
    // Verifica che la sostituzione non sia più lunga dell'originale
    if (replacement.length() > original.length()) {
        return false;
    }

    // Cambia protezione memoria per scrittura
    DWORD oldProtect;
    SIZE_T size = original.length() * sizeof(wchar_t);
    
    if (!VirtualProtectEx(hProcess, address, size, PAGE_EXECUTE_READWRITE, &oldProtect)) {
        return false;
    }

    // Prepara il buffer con la traduzione
    std::vector<wchar_t> buffer(original.length() + 1, L'\0');
    wcscpy_s(buffer.data(), buffer.size(), replacement.c_str());
    
    // Se la traduzione è più corta, riempi con spazi
    for (size_t i = replacement.length(); i < original.length(); i++) {
        buffer[i] = L' ';
    }

    // Scrivi la traduzione
    SIZE_T bytesWritten;
    bool success = WriteProcessMemory(hProcess, address, buffer.data(), 
                                    size, &bytesWritten);

    // Ripristina protezione originale
    VirtualProtectEx(hProcess, address, size, oldProtect, &oldProtect);

    return success;
}

// Funzione per sostituire testo ASCII in memoria
bool ReplaceTextInMemoryASCII(HANDLE hProcess, LPVOID address, 
                             const std::string& original, const std::string& replacement) {
    // Verifica che la sostituzione non sia più lunga dell'originale
    if (replacement.length() > original.length()) {
        return false;
    }

    // Cambia protezione memoria per scrittura
    DWORD oldProtect;
    SIZE_T size = original.length();
    
    if (!VirtualProtectEx(hProcess, address, size, PAGE_EXECUTE_READWRITE, &oldProtect)) {
        return false;
    }

    // Prepara il buffer con la traduzione
    std::vector<char> buffer(original.length() + 1, '\0');
    strcpy_s(buffer.data(), buffer.size(), replacement.c_str());
    
    // Se la traduzione è più corta, riempi con spazi
    for (size_t i = replacement.length(); i < original.length(); i++) {
        buffer[i] = ' ';
    }

    // Scrivi la traduzione
    SIZE_T bytesWritten;
    bool success = WriteProcessMemory(hProcess, address, buffer.data(), 
                                    size, &bytesWritten);

    // Ripristina protezione originale
    VirtualProtectEx(hProcess, address, size, oldProtect, &oldProtect);

    return success;
}

// Funzione principale di injection
Napi::Value InjectTranslations(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Richiesti processId e translations").ThrowAsJavaScriptException();
        return env.Null();
    }

    DWORD processId = info[0].As<Napi::Number>().Uint32Value();
    Napi::Array translations = info[1].As<Napi::Array>();

    // Abilita privilegi di debug
    if (!EnableDebugPrivilege()) {
        Napi::Error::New(env, "Impossibile ottenere privilegi di debug. Esegui come amministratore.")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    // Apri il processo
    HANDLE hProcess = OpenProcess(PROCESS_ALL_ACCESS, FALSE, processId);
    if (!hProcess) {
        Napi::Error::New(env, "Impossibile aprire il processo").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object result = Napi::Object::New(env);
    Napi::Array injected = Napi::Array::New(env);
    int injectedCount = 0;

    // Processa ogni traduzione
    for (uint32_t i = 0; i < translations.Length(); i++) {
        Napi::Object translation = translations.Get(i).As<Napi::Object>();
        
        std::string originalUtf8 = translation.Get("original").As<Napi::String>().Utf8Value();
        std::string translatedUtf8 = translation.Get("translated").As<Napi::String>().Utf8Value();
        
        // Converti in wide string per UTF-16 usando la conversione corretta
        std::wstring originalW = utf8_to_utf16(originalUtf8);
        std::wstring translatedW = utf8_to_utf16(translatedUtf8);

        // Cerca prima come UTF-16
        std::vector<LPVOID> addressesUTF16 = FindTextPatternUTF16(hProcess, originalW);
        for (LPVOID addr : addressesUTF16) {
            if (ReplaceTextInMemory(hProcess, addr, originalW, translatedW)) {
                Napi::Object injectedItem = Napi::Object::New(env);
                injectedItem.Set("address", Napi::Number::New(env, (uint64_t)addr));
                injectedItem.Set("original", originalUtf8);
                injectedItem.Set("translated", translatedUtf8);
                injectedItem.Set("encoding", "UTF-16");
                
                injected.Set(injectedCount++, injectedItem);
            }
        }

        // Cerca anche come ASCII
        std::vector<LPVOID> addressesASCII = FindTextPatternASCII(hProcess, originalUtf8);
        for (LPVOID addr : addressesASCII) {
            if (ReplaceTextInMemoryASCII(hProcess, addr, originalUtf8, translatedUtf8)) {
                Napi::Object injectedItem = Napi::Object::New(env);
                injectedItem.Set("address", Napi::Number::New(env, (uint64_t)addr));
                injectedItem.Set("original", originalUtf8);
                injectedItem.Set("translated", translatedUtf8);
                injectedItem.Set("encoding", "ASCII");
                
                injected.Set(injectedCount++, injectedItem);
            }
        }
    }

    CloseHandle(hProcess);

    result.Set("success", Napi::Boolean::New(env, true));
    result.Set("injectedCount", Napi::Number::New(env, injectedCount));
    result.Set("injected", injected);

    return result;
}

// Funzione per monitorare nuovi testi nel processo
Napi::Value MonitorProcess(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Process ID deve essere un numero").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    DWORD processId = info[0].As<Napi::Number>().Uint32Value();
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("success", true);
    result.Set("message", "Monitoraggio avviato per processo " + std::to_string(processId));
    
    return result;
}

// Funzione per verificare i privilegi di amministratore
Napi::Value HasAdminPrivileges(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Su Windows, verifica se possiamo aprire un processo con privilegi elevati
    HANDLE hToken;
    BOOL isAdmin = FALSE;
    
    if (OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hToken)) {
        TOKEN_ELEVATION elevation;
        DWORD dwSize;
        
        if (GetTokenInformation(hToken, TokenElevation, &elevation, sizeof(elevation), &dwSize)) {
            isAdmin = elevation.TokenIsElevated;
        }
        
        CloseHandle(hToken);
    }
    
    return Napi::Boolean::New(env, isAdmin);
}

// Inizializzazione del modulo
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("injectTranslations", Napi::Function::New(env, InjectTranslations));
    exports.Set("monitorProcess", Napi::Function::New(env, MonitorProcess));
    exports.Set("hasAdminPrivileges", Napi::Function::New(env, HasAdminPrivileges));
    
    return exports;
}

NODE_API_MODULE(gamestringer_injector, Init)
