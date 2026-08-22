//
// gs_frame_share.cpp — pubblicazione dei fotogrammi in memoria condivisa.
//
// Il contratto sta in include/gs_frame_share.h; qui c'è solo l'attuazione.
//
#include "gs_frame_share.h"
#include "gs_log.h"

#include <Windows.h>
#include <atomic>
#include <mutex>
#include <string>

namespace gs {
namespace frame {
namespace {

HANDLE   g_mappatura = nullptr;
void*    g_base      = nullptr;
uint32_t g_larghezza = 0;
uint32_t g_altezza   = 0;
std::mutex g_mutex;   // serializza Inizializza/Chiudi, NON il percorso caldo

Intestazione* Testa() { return static_cast<Intestazione*>(g_base); }

unsigned char* Pixel() {
    return static_cast<unsigned char*>(g_base) + kOffsetPixel;
}

// Il contatore va letto e scritto come atomico a 64 bit: su x86 e x64 è
// lock-free, quindi funziona anche fra un gioco a 32 bit e un backend a 64.
std::atomic<uint64_t>* Contatore() {
    return reinterpret_cast<std::atomic<uint64_t>*>(
        static_cast<unsigned char*>(g_base) + offsetof(Intestazione, scrittura));
}

} // namespace

bool Inizializza(uint32_t larghezza, uint32_t altezza) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (g_base) return true;                       // già pronto
    if (larghezza == 0 || altezza == 0) return false;

    const uint64_t byteFotogramma = (uint64_t)larghezza * altezza * 4;
    const uint64_t totale = kOffsetPixel + byteFotogramma;

    // La mappatura è dimensionata sul fotogramma VERO, non su un massimo
    // prudenziale: un buffer da «tanto per stare larghi» sarebbe memoria
    // committata e mai usata, e la dimensione la sappiamo qui.
    const std::wstring nome = kPrefissoNome + std::to_wstring(GetCurrentProcessId());
    g_mappatura = CreateFileMappingW(INVALID_HANDLE_VALUE, nullptr, PAGE_READWRITE,
                                     (DWORD)(totale >> 32), (DWORD)(totale & 0xFFFFFFFFu),
                                     nome.c_str());
    if (!g_mappatura) {
        LogLineW(L"[gs-hook/FRAME] CreateFileMapping fallita: niente pubblicazione\n");
        return false;
    }
    g_base = MapViewOfFile(g_mappatura, FILE_MAP_ALL_ACCESS, 0, 0, (SIZE_T)totale);
    if (!g_base) {
        CloseHandle(g_mappatura);
        g_mappatura = nullptr;
        LogLineW(L"[gs-hook/FRAME] MapViewOfFile fallita: niente pubblicazione\n");
        return false;
    }

    g_larghezza = larghezza;
    g_altezza   = altezza;

    // L'intestazione si compila PRIMA di dichiarare il buffer valido: il magic
    // va scritto per ultimo, così un lettore che apre la mappatura mentre la
    // stiamo preparando non trova mai un magic giusto su campi non ancora
    // scritti.
    Intestazione* h = Testa();
    h->versione       = kVersione;
    h->larghezza      = larghezza;
    h->altezza        = altezza;
    h->formato        = kFormatoBGRA32;
    h->byteFotogramma = (uint32_t)byteFotogramma;
    h->pid            = GetCurrentProcessId();
    h->riservato      = 0;
    Contatore()->store(0, std::memory_order_release);
    std::atomic_thread_fence(std::memory_order_release);
    h->magic          = kMagic;

    wchar_t riga[200];
    swprintf_s(riga, L"[gs-hook/FRAME] pubblicazione attiva: %ls (%ux%u, %llu byte)\n",
               nome.c_str(), larghezza, altezza, (unsigned long long)totale);
    LogLineW(riga);
    return true;
}

void Pubblica(const void* pixel, uint32_t byte) {
    if (!g_base || !pixel) return;
    if (byte != Testa()->byteFotogramma) return;   // dimensione cambiata: si salta

    auto* seq = Contatore();
    const uint64_t s = seq->load(std::memory_order_relaxed);

    // Dispari: «sto scrivendo». Il lettore che vede un valore dispari scarta e
    // riprova, invece di copiare pixel a metà.
    seq->store(s + 1, std::memory_order_release);
    std::atomic_thread_fence(std::memory_order_release);

    memcpy(Pixel(), pixel, byte);

    // Pari e diverso dal precedente: «fotogramma nuovo e stabile». Il lettore
    // usa proprio la disuguaglianza per accorgersi di aver letto durante una
    // scrittura.
    std::atomic_thread_fence(std::memory_order_release);
    seq->store(s + 2, std::memory_order_release);
}

void Chiudi() {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (g_base) {
        // Il magic si azzera per primo: un lettore che arriva mentre smontiamo
        // deve vedere «non valido», non un'intestazione buona su memoria che
        // sta per sparire.
        Testa()->magic = 0;
        UnmapViewOfFile(g_base);
        g_base = nullptr;
    }
    if (g_mappatura) {
        CloseHandle(g_mappatura);
        g_mappatura = nullptr;
    }
}

} // namespace frame
} // namespace gs
