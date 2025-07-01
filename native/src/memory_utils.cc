#include <napi.h>
#include <windows.h>
#include <vector>
#include <string>

// Struttura per pattern di ricerca
struct SearchPattern {
    std::vector<uint8_t> pattern;
    std::string mask;
};

// Cerca un pattern di byte nella memoria
bool ComparePattern(const uint8_t* data, const uint8_t* pattern, const char* mask) {
    for (; *mask; ++mask, ++data, ++pattern) {
        if (*mask == 'x' && *data != *pattern) {
            return false;
        }
    }
    return true;
}

// Scansiona la memoria per trovare pattern
Napi::Value ScanMemory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Richiesti processId, pattern e mask").ThrowAsJavaScriptException();
        return env.Null();
    }

    DWORD processId = info[0].As<Napi::Number>().Uint32Value();
    Napi::Array patternArray = info[1].As<Napi::Array>();
    std::string mask = info[2].As<Napi::String>().Utf8Value();

    // Converti pattern array in vector
    std::vector<uint8_t> pattern;
    for (uint32_t i = 0; i < patternArray.Length(); i++) {
        pattern.push_back(patternArray.Get(i).As<Napi::Number>().Uint32Value());
    }

    HANDLE hProcess = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, FALSE, processId);
    if (!hProcess) {
        return Napi::Array::New(env);
    }

    Napi::Array results = Napi::Array::New(env);
    int resultCount = 0;

    SYSTEM_INFO si;
    GetSystemInfo(&si);

    MEMORY_BASIC_INFORMATION mbi;
    std::vector<uint8_t> buffer;

    for (LPVOID addr = si.lpMinimumApplicationAddress; 
         addr < si.lpMaximumApplicationAddress;) {
        
        if (VirtualQueryEx(hProcess, addr, &mbi, sizeof(mbi)) == sizeof(mbi)) {
            if (mbi.State == MEM_COMMIT && 
                (mbi.Protect & (PAGE_READWRITE | PAGE_EXECUTE_READWRITE | PAGE_EXECUTE_READ | PAGE_READONLY))) {
                
                buffer.resize(mbi.RegionSize);
                SIZE_T bytesRead;
                
                if (ReadProcessMemory(hProcess, addr, buffer.data(), mbi.RegionSize, &bytesRead)) {
                    for (size_t i = 0; i <= bytesRead - pattern.size(); i++) {
                        if (ComparePattern(&buffer[i], pattern.data(), mask.c_str())) {
                            Napi::Object result = Napi::Object::New(env);
                            result.Set("address", Napi::Number::New(env, (uint64_t)addr + i));
                            result.Set("region", Napi::Number::New(env, (uint64_t)addr));
                            result.Set("size", Napi::Number::New(env, mbi.RegionSize));
                            
                            results.Set(resultCount++, result);
                        }
                    }
                }
            }
            addr = (LPVOID)((char*)addr + mbi.RegionSize);
        } else {
            addr = (LPVOID)((char*)addr + si.dwPageSize);
        }
    }

    CloseHandle(hProcess);
    return results;
}

// Legge memoria da un indirizzo specifico
Napi::Value ReadMemory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Richiesti processId, address e size").ThrowAsJavaScriptException();
        return env.Null();
    }

    DWORD processId = info[0].As<Napi::Number>().Uint32Value();
    uint64_t address = info[1].As<Napi::Number>().Int64Value();
    SIZE_T size = info[2].As<Napi::Number>().Uint32Value();

    HANDLE hProcess = OpenProcess(PROCESS_VM_READ, FALSE, processId);
    if (!hProcess) {
        return env.Null();
    }

    std::vector<uint8_t> buffer(size);
    SIZE_T bytesRead;

    if (ReadProcessMemory(hProcess, (LPVOID)address, buffer.data(), size, &bytesRead)) {
        Napi::Buffer<uint8_t> result = Napi::Buffer<uint8_t>::Copy(env, buffer.data(), bytesRead);
        CloseHandle(hProcess);
        return result;
    }

    CloseHandle(hProcess);
    return env.Null();
}

// Scrive memoria a un indirizzo specifico
Napi::Value WriteMemory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Richiesti processId, address e data").ThrowAsJavaScriptException();
        return env.Null();
    }

    DWORD processId = info[0].As<Napi::Number>().Uint32Value();
    uint64_t address = info[1].As<Napi::Number>().Int64Value();
    Napi::Buffer<uint8_t> data = info[2].As<Napi::Buffer<uint8_t>>();

    HANDLE hProcess = OpenProcess(PROCESS_VM_WRITE | PROCESS_VM_OPERATION, FALSE, processId);
    if (!hProcess) {
        return Napi::Boolean::New(env, false);
    }

    DWORD oldProtect;
    if (!VirtualProtectEx(hProcess, (LPVOID)address, data.Length(), PAGE_EXECUTE_READWRITE, &oldProtect)) {
        CloseHandle(hProcess);
        return Napi::Boolean::New(env, false);
    }

    SIZE_T bytesWritten;
    bool success = WriteProcessMemory(hProcess, (LPVOID)address, data.Data(), data.Length(), &bytesWritten);

    VirtualProtectEx(hProcess, (LPVOID)address, data.Length(), oldProtect, &oldProtect);
    CloseHandle(hProcess);

    return Napi::Boolean::New(env, success);
}

// Esporta le funzioni
void InitMemoryUtils(Napi::Env env, Napi::Object exports) {
    exports.Set("scanMemory", Napi::Function::New(env, ScanMemory));
    exports.Set("readMemory", Napi::Function::New(env, ReadMemory));
    exports.Set("writeMemory", Napi::Function::New(env, WriteMemory));
}
