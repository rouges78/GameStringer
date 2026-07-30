#pragma once

#include <string>
#include <cstdint>

namespace UE {

// Forward declarations per tipi Unreal Engine
// Questi sono placeholder - i tipi reali variano per versione UE

// FString - Stringa dinamica UE
struct FString {
    wchar_t* Data;
    int32_t ArrayNum;
    int32_t ArrayMax;
    
    const wchar_t* c_str() const { return Data ? Data : L""; }
    int32_t Len() const { return ArrayNum > 0 ? ArrayNum - 1 : 0; }
};

// FText - Testo localizzabile UE
struct FText {
    void* TextData;  // Puntatore interno a FTextHistory
    
    // Placeholder - la struttura reale è più complessa
};

// FName - Nome immutabile hashato
struct FName {
    int32_t ComparisonIndex;
    int32_t Number;
};

// UObject base class
struct UObject {
    void** VTable;
    int32_t ObjectFlags;
    int32_t InternalIndex;
    void* ClassPrivate;
    FName NamePrivate;
    void* OuterPrivate;
};

// UWidget base
struct UWidget : public UObject {
    // Slot, visibility, etc.
};

// UTextBlock - Widget per testo UI
struct UTextBlock : public UWidget {
    FText Text;
    // Altri campi...
};

// Signature delle funzioni da hookare
// Queste variano per versione UE, servono pattern scanning

// FText::ToString
typedef FString* (__fastcall* FText_ToString_t)(const FText* This, FString* OutString);

// UTextBlock::SetText  
typedef void (__fastcall* UTextBlock_SetText_t)(UTextBlock* This, const FText& InText);

// STextBlock::SetText (Slate)
typedef void (__fastcall* STextBlock_SetText_t)(void* This, const FText& InText);

// Pattern signatures per trovare le funzioni in memoria
//
// MISURATI il 30/07/2026 su 5 giochi UE reali (71-140 MB, tutti x64) con
// `node scripts/ue-validate-ftext-pattern.js`, che conta TUTTE le occorrenze
// nelle sezioni eseguibili invece di fermarsi alla prima. Un pattern serve a
// installare un hook: quello che conta non è "trova qualcosa", è "trova UNA
// COSA SOLA". Con più match si aggancia una funzione a caso con una firma
// sbagliata → crash, o corruzione heap silenziosa.
// Prima di aggiungere o cambiare un pattern qui, rimisurare con quello script.
namespace Patterns {
    // UE 5.0+ FText::ToString — USABILE.
    // 1 solo match su 4 binari su 5 (eccezione: Father's Day, 4 match → lì
    // PatternScanUnique rifiuta e si scende a GDI, che è il comportamento
    // voluto). La sequenza `test rcx,rcx / je / mov rax,[rcx]` subito dopo
    // `mov rbx,rcx` discrimina davvero, nonostante il prologo generico.
    constexpr const char* FText_ToString_UE5 =
        "40 53 48 83 EC ?? 48 8B D9 48 85 C9 74 ?? 48 8B 01";

    // ⛔ UE 4.27 FText::ToString — INUTILIZZABILE, NON REINSERIRE fra i pattern
    // provati. Misurato: 89, 103, 104, 117 e 127 match sui cinque giochi.
    // È il prologo MSVC standard di qualunque funzione a due argomenti che
    // salva due registri (mov [rsp+X],rbx / mov [rsp+X],rsi / push rdi /
    // sub rsp / mov rdi,rdx / mov rsi,rcx): compare in ogni binario grosso.
    // Resta qui solo come documentazione di cosa NON funziona; serve una firma
    // nuova, ricavata da un binario UE4.27 vero e verificata a match unico.
    constexpr const char* FText_ToString_UE427_INUTILIZZABILE =
        "48 89 5C 24 ?? 48 89 74 24 ?? 57 48 83 EC ?? 48 8B FA 48 8B F1";
}

} // namespace UE
