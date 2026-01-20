# UE AutoTranslator DLL

DLL per traduzione runtime di giochi Unreal Engine 4/5.

## Requisiti

- Visual Studio 2019/2022 con supporto C++
- CMake 3.15+
- MinHook (incluso come submodule)

## Compilazione

### 1. Scarica MinHook

```bash
mkdir external
cd external
git clone https://github.com/TsudaKageyu/minhook.git
```

### 2. Configura con CMake

```bash
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
```

### 3. Compila

```bash
cmake --build . --config Release
```

La DLL verrà copiata automaticamente in `src-tauri/resources/ue-translator/`.

## Come Funziona

1. **Injection**: GameStringer inietta la DLL nel processo del gioco UE
2. **Hook**: La DLL aggancia le funzioni `FText::FromString` e `UTextBlock::SetText`
3. **IPC**: Comunica con GameStringer via Named Pipes per tradurre
4. **Cache**: Mantiene cache locale per performance

## Struttura

```
ue-translator-dll/
├── src/
│   ├── main.cpp       # Entry point e logica principale
│   ├── ipc_client.h   # Client per comunicazione IPC
│   └── text_hooks.h   # Hook funzioni UE
├── external/
│   └── minhook/       # Libreria MinHook
└── CMakeLists.txt
```

## Note Importanti

- **Anti-cheat**: Non usare su giochi con EasyAntiCheat o BattlEye
- **Pattern scanning**: I pattern per trovare le funzioni UE possono variare tra versioni
- **Testing**: Testare sempre su giochi offline prima

## Debug

Per vedere i log della DLL, usa DebugView di Sysinternals:
1. Scarica DebugView da Microsoft
2. Avvia come amministratore
3. Avvia il gioco con la DLL iniettata
4. I messaggi `[UE-Translator]` appariranno in DebugView
