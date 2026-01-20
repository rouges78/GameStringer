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
namespace Patterns {
    // Questi pattern vanno aggiornati per ogni versione UE
    // Formato: byte pattern con ?? per wildcard
    
    // UE 4.27 FText::ToString pattern (esempio)
    constexpr const char* FText_ToString_UE427 = 
        "48 89 5C 24 ?? 48 89 74 24 ?? 57 48 83 EC ?? 48 8B FA 48 8B F1";
    
    // UE 5.0+ FText::ToString pattern (esempio)
    constexpr const char* FText_ToString_UE5 = 
        "40 53 48 83 EC ?? 48 8B D9 48 85 C9 74 ?? 48 8B 01";
}

} // namespace UE
