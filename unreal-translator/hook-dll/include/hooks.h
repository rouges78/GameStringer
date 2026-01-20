#pragma once

#include "ue_types.h"
#include <Windows.h>

namespace GSTranslator {

// Inizializza tutti gli hook
bool InitializeHooks();

// Rimuove tutti gli hook
void ShutdownHooks();

// Hook per FText::ToString
UE::FString* __fastcall Hooked_FText_ToString(const UE::FText* This, UE::FString* OutString);

// Hook per UTextBlock::SetText
void __fastcall Hooked_UTextBlock_SetText(UE::UTextBlock* This, const UE::FText& InText);

// Puntatori alle funzioni originali
extern UE::FText_ToString_t Original_FText_ToString;
extern UE::UTextBlock_SetText_t Original_UTextBlock_SetText;

// Pattern scanner per trovare funzioni in memoria
uintptr_t FindPattern(const char* module, const char* pattern);

// Rileva versione Unreal Engine
enum class UEVersion {
    Unknown,
    UE4_25,
    UE4_26,
    UE4_27,
    UE5_0,
    UE5_1,
    UE5_2,
    UE5_3,
    UE5_4
};

UEVersion DetectUEVersion();
const char* UEVersionToString(UEVersion version);

} // namespace GSTranslator
