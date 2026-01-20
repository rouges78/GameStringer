# GameStringer Unreal Engine Translator

Sistema di traduzione runtime per giochi Unreal Engine 4/5.

## Architettura

```
unreal-translator/
├── hook-dll/           # DLL C++ che hooka le funzioni UE
├── injector/           # Rust code per iniettare la DLL
└── bridge/             # Comunicazione con GameStringer
```

## Come Funziona

1. **Injection**: GameStringer inietta `gs_translator.dll` nel processo del gioco
2. **Hooking**: La DLL intercetta le funzioni di rendering testo di UE
3. **Translation**: I testi vengono inviati a GameStringer per traduzione
4. **Caching**: Le traduzioni vengono salvate localmente per riuso

## Funzioni UE Hookate

### UE4/UE5 Text Rendering
- `FText::ToString()` - Conversione FText a stringa
- `UTextBlock::SetText()` - Widget UI testo
- `STextBlock::SetText()` - Slate widget testo
- `UUserWidget::GetText()` - Widget Blueprint

## Build Requirements

- Visual Studio 2022 con C++ Desktop Development
- Windows SDK 10.0
- CMake 3.20+

## Stato Sviluppo

- [ ] Struttura progetto C++
- [ ] Hook base funzioni UE
- [ ] Comunicazione IPC con GameStringer
- [ ] Cache traduzioni locale
- [ ] Integrazione UI GameStringer
