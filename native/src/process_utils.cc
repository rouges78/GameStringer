#include <napi.h>
#include <windows.h>
#include <tlhelp32.h>
#include <psapi.h>
#include <string>
#include <vector>

// Ottiene la lista dei moduli caricati da un processo
Napi::Value GetProcessModules(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Richiesto processId").ThrowAsJavaScriptException();
        return env.Null();
    }

    DWORD processId = info[0].As<Napi::Number>().Uint32Value();
    
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, processId);
    if (!hProcess) {
        return Napi::Array::New(env);
    }

    Napi::Array modules = Napi::Array::New(env);
    HMODULE hMods[1024];
    DWORD cbNeeded;
    
    if (EnumProcessModules(hProcess, hMods, sizeof(hMods), &cbNeeded)) {
        int moduleCount = 0;
        for (unsigned int i = 0; i < (cbNeeded / sizeof(HMODULE)); i++) {
            TCHAR szModName[MAX_PATH];
            
            if (GetModuleFileNameEx(hProcess, hMods[i], szModName, sizeof(szModName) / sizeof(TCHAR))) {
                Napi::Object module = Napi::Object::New(env);
                module.Set("name", Napi::String::New(env, szModName));
                module.Set("base", Napi::Number::New(env, (uint64_t)hMods[i]));
                
                MODULEINFO modInfo;
                if (GetModuleInformation(hProcess, hMods[i], &modInfo, sizeof(modInfo))) {
                    module.Set("size", Napi::Number::New(env, modInfo.SizeOfImage));
                }
                
                modules.Set(moduleCount++, module);
            }
        }
    }
    
    CloseHandle(hProcess);
    return modules;
}

// Verifica se un processo è a 64 bit
Napi::Value IsProcess64Bit(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Richiesto processId").ThrowAsJavaScriptException();
        return env.Null();
    }

    DWORD processId = info[0].As<Napi::Number>().Uint32Value();
    
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, processId);
    if (!hProcess) {
        return Napi::Boolean::New(env, false);
    }

    BOOL isWow64 = FALSE;
    IsWow64Process(hProcess, &isWow64);
    
    CloseHandle(hProcess);
    
    // Se siamo su sistema a 64 bit e il processo NON è WOW64, allora è 64 bit
    SYSTEM_INFO si;
    GetNativeSystemInfo(&si);
    
    bool is64Bit = (si.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64) && !isWow64;
    
    return Napi::Boolean::New(env, is64Bit);
}

// Esporta le funzioni
void InitProcessUtils(Napi::Env env, Napi::Object exports) {
    exports.Set("getProcessModules", Napi::Function::New(env, GetProcessModules));
    exports.Set("isProcess64Bit", Napi::Function::New(env, IsProcess64Bit));
}
