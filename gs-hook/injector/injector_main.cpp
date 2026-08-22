// gs-injector — helper di injection per-architettura per gs-hook.
//
// Uso:  gs-injector.exe <pid> <percorso-dll>
//
// È volutamente "stupido": NON contiene logica anti-cheat. Il gate
// (assert_injection_allowed) è applicato a monte nel backend Rust di
// GameStringer, che è l'UNICO punto autorizzato a lanciare questo exe.
//
// Esiste solo per eseguire la LoadLibraryW remota *nella stessa architettura*
// del processo target: compilato sia Win32 sia x64, il backend sceglie l'exe
// che combacia col bitness del target. Così l'indirizzo di LoadLibraryW del
// nostro kernel32 è valido anche nel target (risolve il caso x64→x86 senza
// dover fare WoW64 PE-parsing nel backend).
//
// Exit codes:
//   0  ok (DLL caricata)
//   1  argomenti errati
//   2  OpenProcess fallita
//   3  VirtualAllocEx fallita
//   4  WriteProcessMemory fallita
//   5  GetProcAddress(LoadLibraryW) fallita
//   6  CreateRemoteThread fallita
//   7  thread remoto ok ma LoadLibraryW ha ritornato modulo nullo
//   8  thread remoto non terminato entro il timeout (esito ignoto)

#include <Windows.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cwchar>  // std::fwprintf, std::wprintf, std::wcslen (I/O e string wide)

int wmain(int argc, wchar_t* argv[]) {
    if (argc < 3) {
        std::fwprintf(stderr, L"uso: gs-injector.exe <pid> <percorso-dll>\n");
        return 1;
    }

    DWORD pid = static_cast<DWORD>(_wtoi(argv[1]));
    const wchar_t* dllPath = argv[2];

    // Numero di byte (incluso il terminatore) da copiare nel processo remoto.
    SIZE_T pathBytes = (std::wcslen(dllPath) + 1) * sizeof(wchar_t);

    HANDLE proc = OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);
    if (!proc) {
        std::fwprintf(stderr, L"OpenProcess fallita (err=%lu)\n", GetLastError());
        return 2;
    }

    LPVOID remote = VirtualAllocEx(proc, nullptr, pathBytes,
                                   MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!remote) {
        std::fwprintf(stderr, L"VirtualAllocEx fallita (err=%lu)\n", GetLastError());
        CloseHandle(proc);
        return 3;
    }

    if (!WriteProcessMemory(proc, remote, dllPath, pathBytes, nullptr)) {
        std::fwprintf(stderr, L"WriteProcessMemory fallita (err=%lu)\n", GetLastError());
        VirtualFreeEx(proc, remote, 0, MEM_RELEASE);
        CloseHandle(proc);
        return 4;
    }

    // LoadLibraryW dal NOSTRO kernel32: valido nel target perché stessa arch.
    HMODULE k32 = GetModuleHandleW(L"kernel32.dll");
    FARPROC loadLib = GetProcAddress(k32, "LoadLibraryW");
    if (!loadLib) {
        std::fwprintf(stderr, L"GetProcAddress(LoadLibraryW) fallita\n");
        VirtualFreeEx(proc, remote, 0, MEM_RELEASE);
        CloseHandle(proc);
        return 5;
    }

    HANDLE thread = CreateRemoteThread(
        proc, nullptr, 0,
        reinterpret_cast<LPTHREAD_START_ROUTINE>(loadLib),
        remote, 0, nullptr);
    if (!thread) {
        std::fwprintf(stderr, L"CreateRemoteThread fallita (err=%lu)\n", GetLastError());
        VirtualFreeEx(proc, remote, 0, MEM_RELEASE);
        CloseHandle(proc);
        return 6;
    }

    constexpr DWORD kRemoteThreadTimeoutMs = 15000;
    DWORD waited = WaitForSingleObject(thread, kRemoteThreadTimeoutMs);

    // Se il thread NON è terminato, non abbiamo un esito: leggere qui l'exit
    // code darebbe STILL_ACTIVE (259), che essendo diverso da zero passerebbe
    // per un HMODULE valido e stamperebbe «DLL caricata» su un'iniezione che
    // non è mai finita. È il caso che questo ramo esiste per intercettare.
    //
    // E soprattutto NON si libera la memoria remota: il thread è ancora dentro
    // LoadLibraryW e sta leggendo proprio quella stringa. Liberarla sarebbe una
    // use-after-free NEL PROCESSO DEL GIOCO, cioè un crash causato da noi
    // mentre segnaliamo un errore. Meglio perdere pathBytes byte (poche
    // centinaia) in un processo che sta comunque per essere diagnosticato.
    if (waited != WAIT_OBJECT_0) {
        if (waited == WAIT_TIMEOUT) {
            std::fwprintf(stderr,
                          L"thread remoto ancora in esecuzione dopo %lu ms: "
                          L"esito ignoto, la DLL potrebbe non essere caricata\n",
                          kRemoteThreadTimeoutMs);
        } else {
            std::fwprintf(stderr, L"attesa del thread remoto fallita (err=%lu)\n",
                          GetLastError());
        }
        CloseHandle(thread);
        CloseHandle(proc);
        return 8;
    }

    // Exit code del thread = valore di ritorno di LoadLibraryW troncato a 32 bit.
    // 0 ⇒ LoadLibraryW ha fallito (DLL non caricata). Su x64 l'HMODULE è a 64
    // bit e qui se ne vedono i 32 bit bassi: collisione con 0 teoricamente
    // possibile ma trascurabile per lo spike.
    DWORD remoteModule = 0;
    GetExitCodeThread(thread, &remoteModule);

    CloseHandle(thread);
    VirtualFreeEx(proc, remote, 0, MEM_RELEASE);
    CloseHandle(proc);

    if (remoteModule == 0) {
        std::fwprintf(stderr, L"LoadLibraryW remota ha ritornato NULL (DLL non caricata)\n");
        return 7;
    }

    std::wprintf(L"gs-injector: gs-hook.dll caricata in PID %lu\n", pid);
    return 0;
}
