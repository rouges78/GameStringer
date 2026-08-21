//
// source_unreal_ftext.cpp — Livello 1, sorgente per giochi Unreal Engine.
//
// Incapsula come ITextSource l'hook su FText::ToString: quando UE converte un
// FText (testo localizzabile) nella sua FString, intercettiamo la stringa
// risultante e la sostituiamo con la traduzione. È il punto più "alto" e pulito
// per UE — molto meglio del GDI/OCR — perché vediamo la frase intera, già
// decodificata, prima che venga renderizzata.
//
// I tipi UE (`UE::FString`, `UE::FText`) vengono dal core di unreal-translator,
// incluso da gs-hook via CMake. Il pattern-scan non serve più: vedi LIMITI.
//
// LIMITI NOTI (aggiornati 21/08/2026):
//   • Due strade, in ordine: SIMBOLO (deterministico, ma esiste solo sui
//     build non monolitici) e poi la firma di byte UE5, ricavata da un
//     binario Shipping con PDB e misurata su 15 giochi. Se nessuna aggancia,
//     Activate ritorna Failed e si scende a L2 (GDI).
//   • Non c'è una firma UE4.2x: quella provata faceva 89-127 match (rimossa il
//     30/07/2026), e la vecchia firma UE5 è stata CONFUTATA il 21/08/2026 —
//     descriveva una dispatch virtuale su `this`, e FText non ha vtable.
//     Entrambe restano documentate in ue_types.h come cosa NON funziona.
//   • Sostituzione in-place SOLO se la traduzione entra nel buffer già allocato
//     da UE (FString::ArrayMax). Espanderlo richiede l'allocatore UE
//     (FMemory::Realloc) → TODO.
//
#include "text_source.h"
#include "ue_types.h"   // UE::FString, UE::FText, UE::Patterns::FText_ToString_UE5
#include "utils.h"      // GSTranslator::Utils::PatternScanUnique
#include "gs_log.h"     // log unificato gs-hook (%TEMP%\gs-hook.log)
#include <Windows.h>
#include <TlHelp32.h>
#include <MinHook.h>
#include <string>
#include <cwctype>

namespace gs {
namespace {

TranslateFn g_translate = nullptr;

using FText_ToString_t = UE::FString* (__fastcall*)(const UE::FText*, UE::FString*);
FText_ToString_t Original_FText_ToString = nullptr;

// Allocatore di UE. Serve SOLO per far crescere il buffer di una FString quando
// la traduzione non ci sta: il puntatore risultante verra' liberato da UE con il
// proprio allocatore, quindi deve essere UE stessa ad allocarlo. Con malloc o
// new si corromperebbe l'heap alla prima free.
//   void* FMemory::Realloc(void* Original, SIZE_T Count, uint32 Alignment)
using FMemory_Realloc_t = void* (__fastcall*)(void*, size_t, uint32_t);
FMemory_Realloc_t g_ueRealloc = nullptr;

// Hook su FText::ToString. `out` è la FString che UE riempie col testo: dopo aver
// lasciato lavorare l'originale, leggiamo il testo, lo traduciamo e lo
// riscriviamo in-place nel buffer di UE (se ci sta).
UE::FString* __fastcall Hook_FText_ToString(const UE::FText* self, UE::FString* out) {
    UE::FString* result = Original_FText_ToString(self, out);

    if (g_translate && result && result->Data && result->Len() > 0) {
        std::wstring original(result->Data, result->Len());

        // Salta stringhe troppo corte o che sembrano codice/identificatori
        // (path "::", commenti "//") — riduce traffico inutile al translator.
        if (original.size() > 2 &&
            original.find(L"::") == std::wstring::npos &&
            original.find(L"//") == std::wstring::npos) {

            std::wstring t = g_translate(original);
            if (!t.empty() && t != original) {
                // In-place SOLO se la traduzione (incluso il NUL) entra nel buffer
                // già allocato da UE. Altrimenti la lasciamo invariata: scrivere
                // oltre ArrayMax corromperebbe l'heap di UE.
                // I numeri del buffer finiscono nel log in ENTRAMBI i rami:
                // servono a sapere quanto margine lascia UE, cioe' quanto spesso
                // il vincolo morde davvero. Senza, "non sostituita" non dice se
                // mancava un carattere o cinquanta.
                const std::wstring dims =
                    L" [len=" + std::to_wstring(t.size()) +
                    L" ArrayNum=" + std::to_wstring(result->ArrayNum) +
                    L" ArrayMax=" + std::to_wstring(result->ArrayMax) + L"]";

                const int32_t needed = static_cast<int32_t>(t.size() + 1); // col NUL

                if (needed <= result->ArrayMax) {
                    wcscpy_s(result->Data, static_cast<size_t>(result->ArrayMax), t.c_str());
                    result->ArrayNum = needed;
                    LogLineW(L"[gs-hook/UE] SUBST: " + original + L" -> " + t + dims + L"\n");
                } else if (g_ueRealloc) {
                    // Non ci sta: chiedi a UE un buffer piu' grande. Deve essere
                    // il suo allocatore, perche' sara' lui a liberarlo.
                    void* grown = g_ueRealloc(result->Data,
                                              static_cast<size_t>(needed) * sizeof(wchar_t),
                                              0 /* DEFAULT_ALIGNMENT */);
                    if (grown) {
                        result->Data = static_cast<wchar_t*>(grown);
                        result->ArrayMax = needed;
                        wcscpy_s(result->Data, static_cast<size_t>(needed), t.c_str());
                        result->ArrayNum = needed;
                        LogLineW(L"[gs-hook/UE] SUBST(grow): " + original + L" -> " + t
                                 + dims + L"\n");
                    } else {
                        // Realloc fallita: la FString resta quella di prima e
                        // valida — Realloc non libera l'originale se non riesce.
                        LogLineW(L"[gs-hook/UE] (non sostituita: Realloc fallita) "
                                 + original + dims + L"\n");
                    }
                } else {
                    LogLineW(L"[gs-hook/UE] (non sostituita: buffer piccolo e allocatore "
                             L"UE non risolto) " + original + dims + L"\n");
                }
            }
        }
    }

    return result;
}

// ─── Risoluzione per SIMBOLO ─────────────────────────────────────────────────
// Un simbolo esportato è deterministico: o c'è, ed è quello giusto, o non
// c'è. Nessuna ambiguità possibile, a differenza di una firma di byte.
//
// QUANDO FUNZIONA E QUANDO NO — misurato, non supposto (21/08/2026):
// serve un build **non monolitico**, con l'engine in DLL (editor, o giochi
// compilati modulari). I build Shipping monolitici — la norma commerciale — non
// esportano nulla di UE: Father's Day ha 312 export e sono tutti hint per i
// driver AMD/NVIDIA (`NvOptimusEnablement`, `ags*`), il PDB è dichiarato
// nell'header ma non spedito. Li' questa strada non puo' funzionare, e si
// scende al pattern.
//
// Nome mangled MSVC di `const FString& FText::ToString() const`:
//   ?ToString@FText@@QEBAAEBVFString@@XZ
// (`Q`=metodo pubblico, `EBA`=const __cdecl x64, `AEBVFString@@`=ritorna
//  const FString&, `XZ`=nessun parametro)
//
// La firma dell'hook resta a due argomenti anche qui: usa il VALORE DI RITORNO,
// non `out`, quindi funziona sia con il ritorno per riferimento sia con quello
// per valore (dove rdx è il buffer di ritorno e rax lo ripete).
const char* const kFTextToStringSymbols[] = {
    "?ToString@FText@@QEBAAEBVFString@@XZ",
};

/// Cerca il simbolo in tutti i moduli caricati. `moduleOut` riceve il nome del
/// modulo che l'ha fornito; `scanned` quanti moduli sono stati interrogati.
///
/// `scanned` non è decorativo: senza, un ritorno a zero non distingue «ho
/// guardato ovunque e non c'è» da «lo snapshot è fallito e non ho guardato
/// niente». Sono due diagnosi diverse e portano a due indagini diverse.
uintptr_t ResolveFTextToStringBySymbol(std::string& moduleOut, size_t& scanned) {
    scanned = 0;
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE, GetCurrentProcessId());
    if (snap == INVALID_HANDLE_VALUE) return 0;

    MODULEENTRY32W me{};
    me.dwSize = sizeof(me);
    uintptr_t found = 0;

    if (Module32FirstW(snap, &me)) {
        do {
            ++scanned;
            for (const char* name : kFTextToStringSymbols) {
                FARPROC p = GetProcAddress(reinterpret_cast<HMODULE>(me.hModule), name);
                if (!p) continue;
                found = reinterpret_cast<uintptr_t>(p);
                char buf[MAX_MODULE_NAME32 + 1] = {};
                WideCharToMultiByte(CP_UTF8, 0, me.szModule, -1, buf, sizeof(buf) - 1,
                                    nullptr, nullptr);
                moduleOut = buf;
                break;
            }
        } while (!found && Module32NextW(snap, &me));
    }

    CloseHandle(snap);
    return found;
}

class UnrealFTextSource : public ITextSource {
public:
    const char* Name() const override { return "Unreal/FText"; }
    Level GetLevel() const override { return Level::Engine; }

    bool IsApplicable() const override {
        // Segnali UE economici (nessun hook qui, solo detection):
        //  1) nome del modulo principale: i build "Shipping" di UE si chiamano
        //     tipicamente <Game>-Win64-Shipping.exe; gli editor contengono UE4/UE5.
        wchar_t exe[MAX_PATH] = {0};
        if (GetModuleFileNameW(nullptr, exe, MAX_PATH)) {
            std::wstring p(exe);
            for (auto& c : p) c = static_cast<wchar_t>(towlower(c));
            if (p.find(L"shipping") != std::wstring::npos ||
                p.find(L"ue4")      != std::wstring::npos ||
                p.find(L"ue5")      != std::wstring::npos ||
                p.find(L"unreal")   != std::wstring::npos) {
                return true;
            }
        }
        //  2) DLL tipiche dei build con engine in DLL / editor.
        return GetModuleHandleA("UnrealEditor-Core.dll") != nullptr
            || GetModuleHandleA("UE4Editor-Core.dll")    != nullptr;
    }

    Activation Activate(TranslateFn translate) override {
        g_translate = translate;

        // MinHook è già inizializzato dal dllmain di gs-hook: qui solo Create+Enable.
        HMODULE game = GetModuleHandleA(nullptr);
        if (!game) return Activation::Failed;

        // 1) SIMBOLO. Se l'engine è in DLL, l'indirizzo è certo: nessun pattern
        //    da validare, nessun rischio di agganciare la funzione sbagliata.
        std::string symModule;
        size_t symScanned = 0;
        const uintptr_t sym = ResolveFTextToStringBySymbol(symModule, symScanned);
        if (!sym) {
            LogLineA(("[gs-hook/UE] nessun simbolo FText::ToString in "
                      + std::to_string(symScanned)
                      + " moduli (build monolitico?)\n").c_str());
        }
        if (sym) {
            if (MH_CreateHook(reinterpret_cast<LPVOID>(sym),
                              reinterpret_cast<LPVOID>(&Hook_FText_ToString),
                              reinterpret_cast<LPVOID*>(&Original_FText_ToString)) == MH_OK &&
                MH_EnableHook(reinterpret_cast<LPVOID>(sym)) == MH_OK) {
                hookedAddr_ = sym;
                LogLineA(("[gs-hook/UE] FText::ToString risolto per simbolo in "
                          + symModule + " — hook installato\n").c_str());
                return Activation::Activated;
            }
            LogLineA("[gs-hook/UE] simbolo trovato ma hook fallito (MinHook)\n");
        }

        // 2) PATTERN. Nei build Shipping monolitici non c'è nessun simbolo da
        //    risolvere, quindi si ricade qui — ed è il caso normale.
        //
        //    La firma NON è indovinata: è letta dai byte di FText::ToString
        //    risolto col PDB su UnrealGame-Win64-Shipping.exe di UE 5.8, che è
        //    Shipping e monolitico come i giochi. Misurata su 15 giochi (UE 5.5,
        //    5.6, 5.8): 1 match esatto su 14. Dettagli in ue_types.h.
        //
        //    UNICITÀ COMUNQUE OBBLIGATORIA: PatternScanUnique ritorna un
        //    indirizzo solo se il pattern compare esattamente una volta. Una
        //    firma validata oggi può diventare ambigua su una build futura, e
        //    in quel caso si rifiuta e si scende a GDI. Fallire qui è il caso
        //    BENIGNO; agganciare la funzione sbagliata no.
        // Le firme si provano IN ORDINE: la stessa funzione ha codegen diversi
        // fra build (la seconda ha `Rebuild` inlinata come chiamata virtuale).
        // Sono complementari — misurate su 15 giochi, 14 + 1 — e insieme li
        // coprono tutti. Un'ambiguita' su una NON ferma la ricerca: si passa
        // alla successiva, che su quel binario puo' essere univoca.
        struct Firma { const char* nome; const char* sig; };
        static const Firma kFirme[] = {
            { "UE5 Shipping",        UE::Patterns::FText_ToString_UE5 },
            { "UE5 rebuild inline",  UE::Patterns::FText_ToString_UE5_RebuildInline },
        };

        uintptr_t addr = 0;
        for (const auto& firma : kFirme) {
            size_t matches = 0;
            addr = GSTranslator::Utils::PatternScanUnique(game, firma.sig, &matches);
            if (addr) {
                LogLineA((std::string("[gs-hook/UE] FText::ToString trovato con la firma \"") +
                          firma.nome + "\"\n").c_str());
                break;
            }
            if (matches > 1) {
                const std::string quanti =
                    (matches >= GSTranslator::Utils::PATTERN_SCAN_COUNT_CAP)
                        ? "almeno " + std::to_string(matches)
                        : std::to_string(matches);
                LogLineA((std::string("[gs-hook/UE] firma \"") + firma.nome +
                          "\" ambigua: " + quanti +
                          " match, scartata (aggancerebbe la funzione sbagliata)\n").c_str());
            }
        }

        if (!addr) {
            LogLineA("[gs-hook/UE] FText::ToString non trovato su questa build "
                     "(nessuna firma nota aggancia)\n");
            return Activation::Failed; // → il dllmain scende a L2 (GDI)
        }

        if (MH_CreateHook(reinterpret_cast<LPVOID>(addr),
                          reinterpret_cast<LPVOID>(&Hook_FText_ToString),
                          reinterpret_cast<LPVOID*>(&Original_FText_ToString)) != MH_OK ||
            MH_EnableHook(reinterpret_cast<LPVOID>(addr)) != MH_OK) {
            LogLineA("[gs-hook/UE] hook FText::ToString fallito (MinHook)\n");
            return Activation::Failed;
        }

        hookedAddr_ = addr;
        LogLineW(L"[gs-hook/UE] hook FText::ToString installato\n");

        // Allocatore UE: se non si trova, la sostituzione resta possibile solo
        // per le traduzioni che entrano nel buffer esistente. Non e' un motivo
        // per rinunciare all'hook, quindi qui non si fallisce.
        size_t reallocMatches = 0;
        if (uintptr_t ra = GSTranslator::Utils::PatternScanUnique(
                game, UE::Patterns::FMemory_Realloc, &reallocMatches)) {
            g_ueRealloc = reinterpret_cast<FMemory_Realloc_t>(ra);
            LogLineA("[gs-hook/UE] FMemory::Realloc risolto: le traduzioni piu' lunghe "
                     "dell'originale possono crescere il buffer\n");
        } else {
            LogLineA(("[gs-hook/UE] FMemory::Realloc non risolto (" +
                      std::to_string(reallocMatches) +
                      " match): solo traduzioni che entrano nel buffer\n").c_str());
        }

        return Activation::Activated;
    }

    void Deactivate() override {
        // ⚠️ Qui si passava `Original_FText_ToString`, che è il TRAMPOLINO
        // restituito da MinHook, non la funzione agganciata: MH_DisableHook
        // vuole l'indirizzo TARGET, quindi l'hook non veniva mai disabilitato.
        if (hookedAddr_)
            MH_DisableHook(reinterpret_cast<LPVOID>(hookedAddr_));
    }

private:
    /// Indirizzo di FText::ToString su cui l'hook è stato installato.
    uintptr_t hookedAddr_ = 0;
};

} // namespace
} // namespace gs

GS_REGISTER_SOURCE(gs::UnrealFTextSource);
