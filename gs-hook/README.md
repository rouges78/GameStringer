# gs-hook — Universal Text Interception Framework (UTIF)

DLL unica iniettabile che unifica le DLL storiche (`unity-translator-dll`,
`ue-translator-dll`, `unreal-translator`) in un'architettura a **plugin di
sorgenti di testo**, con degradazione automatica L1 → L2 → L3.

> `ue-translator-dll/` è stata **cancellata il 31/07/2026**: i suoi hook non si
> installavano mai (`FindUEFunctions()` ritornava `true` senza assegnare gli
> indirizzi) e dichiarava comunque successo. L'hook Unreal vivo è qui, in
> `src/sources/source_unreal_ftext.cpp`.

> Stato: **scaffold iniziale.** Compila come scheletro; le sorgenti L1 sono
> portate dagli hook esistenti, la sorgente L2 (GDI) è il bersaglio dello spike,
> L3 (OCR-fusion) è ancora da scrivere. Non è ancora un prodotto: è la base
> estensibile su cui costruire.

## Perché esiste

Invece di una DLL per engine, una sola DLL con un registry. Aggiungere il
supporto a un nuovo engine = scrivere una classe `ITextSource` e una riga
`GS_REGISTER_SOURCE(...)`. Niente altro da toccare.

## I tre livelli

| Livello | Sorgenti | Quando | Risultato |
|---|---|---|---|
| **L1 Engine** | Unity/Mono, Unity/IL2CPP*, Unreal/FText | l'engine è riconosciuto | preciso, veloce |
| **L2 Rasterization** | GDI, DirectWrite*, FreeType* | engine ignoto ma usa API di testo OS | universale |
| **L3 OcrFusion*** | swapchain timing + OCR | AAA con glyph-atlas GPU | pavimento, mai "nessuna traduzione" |

`*` = da implementare. L'orchestratore (`dllmain.cpp`) attiva il livello più
alto disponibile e non scende oltre.

## Struttura

```
gs-hook/
├─ include/text_source.h      ← interfaccia ITextSource + registry (il cuore)
├─ src/
│  ├─ dllmain.cpp             ← orchestratore: detect + activate a cascata
│  ├─ registry.cpp            ← registry auto-registrante
│  └─ sources/
│     ├─ source_unity_mono.cpp    ← L1, hook mono_string_new (portato)
│     ├─ source_unreal_ftext.cpp  ← L1, hook FText::ToString (porting da finire)
│     └─ source_gdi.cpp           ← L2, hook GDI + COALESCER ⭐ (spike)
├─ CMakeLists.txt             ← riusa core (cache/ipc/translator) e MinHook esistenti
└─ README.md
```

Il **core generico** (cache, IPC named-pipe, translator) NON è riscritto: è già
engine-agnostico in `../unreal-translator/hook-dll/` e viene riusato dal CMake.

## Come aggiungere una sorgente (esempio)

```cpp
#include "text_source.h"
namespace gs { namespace {
class MyEngineSource : public ITextSource {
public:
    const char* Name() const override { return "MyEngine"; }
    Level GetLevel() const override { return Level::Engine; }
    bool IsApplicable() const override { return GetModuleHandleA("myengine.dll"); }
    Activation Activate(TranslateFn translate) override { /* hook... */ }
    void Deactivate() override { /* unhook... */ }
};
}}
GS_REGISTER_SOURCE(gs::MyEngineSource);
```

Aggiungi il file a `GS_HOOK_SOURCES` in `CMakeLists.txt`. Fine.

## Build (Windows, MSVC)

```bat
cd gs-hook
cmake -B build -A x64
cmake --build build --config Release
:: output: build\bin\gs-hook.dll
```
(Per giochi a 32 bit: `-A Win32`. Serve una DLL per architettura.)

## Lo spike GDI — il go/no-go dell'idea #1 ⭐

`source_gdi.cpp` parte in **modalità log-only** (`kSpikeLogOnly = true`): NON
modifica il gioco, logga solo le frasi che il coalescer ricostruisce, su
`OutputDebugString` (visibile con DebugView di Sysinternals).

Procedura dello spike:
1. builda `gs-hook.dll`;
2. iniettala in un gioco **GDI semplice, single-player** (usa l'injector già
   presente in `src-tauri/.../unity_injector.rs`, generalizzato);
3. apri **DebugView** e gioca qualche minuto;
4. guarda le righe `[gs-hook/GDI] FRASE: ...`.

**Domanda a cui rispondere:** le frasi ricostruite sono pulite e complete, o
spezzate/sporche? I parametri da tarare sono in `LineCoalescer`
(`kYTolerancePx`, `kXGapPx`, `kMaxGapMs`).

- Frasi pulite → idea #1 **confermata**: si passa alla sostituzione in-place.
- Frasi irrecuperabili → ripiego su L1 (per-engine) + L3 (OCR), comunque un
  ottimo prodotto, **senza aver speso mesi**.

## Sicurezza (P0, non opzionale)

L'injection ha la firma di un cheat. Prima di iniettare, l'app DEVE:
- **bloccare** i giochi con anti-cheat kernel (EAC/BattlEye/VAC) — riusa la
  detection in `src-tauri/src/commands/anti_cheat.rs`;
- consentire solo single-player/offline;
- avvisare l'utente. Mai iniettare in multiplayer competitivo.

## Prossimi passi

1. Finire il porting del pattern-scan in `source_unreal_ftext.cpp` (logica già
   in `../unreal-translator/hook-dll/src/hooks.cpp`).
2. `source_unity_il2cpp.cpp` (giochi Unity moderni).
3. Eseguire lo spike GDI e tarare il coalescer.
4. `source_directwrite.cpp` + `source_freetype.cpp` (allargano L2).
5. L3 OCR-fusion: hook `IDXGISwapChain::Present` solo per timing/region → OCR.
6. Spostare il core in `gs-hook/core/` come fonte di verità unica.
