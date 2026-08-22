//
// source_gdi.cpp — Livello 2 (UNIVERSALE), sorgente GDI. ⭐ Il pezzo innovativo.
//
// Aggancia ExtTextOut / TextOut / DrawText in gdi32+user32, nelle varianti
// Unicode E ANSI. Moltissimi engine diversi (vecchi, custom, middleware, tool,
// emulatori) e gran parte della UI Win32 passano da qui SENZA saperlo: un solo
// hook → tanti giochi.
//
// DOVE **NON** ARRIVA (misurato il 22/08/2026, Yume Nikki portato in partita):
// RPG Maker 2000/2003 non chiama NESSUNA di queste funzioni, né W né A — zero
// righe di diagnostica in una sessione intera. Disegna il testo per conto suo,
// e per quei giochi la strada giusta è quella sui file (.ldb/.lmu), non questa.
// Il controllo positivo che rende attendibile quello zero: la stessa DLL in
// charmap.exe produce catture e righe OVERLAY regolarmente.
//
// IL PROBLEMA DURO (e il senso dello spike): il testo spesso NON arriva come
// frase intera. Arriva a pezzi — parola per parola, a volte glifo per glifo —
// con chiamate ravvicinate nello spazio (stesso DC, X crescente, stessa Y).
// Per tradurre la FRASE e non la lettera serve un COALESCER: bufferizza i
// frammenti contigui, e quando la riga è "chiusa" (cambio Y, gap temporale,
// flush forzato) traduce l'intera stringa ricostruita.
//
// Questo file è lo SCHELETRO del coalescer: la struttura c'è, gli euristici di
// chiusura riga sono i parametri da tarare nello spike. È volutamente
// conservativo (di default NON sostituisce, solo logga le frasi ricostruite),
// così il primo test è SICURO: serve a rispondere "il coalescer ricostruisce
// frasi pulite da un gioco reale?". Se sì → idea #1 confermata.
//
#include "text_source.h"
#include "gs_log.h"
#include "gs_overlay_ipc.h"
#include <Windows.h>
#include <MinHook.h>
#include <string>
#include <vector>
#include <mutex>
#include <chrono>
#include <climits>
#include <cwctype>
#include <atomic>

namespace gs {
namespace {

TranslateFn g_translate = nullptr;

// ─── Diagnostica di esercizio ────────────────────────────────────────────────
//
// Il log diceva «sorgente attiva» perché MH_CreateHook era riuscito — cioè
// perché la funzione esiste in gdi32, non perché il gioco la chiami. Un hook su
// una funzione mai invocata è indistinguibile, nel log, da un hook che funziona
// e non ha ancora visto testo, e su Yume Nikki quella differenza è costata una
// diagnosi sbagliata.
//
// Queste righe la rendono visibile: le PRIME chiamate viste, con la porta
// d'ingresso e il testo grezzo, PRIMA di ogni filtro. Zero righe `#n` nel log
// dopo una sessione di gioco significa che il testo non passa da GDI, e lo dice
// senza doverlo dedurre. Il tetto tiene il costo fisso: non è tracciamento
// continuo, è una risposta a una domanda.
constexpr int kDiagPrimeChiamate = 24;
std::atomic<int> g_chiamateViste{0};

void DiagChiamata(const wchar_t* porta, const std::wstring& s) {
    const int n = g_chiamateViste.fetch_add(1, std::memory_order_relaxed);
    if (n < kDiagPrimeChiamate) {
        LogLineW(L"[gs-hook/GDI] #" + std::to_wstring(n) + L" " + porta + L" \"" + s + L"\"\n");
    }
}

// ─── Diagnostica dei blit (opt-in: GS_HOOK_DIAG_BLIT=1) ──────────────────────
//
// A COSA SERVE. RPG Maker 2000/2003 non chiama nessuna funzione di testo GDI —
// misurato, con controllo positivo. Resta da capire COME disegni il testo.
// L'ipotesi è un font bitmap blittato glifo per glifo: se è vera, mentre una
// frase è a schermo si vede una raffica di `BitBlt` con rettangoli sorgente
// PICCOLI, dalla STESSA DC sorgente, a X crescente e Y costante — la stessa
// firma che il coalescer cerca sul testo GDI. E il rettangolo sorgente
// *identifica il carattere*, perché la sua posizione nel bitmap del font è
// l'indice del glifo: da lì si potrebbe risalire al testo.
//
// PERCHÉ È OPT-IN. `BitBlt` è la chiamata più calda di un gioco 2D: passa per
// ogni tile, ogni sprite, ogni fotogramma. Agganciarla sempre significherebbe
// pagare un hook milioni di volte per una domanda che ci si pone una volta.
// Con `GS_HOOK_DIAG_BLIT=1` il hook non viene nemmeno installato quando non
// serve.
//
// COSA FILTRA. Solo i blit con sorgente piccola (≤ kBlitMaxLatoPx per lato):
// i glifi lo sono, gli sfondi e le mappe no. Non è una certezza — i tile di
// RPG Maker sono 16×16 e passano anche loro — ma riduce il rumore abbastanza da
// far emergere una riga di testo, che si riconosce dalla progressione in X.
// (soglia conservata per un eventuale filtro futuro; oggi non si filtra)
constexpr int kBlitMaxLatoPx  = 32;
constexpr int kDiagPrimiBlit  = 400;
std::atomic<int> g_blitVisti{0};

bool DiagBlitAttiva() {
    static const bool attiva = [] {
        char buf[8] = {};
        return GetEnvironmentVariableA("GS_HOOK_DIAG_BLIT", buf, sizeof(buf)) > 0 &&
               buf[0] == '1';
    }();
    return attiva;
}

void DiagBlit(const wchar_t* porta, HDC src, int sx, int sy, int w, int h,
              int dx, int dy) {
    const int n = g_blitVisti.fetch_add(1, std::memory_order_relaxed);

    // Le PRIME chiamate si registrano tutte, qualunque dimensione. Filtrare per
    // «sorgente piccola» sembrava ragionevole — i glifi sono piccoli — ma un
    // filtro che non produce righe non distingue «nessun glifo» da «nessuna
    // chiamata», e sono due risposte opposte. Prima si guarda se la funzione
    // viene invocata; solo dopo ha senso selezionare cosa.
    if (n < kDiagPrimiBlit) {
        wchar_t riga[220];
        // La DC sorgente in esadecimale: glifi dello stesso font arrivano tutti
        // dalla stessa, ed è il modo più rapido per separarli dai tile.
        swprintf_s(riga, L"[gs-hook/BLIT] #%d %ls src=%p (%d,%d) %dx%d -> (%d,%d)\n",
                   n, porta, (void*)src, sx, sy, w, h, dx, dy);
        LogLineW(riga);
        return;
    }

    // Oltre il tetto si smette di scrivere una riga per chiamata — sarebbero
    // milioni — ma si segna il passaggio alle potenze di dieci, così il log
    // dice comunque l'ordine di grandezza invece di tacere.
    for (int soglia = 1000; soglia <= 1000000; soglia *= 10) {
        if (n == soglia) {
            wchar_t riga[120];
            swprintf_s(riga, L"[gs-hook/BLIT] ... %d blit finora\n", n);
            LogLineW(riga);
        }
    }
}

// ─── Cattura del fotogramma al present (opt-in: GS_HOOK_FRAME_DUMP=<prefisso>) ─
//
// PERCHÉ QUI. Misurato il 22/08/2026: RPG Maker 2000/2003 compone l'INTERO
// fotogramma in una bitmap in memoria — tile, sprite, testo — senza una sola
// chiamata di disegno GDI, e lo presenta con una `StretchBlt` per frame. Quel
// blit finale è quindi il posto migliore per prendere l'immagine:
//
//   - la finestra può essere coperta, minimizzata, dietro un browser a schermo
//     intero: qui non cambia niente, perché i pixel non vengono dallo schermo;
//   - overlay, notifiche e cursori NON possono finirci dentro, perché non
//     esistono ancora: il fotogramma è quello del gioco, prima della
//     composizione del desktop;
//   - si prende ESATTAMENTE un fotogramma, non «quello che c'era sullo schermo».
//
// È l'opposto della cattura per coordinate, che ha restituito i pixel di un
// browser mentre puntava a un gioco (vedi METODI-DI-TRADUZIONE.md).
//
// COSA FA E COSA NON FA. Salva un numero LIMITATO di fotogrammi come .bmp, e si
// ferma. Non espone i frame all'applicazione: quel ponte va costruito con
// entrambi i lati insieme, e questo progetto ha già collezionato IPC a metà.
// Qui si dimostra il punto d'aggancio; il trasporto è un passo successivo e
// deliberato.
constexpr int kMaxFotogrammiDump = 3;
std::atomic<int> g_fotogrammiSalvati{0};

const std::wstring& PrefissoDump() {
    static const std::wstring p = [] {
        wchar_t buf[MAX_PATH] = {};
        const DWORD n = GetEnvironmentVariableW(L"GS_HOOK_FRAME_DUMP", buf, MAX_PATH);
        return (n > 0 && n < MAX_PATH) ? std::wstring(buf, n) : std::wstring();
    }();
    return p;
}

bool DumpFotogrammiAttivo() { return !PrefissoDump().empty(); }

// Scrive un BMP a 32 bit. `bits` è bottom-up, come lo restituisce GetDIBits con
// altezza positiva: è già il verso naturale del formato, quindi non si gira
// niente e non c'è un'immagine capovolta da sbagliare.
bool SalvaBmp(const std::wstring& path, const void* bits, int w, int h) {
    const DWORD dati = (DWORD)w * (DWORD)h * 4;
    BITMAPFILEHEADER fh{};
    fh.bfType    = 0x4D42; // "BM"
    fh.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER);
    fh.bfSize    = fh.bfOffBits + dati;

    BITMAPINFOHEADER ih{};
    ih.biSize      = sizeof(BITMAPINFOHEADER);
    ih.biWidth     = w;
    ih.biHeight    = h;
    ih.biPlanes    = 1;
    ih.biBitCount  = 32;
    ih.biSizeImage = dati;

    HANDLE f = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr,
                           CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (f == INVALID_HANDLE_VALUE) return false;
    DWORD scritti = 0;
    bool ok = WriteFile(f, &fh, sizeof(fh), &scritti, nullptr) &&
              WriteFile(f, &ih, sizeof(ih), &scritti, nullptr) &&
              WriteFile(f, bits, dati, &scritti, nullptr);
    CloseHandle(f);
    return ok;
}

// Il "present" è un blit la cui destinazione è la DC di una FINESTRA. Si
// riconosce così e non dalle dimensioni: 320×240 è di questo gioco, mentre
// `WindowFromDC` vale per qualunque motore che presenti con un blit.
void CatturaSePresent(HDC dst, HDC src, int sw, int sh) {
    if (!DumpFotogrammiAttivo()) return;
    if (g_fotogrammiSalvati.load(std::memory_order_relaxed) >= kMaxFotogrammiDump) return;
    if (sw <= 0 || sh <= 0 || !WindowFromDC(dst)) return;

    HBITMAP bmp = (HBITMAP)GetCurrentObject(src, OBJ_BITMAP);
    if (!bmp) return;

    BITMAPINFO bi{};
    bi.bmiHeader.biSize        = sizeof(BITMAPINFOHEADER);
    bi.bmiHeader.biWidth       = sw;
    bi.bmiHeader.biHeight      = sh;   // positivo = bottom-up, il verso del BMP
    bi.bmiHeader.biPlanes      = 1;
    bi.bmiHeader.biBitCount    = 32;
    bi.bmiHeader.biCompression = BI_RGB;

    std::vector<unsigned char> pixel((size_t)sw * sh * 4);
    if (!GetDIBits(src, bmp, 0, (UINT)sh, pixel.data(), &bi, DIB_RGB_COLORS)) return;

    const int n = g_fotogrammiSalvati.fetch_add(1, std::memory_order_relaxed);
    if (n >= kMaxFotogrammiDump) return;

    wchar_t path[MAX_PATH];
    swprintf_s(path, L"%ls-%d.bmp", PrefissoDump().c_str(), n);
    const bool ok = SalvaBmp(path, pixel.data(), sw, sh);

    wchar_t riga[MAX_PATH + 80];
    swprintf_s(riga, L"[gs-hook/FRAME] #%d %dx%d -> %ls (%ls)\n",
               n, sw, sh, path, ok ? L"ok" : L"scrittura fallita");
    LogLineW(riga);
}

using BitBlt_t = BOOL (WINAPI*)(HDC, int, int, int, int, HDC, int, int, DWORD);
BitBlt_t Original_BitBlt = nullptr;

BOOL WINAPI Hook_BitBlt(HDC dst, int x, int y, int w, int h,
                        HDC src, int sx, int sy, DWORD rop) {
    DiagBlit(L"BitBlt", src, sx, sy, w, h, x, y);
    CatturaSePresent(dst, src, w, h);
    return Original_BitBlt(dst, x, y, w, h, src, sx, sy, rop);
}

using StretchBlt_t = BOOL (WINAPI*)(HDC, int, int, int, int, HDC, int, int, int, int, DWORD);
StretchBlt_t Original_StretchBlt = nullptr;

BOOL WINAPI Hook_StretchBlt(HDC dst, int x, int y, int w, int h,
                            HDC src, int sx, int sy, int sw, int sh, DWORD rop) {
    DiagBlit(L"StretchBlt", src, sx, sy, sw, sh, x, y);
    CatturaSePresent(dst, src, sw, sh);
    return Original_StretchBlt(dst, x, y, w, h, src, sx, sy, sw, sh, rop);
}

// Guardia di rientranza: DrawTextW (user32) rende il testo chiamando ExtTextOutW
// UNA VOLTA PER RIGA VISIVA del word-wrap. Senza questa guardia, il contenuto di
// DrawText verrebbe catturato due volte: intero dal hook DrawTextW e a pezzi
// (spezzato per riga) dal hook ExtTextOutW. Mentre siamo dentro DrawTextW
// ignoriamo le ExtTextOutW interne. È thread_local perché DrawText rende in modo
// sincrono sul thread chiamante.
thread_local int g_inDrawText = 0;

// ─── Contesto di disegno catturato per ridisegnare la riga tradotta ──────────
// Nel caso GLIFO-PER-GLIFO non possiamo sostituire al volo: i glifi originali
// verrebbero disegnati prima di conoscere la frase. Soluzione: SOPPRIMIAMO i
// glifi (non chiamiamo l'Original), e quando la riga si chiude RIDISEGNIAMO una
// sola volta la stringa tradotta nel punto del primo glifo, ripristinando
// font/colori/allineamento catturati allora.
struct DrawCtx {
    HDC      dc        = nullptr;
    int      x         = 0;
    int      y         = 0;
    UINT     options   = 0;
    HFONT    font      = nullptr;
    COLORREF textColor = 0;
    COLORREF bkColor   = 0;
    int      bkMode    = 0;
    UINT     align     = 0;
};

// ─── Coalescer di frammenti di testo ─────────────────────────────────────────
// Bufferizza i frammenti che sembrano appartenere alla stessa riga logica.
class LineCoalescer {
public:
    // Aggiunge un frammento col suo contesto di disegno. Ritorna true se questo
    // frammento ha "chiuso" la riga precedente: in tal caso `closedText` contiene
    // la frase completa e `closedCtx` il contesto del PRIMO glifo di quella riga
    // (dc/x/y/font/colori), per poterla ridisegnare tradotta nel punto giusto.
    bool Add(const DrawCtx& ctx, const std::wstring& fragment,
             std::wstring& closedText, DrawCtx& closedCtx) {
        std::lock_guard<std::mutex> lock(m_mutex);
        const auto now = Clock::now();

        // ── Guardia di idempotenza (anti-doppione da repaint sovrapposti) ──
        // Alcuni renderer (overlay trasparenti, redraw parziali) ri-disegnano lo
        // STESSO glifo alla STESSA posizione (x,y) prima che la riga si chiuda:
        // senza questa guardia il coalescer accodava il carattere due volte
        // ("wiilld", "slliim"). Un frammento identico al precedente nello stesso
        // identico punto è un no-op visivo → lo ignoriamo (aggiornando solo il
        // tempo, così l'idle-flush resta corretto). Non può scartare testo vero:
        // un gioco non disegna un glifo diverso nello stesso pixel.
        if (!m_buf.empty() &&
            ctx.x == m_lastFragX && ctx.y == m_lastFragY &&
            fragment == m_lastFrag) {
            m_lastTime = now;
            return false;
        }
        m_lastFrag  = fragment;
        m_lastFragX = ctx.x;
        m_lastFragY = ctx.y;

        bool closedPrev = false;
        if (!m_buf.empty()) {
            const long ageMs =
                (long)std::chrono::duration_cast<std::chrono::milliseconds>(now - m_lastTime).count();
            // Tolleranza ALTA per i typewriter (RPG Maker disegna ~1 char per
            // frame, con pause ben oltre kMaxGapMs): finché la geometria dice
            // "stessa riga / riga successiva del paragrafo" NON chiudiamo per il
            // solo tempo. La chiusura per fine-frase la fa l'idle-flush (EndPaint).
            const bool tooOld = ageMs > kSameLineMaxGapMs;
            const bool sameDc = (ctx.dc == m_ctx.dc);

            // (a) stessa riga: frammento che continua orizzontalmente a destra.
            const bool sameLine =
                sameDc &&
                std::abs(ctx.y - m_ctx.y) <= kYTolerancePx &&     // stessa altezza
                ctx.x >= m_lastRight - kXOverlapPx &&              // continua a destra
                ctx.x <= m_lastRight + kXGapPx;                    // senza salti grandi

            // (b) riga successiva dello STESSO paragrafo (word-wrap): Y maggiore di
            //     ~una riga, riparte dallo stesso margine sinistro → unisci.
            const int dy = ctx.y - m_ctx.y;
            const bool nextLineSameParagraph =
                kMergeWrappedLines && sameDc && !tooOld &&
                dy > kYTolerancePx &&
                dy <= kLineHeightMaxPx &&
                std::abs(ctx.x - m_startX) <= kXLeftMarginTolPx;

            if (sameLine && !tooOld) {
                m_buf += fragment;                                // continua la riga
                m_lastRight = ctx.x + EstimateWidthPx(ctx.dc, fragment);
                m_lastTime  = now;
                return false;
            }
            if (nextLineSameParagraph) {
                if (!m_buf.empty() && m_buf.back() != L' ') m_buf += L' ';
                m_buf += fragment;                                // unisci riga wrappata
                m_startX = ctx.x;
                m_lastRight = ctx.x + EstimateWidthPx(ctx.dc, fragment);
                m_lastTime  = now;
                return false;
            }

            // Altrimenti: la riga precedente è chiusa. Emetti testo + contesto.
            closedText = m_buf;
            closedCtx  = m_ctx;
            m_buf.clear();
            closedPrev = !closedText.empty();
        }

        // Nuova riga: cattura il contesto del PRIMO glifo (serve a ridisegnare).
        m_ctx    = ctx;
        m_startX = ctx.x;
        m_buf += fragment;
        m_lastRight = ctx.x + EstimateWidthPx(ctx.dc, fragment);
        m_lastTime  = now;
        return closedPrev;
    }

    // Forza la chiusura della riga corrente (es. dentro EndPaint, a fine frame).
    bool Flush(std::wstring& closedText, DrawCtx& closedCtx) {
        std::lock_guard<std::mutex> lock(m_mutex);
        if (m_buf.empty()) return false;
        closedText = m_buf;
        closedCtx  = m_ctx;
        m_buf.clear();
        m_lastRight = 0;
        return true;
    }

    // Flush SOLO se la riga è ferma da almeno idleMs (typewriter finito / box in
    // attesa di input). Usato come "tick" da EndPaint per chiudere la FRASE
    // COMPLETA senza spezzarla a ogni frame: durante la digitazione ogni nuovo
    // char aggiorna m_lastTime → età < idle → niente flush; alla pausa di fine
    // messaggio l'età supera idle → flush una volta sola.
    bool FlushIfIdle(long idleMs, std::wstring& closedText) {
        std::lock_guard<std::mutex> lock(m_mutex);
        if (m_buf.empty()) return false;
        const long ageMs = (long)std::chrono::duration_cast<std::chrono::milliseconds>(
            Clock::now() - m_lastTime).count();
        if (ageMs < idleMs) return false;
        closedText = m_buf;
        m_buf.clear();
        m_lastRight = 0;
        return true;
    }

private:
    using Clock = std::chrono::steady_clock;

    // Parametri tarati nello spike (cuore dell'euristica):
    static constexpr int  kYTolerancePx     = 3;    // glifi sulla stessa riga
    static constexpr int  kXOverlapPx       = 4;    // tolleranza kerning/overlap
    static constexpr int  kXGapPx           = 24;   // gap max prima di "nuova parola/colonna"
    static constexpr long kMaxGapMs         = 80;   // (legacy, modalità suppress)
    static constexpr long kSameLineMaxGapMs = 1500; // typewriter: pausa max same-line
    // Merge verticale (righe wrappate dello stesso paragrafo):
    static constexpr bool kMergeWrappedLines = true; // unisci righe wrappate in 1 frase
    static constexpr int  kLineHeightMaxPx   = 28;   // dy max tra riga e riga successiva
    static constexpr int  kXLeftMarginTolPx  = 12;   // la riga dopo riparte ~stesso margine X

    int EstimateWidthPx(HDC dc, const std::wstring& s) {
        SIZE sz{0, 0};
        if (dc && GetTextExtentPoint32W(dc, s.c_str(), (int)s.size(), &sz)) return sz.cx;
        return (int)s.size() * 8; // fallback grossolano
    }

    std::mutex   m_mutex;
    std::wstring m_buf;
    DrawCtx      m_ctx;             // contesto del primo glifo della riga corrente
    int          m_startX    = 0;
    int          m_lastRight = 0;
    Clock::time_point m_lastTime{};
    // Ultimo frammento accodato + sua posizione (guardia di idempotenza).
    std::wstring m_lastFrag;
    int          m_lastFragX = INT_MIN;
    int          m_lastFragY = INT_MIN;
};

LineCoalescer g_coalescer;

// MODALITÀ:
//   true  → log-only: NON sostituisce, logga solo le frasi ricostruite
//           (l'esperimento sicuro iniziale, usato per tarare il coalescer).
//   false → SOSTITUZIONE REALE: traduce e ridisegna in-place (più log delle
//           sostituzioni effettuate, così il comportamento resta osservabile).
// Validato il coalescer, siamo passati a false.
constexpr bool kSpikeLogOnly = false;

// SUPPRESS-AND-REDRAW per il caso glifo-per-glifo: i frammenti (singoli glifi /
// pezzi non sostituibili da soli) non vengono disegnati subito; quando la riga
// si chiude, ridisegniamo una sola volta la frase TRADOTTA (o l'originale se la
// traduzione manca, così il testo non sparisce mai). Richiede l'hook su EndPaint
// per chiudere l'ultima riga del frame. Ininfluente in modalità log-only.
constexpr bool kGlyphSuppressRedraw = true;

// Solo i frammenti CORTI (firma glifo-per-glifo: di norma 1 carattere per
// chiamata, 2 per surrogati/combinazioni) vengono soppressi e ricostruiti. Le
// chiamate con stringhe più lunghe sono "intere per chiamata": se in cache le
// gestisce il path per-chiamata (SUBST), altrimenti si disegnano normalmente —
// niente soppressione inutile, blast radius minimo.
constexpr UINT kMaxSuppressFragmentChars = 2;

// MODALITÀ PASSIVA (estrazione → overlay). Scoperta sul campo (Ib, RPG Maker
// 2000): RPG_RT disegna i dialoghi via ExtTextOutW in modo INCREMENTALE (~1 char
// per frame, effetto macchina-da-scrivere). Sopprimere-e-ridisegnare sgrana il
// testo a schermo, e la sostituzione in-place di una traduzione di lunghezza
// diversa è impossibile a metà digitazione. In modalità passiva NON tocchiamo
// MAI il disegno del gioco: osserviamo, coalesciamo la frase intera (gate
// temporale rilassato + idle-flush) e la inoltriamo all'overlay in tempo reale.
// La sostituzione in-place (suppress-redraw) resta per i casi "stringa intera
// per chiamata" quando kPassiveOverlayMode è false.
constexpr bool kPassiveOverlayMode = true;

// Idle (ms) dopo l'ultimo frammento oltre cui consideriamo la frase COMPLETA e
// la inoltriamo (typewriter in pausa / box in attesa). < kSameLineMaxGapMs.
constexpr long kLineIdleMs = 350;

// Euristica: vale la pena tradurre questa stringa? Evita di mandare al
// translator singoli glifi, numeri puri o punteggiatura (che il word-render
// emette spessissimo). Richiede ≥2 caratteri e almeno una lettera.
bool LooksSubstitutable(const std::wstring& s) {
    if (s.size() < 2) return false;
    for (wchar_t c : s) {
        if (iswalpha(c)) return true;
    }
    return false;
}

// MODALITÀ PASSIVA: inoltra una riga COALESCITA all'overlay. Traduce via cache
// (per il campo `translated`); la traduzione vera la fa il frontend dell'overlay.
// Non tocca il rendering del gioco. Filtra glifi/punteggiatura isolati (es. la
// freccia "▼" di continua) con LooksSubstitutable.
void ForwardToOverlay(const std::wstring& line) {
    if (!LooksSubstitutable(line)) return;
    std::wstring translated = line;
    if (g_translate) {
        std::wstring t = g_translate(line);
        if (!t.empty()) translated = t;
    }
    LogLineW(L"[gs-hook/GDI] OVERLAY: " + line + L"\n");
    gs::overlay::Send(line, translated);
}

// ─── Tipi e puntatori agli originali (servono già a RedrawClosedLine) ────────
using ExtTextOutW_t = BOOL (WINAPI*)(HDC, int, int, UINT, const RECT*,
                                     LPCWSTR, UINT, const INT*);
ExtTextOutW_t Original_ExtTextOutW = nullptr;

// Ridisegna una riga CHIUSA: traduce e disegna UNA SOLA VOLTA la stringa
// (tradotta se in cache, altrimenti l'originale → il testo non sparisce mai) nel
// punto del primo glifo, ripristinando font/colori/allineamento catturati.
void RedrawClosedLine(const std::wstring& src, const DrawCtx& c) {
    if (src.empty() || !c.dc) return;
    std::wstring out = src;
    if (g_translate && LooksSubstitutable(src)) {
        std::wstring t = g_translate(src);
        if (!t.empty()) out = t;
    }
    const bool subst = (out != src);
    LogLineW((subst ? L"[gs-hook/GDI] SUBST(glyph): "
                    : L"[gs-hook/GDI] REDRAW(glyph): ")
             + src + (subst ? (L" -> " + out) : std::wstring()) + L"\n");

    HGDIOBJ  oldFont  = c.font ? SelectObject(c.dc, c.font) : nullptr;
    int      oldMode  = SetBkMode(c.dc, c.bkMode);
    COLORREF oldText  = SetTextColor(c.dc, c.textColor);
    COLORREF oldBk    = SetBkColor(c.dc, c.bkColor);
    UINT     oldAlign = SetTextAlign(c.dc, c.align & ~TA_UPDATECP); // disegna a X assoluta

    // La guardia evita che il NOSTRO redraw venga ri-catturato dal hook.
    ++g_inDrawText;
    Original_ExtTextOutW(c.dc, c.x, c.y, c.options & ~(ETO_PDY | ETO_OPAQUE),
                         nullptr, out.c_str(), (UINT)out.size(), nullptr);
    --g_inDrawText;

    SetTextAlign(c.dc, oldAlign);
    SetBkColor(c.dc, oldBk);
    SetTextColor(c.dc, oldText);
    SetBkMode(c.dc, oldMode);
    if (oldFont) SelectObject(c.dc, oldFont);
}

// SUPPRESS-AND-REDRAW (glifo-per-glifo): bufferizza il frammento SENZA disegnarlo;
// quando la riga si chiude, ridisegna la riga tradotta una sola volta.
BOOL CoalesceAndSuppress(const DrawCtx& ctx, const std::wstring& frag) {
    std::wstring closedText;
    DrawCtx      closedCtx;
    if (g_coalescer.Add(ctx, frag, closedText, closedCtx) && !closedText.empty()) {
        RedrawClosedLine(closedText, closedCtx);
    }
    return TRUE; // glifo soppresso: riapparirà (tradotto) alla chiusura riga
}

// Path di sola DIAGNOSTICA (coalescer in log-only): ricostruisce la frase e la
// logga, senza toccare il rendering.
void OnFragmentDiag(const DrawCtx& ctx, const std::wstring& fragment) {
    if (fragment.empty()) return;
    std::wstring closedText;
    DrawCtx      closedCtx;
    if (g_coalescer.Add(ctx, fragment, closedText, closedCtx) && !closedText.empty()) {
        LogLineW(L"[gs-hook/GDI] FRASE: " + closedText + L"\n");
    }
}

// Cattura il contesto GDI corrente (font/colori/allineamento) per ridisegnare
// fedelmente la riga tradotta nel punto del primo glifo.
DrawCtx CaptureCtx(HDC hdc, int x, int y, UINT options) {
    DrawCtx c;
    c.dc        = hdc;
    c.x         = x;
    c.y         = y;
    c.options   = options;
    c.font      = (HFONT)GetCurrentObject(hdc, OBJ_FONT);
    c.textColor = GetTextColor(hdc);
    c.bkColor   = GetBkColor(hdc);
    c.bkMode    = GetBkMode(hdc);
    c.align     = GetTextAlign(hdc);
    return c;
}

// ─── Hook su ExtTextOutW ─────────────────────────────────────────────────────
BOOL WINAPI Hook_ExtTextOutW(HDC hdc, int x, int y, UINT options, const RECT* rect,
                             LPCWSTR str, UINT count, const INT* dx) {
    // ETO_GLYPH_INDEX: `str` contiene indici di glifo, NON caratteri → non toccare.
    if (str && count > 0 && g_inDrawText == 0 && !(options & ETO_GLYPH_INDEX)) {
        std::wstring s(str, count);
        DiagChiamata(L"ExtTextOutW", s);

        // MODALITÀ PASSIVA (default, real-time/overlay): osserva + coalesce +
        // inoltra all'overlay SENZA mai sopprimere/ridisegnare. Il gioco disegna
        // normalmente (nessuno sgranamento su renderer incrementali tipo RPG_RT).
        if (kPassiveOverlayMode) {
            DrawCtx ctx = CaptureCtx(hdc, x, y, options);
            std::wstring closedText;
            DrawCtx      closedCtx;
            if (g_coalescer.Add(ctx, s, closedText, closedCtx) && !closedText.empty()) {
                ForwardToOverlay(closedText);
            }
            // niente return: si cade nel disegno normale del gioco, sotto.
        } else if (kSpikeLogOnly) {
            DrawCtx ctx = CaptureCtx(hdc, x, y, options);
            OnFragmentDiag(ctx, s);
        } else {
            // (1) Sostituzione in-place per-chiamata: "stringa intera per chiamata".
            if (g_translate && LooksSubstitutable(s)) {
                std::wstring t = g_translate(s);
                if (!t.empty() && t != s) {
                    LogLineW(L"[gs-hook/GDI] SUBST(ExtTextOut): " + s + L" -> " + t + L"\n");
                    // `dx` (avanzamenti) vale per la stringa ORIGINALE → nullptr.
                    return Original_ExtTextOutW(hdc, x, y, options & ~ETO_PDY, rect,
                                                t.c_str(), (UINT)t.size(), nullptr);
                }
            }
            // (2) Frammenti corti (glifo-per-glifo): soppressione + redraw a chiusura.
            DrawCtx ctx = CaptureCtx(hdc, x, y, options);
            if (g_translate && kGlyphSuppressRedraw && count <= kMaxSuppressFragmentChars) {
                return CoalesceAndSuppress(ctx, s);
            }
        }
    }
    return Original_ExtTextOutW(hdc, x, y, options, rect, str, count, dx);
}

// ─── Hook su DrawTextW (di solito frasi/paragrafi interi, più facile) ────────
using DrawTextW_t = int (WINAPI*)(HDC, LPCWSTR, int, LPRECT, UINT);
DrawTextW_t Original_DrawTextW = nullptr;

int WINAPI Hook_DrawTextW(HDC hdc, LPCWSTR str, int count, LPRECT rect, UINT format) {
    if (str) {
        int len = (count < 0) ? (int)wcslen(str) : count;
        if (len > 0) {
            // DrawText passa di solito una frase/paragrafo intero → caso ideale.
            std::wstring whole(str, len);
            DiagChiamata(L"DrawTextW", whole);
            if (kPassiveOverlayMode) {
                // Passivo: inoltra l'intera stringa all'overlay, poi disegna
                // normalmente (la guardia sotto evita la doppia cattura delle
                // ExtTextOutW interne del word-wrap).
                ForwardToOverlay(whole);
            } else if (kSpikeLogOnly) {
                LogLineW(L"[gs-hook/GDI] DRAWTEXT: " + whole + L"\n");
            } else if (g_translate && LooksSubstitutable(whole)) {
                std::wstring t = g_translate(whole);
                if (!t.empty() && t != whole) {
                    LogLineW(L"[gs-hook/GDI] SUBST(DrawText): " + whole + L" -> " + t + L"\n");
                    // Disegna il testo TRADOTTO. `g_translate` è deterministico,
                    // quindi anche l'eventuale chiamata con DT_CALCRECT (misura)
                    // riceve la stessa stringa → layout coerente col disegno.
                    // La guardia sopprime le ExtTextOutW interne del word-wrap,
                    // evitando che il nostro hook ritraduca il già-tradotto.
                    ++g_inDrawText;
                    int r = Original_DrawTextW(hdc, t.c_str(), (int)t.size(), rect, format);
                    --g_inDrawText;
                    return r;
                }
            }
        }
    }
    // Guardia: sopprime le ExtTextOutW interne generate dal word-wrap di DrawText.
    ++g_inDrawText;
    int result = Original_DrawTextW(hdc, str, count, rect, format);
    --g_inDrawText;
    return result;
}

// ═══ Varianti ANSI ═══════════════════════════════════════════════════════════
//
// PERCHÉ ESISTONO (22/08/2026, misurato su Yume Nikki).
// Il hook agganciava solo le funzioni Unicode. La tabella degli import di
// RPG_RT.exe dice che il gioco non le chiama MAI:
//
//     ExtTextOutA  PRESENTE      ExtTextOutW  assente
//     TextOutA     PRESENTE      TextOutW     assente
//     DrawTextA    PRESENTE      DrawTextW    assente
//
// E le A non passano dalle W: in gdi32 sono implementazioni separate che
// scendono entrambe al kernel. Agganciare solo la W non intercetta
// un'applicazione ANSI in nessun caso. RPG_RT è un binario Delphi pre-Unicode,
// quindi questo vale per TUTTO RPG Maker 2000/2003 — cioè proprio i giochi per
// cui questa sorgente di livello 2 esiste.

// La codepage NON è quella di sistema: è quella implicata dal charset del font
// selezionato nel DC. Un gioco giapponese su Windows italiano disegna byte
// Shift-JIS con un font SHIFTJIS_CHARSET, e interpretarli con la CP1252 di
// sistema produce testo plausibile e sbagliato — l'errore peggiore possibile
// qui, perché non somiglia a un errore.
UINT CodepageForDC(HDC hdc) {
    CHARSETINFO csi{};
    const UINT charset = GetTextCharset(hdc);
    if (charset != DEFAULT_CHARSET &&
        TranslateCharsetInfo(reinterpret_cast<DWORD*>(static_cast<UINT_PTR>(charset)),
                             &csi, TCI_SRCCHARSET)) {
        return csi.ciACP;
    }
    return CP_ACP;
}

std::wstring AnsiToWide(HDC hdc, const char* str, int count) {
    if (!str || count <= 0) return std::wstring();
    const UINT cp = CodepageForDC(hdc);
    const int need = MultiByteToWideChar(cp, 0, str, count, nullptr, 0);
    if (need <= 0) return std::wstring();
    std::wstring out(static_cast<size_t>(need), L'\0');
    MultiByteToWideChar(cp, 0, str, count, &out[0], need);
    return out;
}

// Guardia di rientranza per la famiglia ANSI. Non si sa, senza misurarlo, se
// TextOutA passi internamente da ExtTextOutA e DrawTextA da entrambe: dipende
// dalla versione di gdi32. Con questo contatore la cattura la fa solo la
// chiamata più esterna, quindi agganciarle tutte e tre è sicuro comunque vada,
// e il tag nel log dice quale porta d'ingresso ha visto il testo.
thread_local int g_inAnsiText = 0;

struct AnsiGuard {
    AnsiGuard()  { ++g_inAnsiText; }
    ~AnsiGuard() { --g_inAnsiText; }
};

// In modalità passiva si osserva e si inoltra all'overlay, senza toccare il
// disegno. La SOSTITUZIONE in-place qui NON è implementata di proposito:
// richiederebbe riconvertire la traduzione nella codepage del gioco, e una
// codepage giapponese non rappresenta le lettere accentate italiane. La
// conversione non fallisce: sostituisce i caratteri mancanti, e a schermo
// comparirebbe «perch?» invece di «perché». Meglio lasciare l'originale che
// disegnare una traduzione storpiata.
void OsservaAnsi(HDC hdc, const char* str, int count, const wchar_t* porta,
                 int x, int y, UINT options) {
    const std::wstring s = AnsiToWide(hdc, str, count);
    if (s.empty()) return;
    DiagChiamata(porta, s);

    if (kPassiveOverlayMode) {
        DrawCtx ctx = CaptureCtx(hdc, x, y, options);
        std::wstring closedText;
        DrawCtx      closedCtx;
        if (g_coalescer.Add(ctx, s, closedText, closedCtx) && !closedText.empty()) {
            ForwardToOverlay(closedText);
        }
    } else if (kSpikeLogOnly) {
        LogLineW(std::wstring(L"[gs-hook/GDI] ") + porta + L": " + s + L"\n");
    }
}

using ExtTextOutA_t = BOOL (WINAPI*)(HDC, int, int, UINT, const RECT*,
                                     LPCSTR, UINT, const INT*);
ExtTextOutA_t Original_ExtTextOutA = nullptr;

BOOL WINAPI Hook_ExtTextOutA(HDC hdc, int x, int y, UINT options, const RECT* rect,
                             LPCSTR str, UINT count, const INT* dx) {
    if (str && count > 0 && g_inAnsiText == 0 && !(options & ETO_GLYPH_INDEX)) {
        OsservaAnsi(hdc, str, (int)count, L"ExtTextOutA", x, y, options);
    }
    AnsiGuard g;
    return Original_ExtTextOutA(hdc, x, y, options, rect, str, count, dx);
}

using TextOutA_t = BOOL (WINAPI*)(HDC, int, int, LPCSTR, int);
TextOutA_t Original_TextOutA = nullptr;

BOOL WINAPI Hook_TextOutA(HDC hdc, int x, int y, LPCSTR str, int count) {
    if (str && count > 0 && g_inAnsiText == 0) {
        OsservaAnsi(hdc, str, count, L"TextOutA", x, y, 0);
    }
    AnsiGuard g;
    return Original_TextOutA(hdc, x, y, str, count);
}

using DrawTextA_t = int (WINAPI*)(HDC, LPCSTR, int, LPRECT, UINT);
DrawTextA_t Original_DrawTextA = nullptr;

int WINAPI Hook_DrawTextA(HDC hdc, LPCSTR str, int count, LPRECT rect, UINT format) {
    if (str && g_inAnsiText == 0) {
        const int len = (count < 0) ? (int)strlen(str) : count;
        if (len > 0) {
            // DrawText passa di norma una frase intera: va all'overlay così
            // com'è, senza passare dal coalescer che serve ai frammenti.
            const std::wstring whole = AnsiToWide(hdc, str, len);
            if (!whole.empty()) {
                DiagChiamata(L"DrawTextA", whole);
                if (kPassiveOverlayMode)      ForwardToOverlay(whole);
                else if (kSpikeLogOnly)       LogLineW(L"[gs-hook/GDI] DrawTextA: " + whole + L"\n");
            }
        }
    }
    AnsiGuard g;
    return Original_DrawTextA(hdc, str, count, rect, format);
}

// ─── Hook su EndPaint (user32) ───────────────────────────────────────────────
// A fine frame chiude l'ULTIMA riga ancora bufferizzata e la ridisegna tradotta:
// i suoi glifi sono stati soppressi e non sono ancora a schermo. Il DC di
// disegno (ps->hdc, == quello catturato nei frammenti) è ancora valido qui,
// prima che EndPaint lo rilasci.
using EndPaint_t = BOOL (WINAPI*)(HWND, const PAINTSTRUCT*);
EndPaint_t Original_EndPaint = nullptr;

BOOL WINAPI Hook_EndPaint(HWND hwnd, const PAINTSTRUCT* ps) {
    if (kPassiveOverlayMode) {
        // Idle-flush: chiude e inoltra la frase SOLO quando il typewriter è in
        // pausa (ferma da kLineIdleMs). Durante la digitazione NON flushiamo per
        // frame (spezzerebbe la frase), così la riga arriva all'overlay intera.
        std::wstring closedText;
        if (g_coalescer.FlushIfIdle(kLineIdleMs, closedText) && !closedText.empty()) {
            ForwardToOverlay(closedText);
        }
    } else if (!kSpikeLogOnly && g_translate && kGlyphSuppressRedraw) {
        std::wstring closedText;
        DrawCtx      closedCtx;
        if (g_coalescer.Flush(closedText, closedCtx) && !closedText.empty()) {
            RedrawClosedLine(closedText, closedCtx);
        }
    }
    return Original_EndPaint(hwnd, ps);
}

class GdiSource : public ITextSource {
public:
    const char* Name() const override { return "GDI (ExtTextOut/TextOut/DrawText, W+A)"; }
    Level GetLevel() const override { return Level::Rasterization; }

    bool IsApplicable() const override {
        return GetModuleHandleA("gdi32.dll") != nullptr; // praticamente sempre
    }

    Activation Activate(TranslateFn translate) override {
        HMODULE gdi = GetModuleHandleA("gdi32.dll");
        if (!gdi) return Activation::NotApplicable;
        g_translate = translate;

        HMODULE user32 = GetModuleHandleA("user32.dll");
        auto pExt  = GetProcAddress(gdi, "ExtTextOutW");
        auto pDraw = GetProcAddress(user32, "DrawTextW");
        auto pEnd  = GetProcAddress(user32, "EndPaint");

        bool any = false;
        if (pExt &&
            MH_CreateHook((LPVOID)pExt, (LPVOID)&Hook_ExtTextOutW,
                          (LPVOID*)&Original_ExtTextOutW) == MH_OK &&
            MH_EnableHook((LPVOID)pExt) == MH_OK) {
            any = true;
        }
        if (pDraw &&
            MH_CreateHook((LPVOID)pDraw, (LPVOID)&Hook_DrawTextW,
                          (LPVOID*)&Original_DrawTextW) == MH_OK &&
            MH_EnableHook((LPVOID)pDraw) == MH_OK) {
            any = true;
        }
        // Varianti ANSI: sono quelle che usano davvero i binari pre-Unicode
        // (tutto RPG Maker 2000/2003). Si agganciano tutte e tre perché non è
        // misurato quale passi internamente per quale, e la guardia di
        // rientranza rende innocua la sovrapposizione.
        struct { const char* nome; LPVOID hook; LPVOID* orig; } ansi[] = {
            { "ExtTextOutA", (LPVOID)&Hook_ExtTextOutA, (LPVOID*)&Original_ExtTextOutA },
            { "TextOutA",    (LPVOID)&Hook_TextOutA,    (LPVOID*)&Original_TextOutA    },
        };
        for (const auto& a : ansi) {
            auto p = GetProcAddress(gdi, a.nome);
            if (p && MH_CreateHook((LPVOID)p, a.hook, a.orig) == MH_OK &&
                MH_EnableHook((LPVOID)p) == MH_OK) {
                any = true;
            }
        }
        auto pDrawA = GetProcAddress(user32, "DrawTextA");
        if (pDrawA &&
            MH_CreateHook((LPVOID)pDrawA, (LPVOID)&Hook_DrawTextA,
                          (LPVOID*)&Original_DrawTextA) == MH_OK &&
            MH_EnableHook((LPVOID)pDrawA) == MH_OK) {
            any = true;
        }

        // EndPaint: serve a chiudere/ridisegnare l'ultima riga soppressa del frame
        // (suppress-and-redraw glifo-per-glifo). Non incide sull'attivazione.
        if (pEnd &&
            MH_CreateHook((LPVOID)pEnd, (LPVOID)&Hook_EndPaint,
                          (LPVOID*)&Original_EndPaint) == MH_OK) {
            MH_EnableHook((LPVOID)pEnd);
        }
        // Diagnostica dei blit: installata SOLO su richiesta esplicita, e non
        // conta per l'attivazione — è uno strumento d'indagine, non una
        // sorgente di testo.
        // Gli hook sui blit servono a due cose — la diagnostica e la cattura del
        // fotogramma — ma la funzione si aggancia UNA volta sola: due
        // MH_CreateHook sullo stesso indirizzo sono un guaio, non una comodità.
        if (DiagBlitAttiva() || DumpFotogrammiAttivo()) {
            struct { const char* nome; LPVOID hook; LPVOID* orig; } blit[] = {
                { "BitBlt",     (LPVOID)&Hook_BitBlt,     (LPVOID*)&Original_BitBlt     },
                { "StretchBlt", (LPVOID)&Hook_StretchBlt, (LPVOID*)&Original_StretchBlt },
            };
            for (const auto& b : blit) {
                auto p = GetProcAddress(gdi, b.nome);
                if (p && MH_CreateHook((LPVOID)p, b.hook, b.orig) == MH_OK) {
                    MH_EnableHook((LPVOID)p);
                }
            }
            if (DiagBlitAttiva())       LogLineW(L"[gs-hook/BLIT] diagnostica blit attiva (GS_HOOK_DIAG_BLIT=1)\n");
            if (DumpFotogrammiAttivo()) LogLineW(L"[gs-hook/FRAME] cattura al present attiva -> " + PrefissoDump() + L"-N.bmp\n");
        }

        return any ? Activation::Activated : Activation::Failed;
    }

    void Deactivate() override {
        if (Original_ExtTextOutW) MH_DisableHook((LPVOID)Original_ExtTextOutW);
        if (Original_DrawTextW)   MH_DisableHook((LPVOID)Original_DrawTextW);
        if (Original_BitBlt)      MH_DisableHook((LPVOID)Original_BitBlt);
        if (Original_StretchBlt)  MH_DisableHook((LPVOID)Original_StretchBlt);
        if (Original_ExtTextOutA) MH_DisableHook((LPVOID)Original_ExtTextOutA);
        if (Original_TextOutA)    MH_DisableHook((LPVOID)Original_TextOutA);
        if (Original_DrawTextA)   MH_DisableHook((LPVOID)Original_DrawTextA);
        if (Original_EndPaint)    MH_DisableHook((LPVOID)Original_EndPaint);
    }
};

} // namespace
} // namespace gs

GS_REGISTER_SOURCE(gs::GdiSource);
