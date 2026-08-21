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
    // UE5 FText::ToString — USABILE. Ricavata da una VERITÀ DI RIFERIMENTO il
    // 21/08/2026, non indovinata: UE 5.8 spedisce
    // `Engine/Binaries/Win64/UnrealGame-Win64-Shipping.exe` **col suo PDB**.
    // È Shipping e monolitico come i giochi commerciali — a differenza della
    // `UnrealEditor-Core.dll`, che è Development e genera codice diverso.
    // DbgHelp risolve lì `FText::ToString` a RVA 0x1302480, e i byte sono:
    //
    //   40 53              push rbx
    //   48 83 EC 20        sub  rsp, 0x20
    //   48 8B D9           mov  rbx, rcx
    //   E8 A2 D0 00 00     call <rebuild>            ← rel32, wildcard
    //   48 8B 0B           mov  rcx, [rbx]           ← TextData
    //   48 8B 01           mov  rax, [rcx]           ← vtable
    //   48 83 C4 20        add  rsp, 0x20
    //   5B                 pop  rbx
    //   48 FF 60 28        jmp  [rax+0x28]           ← tail-call GetDisplayString
    //
    // 29 byte, con una tail-call finale che è ciò che la rende specifica.
    // Wildcard su: l'immediato di sub/add, il rel32 della call, e lo slot della
    // vtable (0x28 sul riferimento, 0x10 su Father's Day: cambia per gioco).
    //
    // MISURATA su 15 Shipping installati (UE 5.5, 5.6 e 5.8): **1 match esatto
    // su 14**, incluso The Skin Stapler (UE 5.6, RVA 0x1269100) e Father's Day
    // (RVA 0xDD3FC0), entrambi verificati all'inizio di una funzione (preceduti
    // da padding CC). Unica e all'indirizzo giusto anche sul riferimento.
    // L'unico a zero è ProjectAIDA, che quindi cadrà su GDI: il caso benigno.
    //
    // Prima di toccarla, rimisurare con scripts/ue-validate-ftext-pattern.js.
    constexpr const char* FText_ToString_UE5 =
        "40 53 48 83 EC ?? 48 8B D9 E8 ?? ?? ?? ?? 48 8B 0B 48 8B 01 "
        "48 83 C4 ?? 5B 48 FF 60 ??";

    // FMemory::Realloc — USABILE. Serve a far CRESCERE il buffer di una FString
    // quando la traduzione non entra in ArrayMax. Scrivere oltre corromperebbe
    // l'heap; allocare con `new`/malloc pure, perché UE libererà quel puntatore
    // con il PROPRIO allocatore. L'unica via sicura è chiedere a UE.
    //
    // Ricavata come quella di ToString, dal binario Shipping con PDB:
    // `FMemory::Realloc` sta a RVA 0x12D29F0 su UE 5.8. Firma C++:
    //   void* FMemory::Realloc(void* Original, SIZE_T Count, uint32 Alignment)
    // (rcx = Original, rdx = Count, r8d = Alignment; 0 = DEFAULT_ALIGNMENT)
    //
    //   48 89 5C 24 08     mov  [rsp+8], rbx
    //   48 89 74 24 10     mov  [rsp+0x10], rsi
    //   57                 push rdi
    //   48 83 EC 20        sub  rsp, 0x20
    //   48 8B F1           mov  rsi, rcx          ← Original
    //   41 8B D8           mov  ebx, r8d          ← Alignment
    //   48 8B 0D ?? ?? ?? ?? mov rcx, [rip+…]     ← GMalloc, wildcard
    //   48 8B FA           mov  rdi, rdx          ← Count
    //   48 85 C9           test rcx, rcx          ← GMalloc già creato?
    //   75 ??              jne  …
    //
    // Il prologo iniziale da solo sarebbe generico (è quello che rese
    // inutilizzabile la firma UE4.27): a discriminare è la sequenza
    // `mov rsi,rcx / mov ebx,r8d / mov rcx,[rip+GMalloc]`.
    //
    // MISURATA: 1 match esatto su **tutti e 15** gli Shipping installati, e
    // unica all'indirizzo giusto sul riferimento. Verificata all'inizio di
    // funzione su The Skin Stapler (0x123A3A0) e Father's Day (0xD94DD0).
    constexpr const char* FMemory_Realloc =
        "48 89 5C 24 08 48 89 74 24 10 57 48 83 EC 20 48 8B F1 41 8B D8 "
        "48 8B 0D ?? ?? ?? ?? 48 8B FA 48 85 C9 75 ??";

    // ⛔ UE5 FText::ToString — CONFUTATO il 21/08/2026, NON REINSERIRE.
    //
    // Era qui dal commit iniziale con la nota «(esempio)»: un'ipotesi mai
    // verificata. Sembrava buona perché faceva 1 solo match su 4 binari su 5,
    // ma **unicità non è correttezza**, ed era il match sbagliato.
    //
    // La prova, con una verità di riferimento vera: UE 5.8 installato
    // (`Engine/Binaries/Win64/UnrealEditor-Core.dll`) esporta
    // `?ToString@FText@@QEBAAEBVFString@@XZ` a RVA 0x3EFA60. I byte lì sono:
    //
    //   40 53              push rbx
    //   48 83 EC 30        sub  rsp, 0x30
    //   48 8B D9           mov  rbx, rcx
    //   E8 F2 EE FE FF     call <rebuild>        ← una CALL
    //   48 8B 0B           mov  rcx, [rbx]       ← carica TextData
    //   48 85 C9           test rcx, rcx
    //
    // Questo pattern si aspetta invece `48 85 C9` (test) SUBITO dopo
    // `48 8B D9`, e poi `48 8B 01` (mov rax,[rcx]) seguito da una chiamata
    // attraverso rax: cioè **una dispatch virtuale su `this`**. FText non è
    // polimorfico — non ha vtable — quindi quella forma non può essere
    // FText::ToString in nessuna versione UE5. Conferma numerica: il pattern
    // compare **0 volte** in tutta UnrealEditor-Core.dll, che quella funzione
    // la contiene di sicuro.
    //
    // Dove faceva «1 match unico» (The Skin Stapler, Greed Stays Home, Beyond
    // Hanwell, Cooking Simulator VR, Oneirophobia…) l'hook si sarebbe
    // installato su una funzione qualsiasi con firma diversa: esattamente il
    // crash o la corruzione heap che PatternScanUnique doveva prevenire. Il
    // caso «ambiguo» di Father's Day era il meno pericoloso, non il più.
    //
    // Non è stato sostituito con una firma nuova perché quella ricavata da
    // UE 5.8 (`40 53 48 83 EC ?? 48 8B D9 E8 ?? ?? ?? ?? 48 8B 0B 48 85 C9 75 ??`)
    // fa 6 match sulla stessa DLL e **0** su tutti i 18 Shipping installati:
    // il prologo cambia fra versioni UE, quindi una firma va ricavata E
    // validata sulla versione di quel gioco. Vedi il registro.
    constexpr const char* FText_ToString_UE5_CONFUTATO =
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
