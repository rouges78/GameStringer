#include "ipc.h"
#include "utils.h"
#include <Windows.h>
#include <atomic>
#include <thread>
#include <deque>
#include <mutex>
#include <condition_variable>
#include <unordered_map>
#include <vector>

namespace GSTranslator {
namespace IPC {

// ─── Perché I/O OVERLAPPED (2026-08-21) ──────────────────────────────────────
// Un handle di pipe aperto SENZA FILE_FLAG_OVERLAPPED è sincrono: il kernel
// serializza ogni operazione su quel file object. Con il receive thread fermo
// dentro ReadFile, una WriteFile dal thread di rendering si accoda dietro la
// lettura e non parte MAI — e la lettura si sblocca solo quando il server
// risponde, cosa che non può fare perché la richiesta non è mai partita.
// Attesa circolare: il gioco si freeza all'istante (misurato con la testapp
// GDI, UI non responsiva e zero richieste lato server).
//
// Quindi: handle overlapped + un thread di invio dedicato. Il thread di
// rendering si limita ad accodare (mutex + condvar, zero I/O), così il
// percorso di disegno non blocca mai — vedi Translate() in translator.cpp.

static HANDLE g_hPipe = INVALID_HANDLE_VALUE;
static std::atomic<bool> g_connected(false);
static std::atomic<bool> g_running(false);
static std::thread g_receiveThread;
static std::thread g_sendThread;
static MessageCallback g_messageCallback = nullptr;

static std::mutex g_responseMutex;
static std::condition_variable g_responseCV;
static std::unordered_map<uint32_t, std::wstring> g_pendingResponses;
// requestId -> testo originale della richiesta in volo (per il callback async)
static std::unordered_map<uint32_t, std::wstring> g_inflightOriginals;
static TranslationArrivedCallback g_translationArrived = nullptr;
static std::atomic<uint32_t> g_nextRequestId(1);

// Coda di invio: il render thread accoda, g_sendThread scrive.
static std::mutex g_sendMutex;
static std::condition_variable g_sendCV;
static std::deque<std::vector<uint8_t>> g_sendQueue;

// Tetto della coda: se il backend non drena, si scartano le richieste più
// vecchie invece di gonfiare all'infinito la memoria del gioco.
static constexpr size_t kMaxQueuedFrames = 256;

// Attesa massima per una singola operazione overlapped prima di ricontrollare
// g_running (permette l'uscita pulita dei thread).
static constexpr DWORD kIoPollMs = 200;

bool Initialize() {
    // Prova a connettersi alla pipe di GameStringer
    for (int attempt = 0; attempt < 5; attempt++) {
        g_hPipe = CreateFileW(
            PIPE_NAME,
            GENERIC_READ | GENERIC_WRITE,
            0,
            nullptr,
            OPEN_EXISTING,
            FILE_FLAG_OVERLAPPED,   // obbligatorio: vedi nota in testa al file
            nullptr
        );

        if (g_hPipe != INVALID_HANDLE_VALUE) {
            break;
        }

        if (GetLastError() == ERROR_PIPE_BUSY) {
            if (!WaitNamedPipeW(PIPE_NAME, 2000)) {
                continue;
            }
        } else {
            Sleep(500);
        }
    }

    if (g_hPipe == INVALID_HANDLE_VALUE) {
        Utils::LogWarning("Impossibile connettersi a GameStringer pipe");
        return false;
    }

    // Imposta modalità message
    DWORD mode = PIPE_READMODE_MESSAGE;
    SetNamedPipeHandleState(g_hPipe, &mode, nullptr, nullptr);

    g_connected = true;
    Utils::LogInfo("Connesso a GameStringer via IPC");

    return true;
}

void Shutdown() {
    g_connected = false;

    if (g_hPipe != INVALID_HANDLE_VALUE) {
        CloseHandle(g_hPipe);
        g_hPipe = INVALID_HANDLE_VALUE;
    }

    {
        std::lock_guard<std::mutex> lock(g_responseMutex);
        g_inflightOriginals.clear();
    }
    {
        std::lock_guard<std::mutex> lock(g_sendMutex);
        g_sendQueue.clear();
    }
}

bool IsConnected() {
    return g_connected;
}

uint32_t SendTranslateRequest(const std::wstring& text) {
    if (!g_connected || g_hPipe == INVALID_HANDLE_VALUE) {
        return 0;
    }

    uint32_t requestId = g_nextRequestId++;

    // Registra l'originale in volo: serve al receive thread per consegnare
    // la risposta col testo di partenza (il protocollo porta solo requestId).
    {
        std::lock_guard<std::mutex> lock(g_responseMutex);
        g_inflightOriginals[requestId] = text;
    }

    // Prepara messaggio
    size_t textBytes = text.length() * sizeof(wchar_t);
    size_t totalSize = sizeof(IPCMessage) + textBytes;

    std::vector<uint8_t> buffer(totalSize);
    IPCMessage* msg = reinterpret_cast<IPCMessage*>(buffer.data());
    msg->type = MessageType::TRANSLATE_REQUEST;
    msg->requestId = requestId;
    msg->dataLength = (uint32_t)textBytes;
    memcpy(buffer.data() + sizeof(IPCMessage), text.c_str(), textBytes);

    // Accoda e torna subito: questo gira sul thread di rendering.
    {
        std::lock_guard<std::mutex> lock(g_sendMutex);
        if (g_sendQueue.size() >= kMaxQueuedFrames) {
            g_sendQueue.pop_front();   // scarta la più vecchia
        }
        g_sendQueue.push_back(std::move(buffer));
    }
    g_sendCV.notify_one();

    return requestId;
}

bool ReceiveTranslateResponse(uint32_t requestId, std::wstring& translatedText, uint32_t timeoutMs) {
    std::unique_lock<std::mutex> lock(g_responseMutex);

    // Aspetta risposta con timeout
    auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);

    while (g_pendingResponses.find(requestId) == g_pendingResponses.end()) {
        if (g_responseCV.wait_until(lock, deadline) == std::cv_status::timeout) {
            return false;
        }
    }

    translatedText = g_pendingResponses[requestId];
    g_pendingResponses.erase(requestId);

    return true;
}

void SendLog(const char* level, const std::string& message) {
    if (!g_connected) return;

    // TODO: Implementare invio log
}

void SendStats(uint64_t requests, uint64_t cacheHits, uint64_t errors) {
    if (!g_connected) return;

    // TODO: Implementare invio statistiche
}

void SetMessageCallback(MessageCallback callback) {
    g_messageCallback = callback;
}

void SetTranslationArrivedCallback(TranslationArrivedCallback callback) {
    std::lock_guard<std::mutex> lock(g_responseMutex);
    g_translationArrived = callback;
}

// Attende il completamento di un'operazione overlapped, ricontrollando
// g_running a intervalli così lo stop non resta appeso.
static bool WaitOverlapped(OVERLAPPED& ov, DWORD& bytes) {
    for (;;) {
        const DWORD w = WaitForSingleObject(ov.hEvent, kIoPollMs);
        if (w == WAIT_OBJECT_0) {
            return GetOverlappedResult(g_hPipe, &ov, &bytes, FALSE) != FALSE;
        }
        if (w != WAIT_TIMEOUT || !g_running || !g_connected) {
            CancelIoEx(g_hPipe, &ov);
            // Raccogli l'esito della cancellazione per non lasciare I/O appesa.
            GetOverlappedResult(g_hPipe, &ov, &bytes, TRUE);
            return false;
        }
    }
}

// Thread di invio: unico a scrivere sulla pipe, così il render thread non
// tocca mai l'I/O.
static void SendThreadFunc() {
    HANDLE hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!hEvent) return;

    while (g_running) {
        std::vector<uint8_t> frame;
        {
            std::unique_lock<std::mutex> lock(g_sendMutex);
            g_sendCV.wait(lock, [] { return !g_sendQueue.empty() || !g_running; });
            if (!g_running) break;
            frame = std::move(g_sendQueue.front());
            g_sendQueue.pop_front();
        }

        if (!g_connected || g_hPipe == INVALID_HANDLE_VALUE) continue;

        OVERLAPPED ov = {};
        ov.hEvent = hEvent;
        ResetEvent(hEvent);

        DWORD written = 0;
        if (!WriteFile(g_hPipe, frame.data(), (DWORD)frame.size(), &written, &ov)) {
            const DWORD err = GetLastError();
            if (err != ERROR_IO_PENDING) {
                Utils::LogError("Errore invio richiesta traduzione: %d", err);
                if (err == ERROR_BROKEN_PIPE || err == ERROR_NO_DATA) {
                    g_connected = false;
                }
                continue;
            }
            if (!WaitOverlapped(ov, written)) {
                continue;
            }
        }
    }

    CloseHandle(hEvent);
}

static void ReceiveThreadFunc() {
    std::vector<uint8_t> buffer(65536);
    HANDLE hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!hEvent) return;

    while (g_running && g_connected) {
        OVERLAPPED ov = {};
        ov.hEvent = hEvent;
        ResetEvent(hEvent);

        DWORD bytesRead = 0;
        if (!ReadFile(g_hPipe, buffer.data(), (DWORD)buffer.size(), &bytesRead, &ov)) {
            const DWORD error = GetLastError();
            if (error == ERROR_IO_PENDING) {
                if (!WaitOverlapped(ov, bytesRead)) {
                    if (!g_running || !g_connected) break;
                    continue;
                }
            } else if (error == ERROR_BROKEN_PIPE || error == ERROR_PIPE_NOT_CONNECTED) {
                Utils::LogWarning("Connessione IPC persa");
                g_connected = false;
                break;
            } else {
                continue;
            }
        }

        if (bytesRead < sizeof(IPCMessage)) {
            continue;
        }

        IPCMessage* msg = reinterpret_cast<IPCMessage*>(buffer.data());

        switch (msg->type) {
            case MessageType::TRANSLATE_RESPONSE: {
                // Estrai testo tradotto
                std::wstring translated(
                    reinterpret_cast<wchar_t*>(buffer.data() + sizeof(IPCMessage)),
                    msg->dataLength / sizeof(wchar_t)
                );

                std::wstring original;
                TranslationArrivedCallback callback;
                {
                    std::lock_guard<std::mutex> lock(g_responseMutex);
                    auto it = g_inflightOriginals.find(msg->requestId);
                    if (it != g_inflightOriginals.end()) {
                        original = it->second;
                        g_inflightOriginals.erase(it);
                    }
                    callback = g_translationArrived;
                    if (!callback) {
                        // Percorso blocking storico: notifica il thread in attesa
                        g_pendingResponses[msg->requestId] = translated;
                    }
                }

                if (callback && !original.empty()) {
                    callback(original, translated);   // fuori dal lock
                } else if (!callback) {
                    g_responseCV.notify_all();
                }
                break;
            }

            case MessageType::CONFIG_UPDATE:
                // TODO: Aggiorna configurazione
                break;

            case MessageType::SHUTDOWN:
                Utils::LogInfo("Ricevuto comando shutdown da GameStringer");
                g_running = false;
                break;

            default:
                if (g_messageCallback) {
                    g_messageCallback(msg->type,
                                     buffer.data() + sizeof(IPCMessage),
                                     msg->dataLength);
                }
                break;
        }
    }

    CloseHandle(hEvent);
}

// Avvia i thread di I/O (ricezione + invio). Il nome resta per compatibilità
// col chiamante storico in unreal-translator.
void StartReceiveThread() {
    if (g_running) return;

    g_running = true;
    g_receiveThread = std::thread(ReceiveThreadFunc);
    g_sendThread = std::thread(SendThreadFunc);
}

void StopReceiveThread() {
    g_running = false;
    g_sendCV.notify_all();

    // Sblocca le operazioni overlapped ancora in corso PRIMA del join
    // (l'handle viene chiuso dopo, in Shutdown).
    if (g_hPipe != INVALID_HANDLE_VALUE) {
        CancelIoEx(g_hPipe, nullptr);
    }

    if (g_receiveThread.joinable()) {
        g_receiveThread.join();
    }
    if (g_sendThread.joinable()) {
        g_sendThread.join();
    }
}

} // namespace IPC
} // namespace GSTranslator
