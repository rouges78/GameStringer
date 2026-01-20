#include "ipc.h"
#include "utils.h"
#include <Windows.h>
#include <atomic>
#include <thread>
#include <queue>
#include <mutex>
#include <condition_variable>

namespace GSTranslator {
namespace IPC {

static HANDLE g_hPipe = INVALID_HANDLE_VALUE;
static std::atomic<bool> g_connected(false);
static std::atomic<bool> g_running(false);
static std::thread g_receiveThread;
static MessageCallback g_messageCallback = nullptr;

static std::mutex g_responseMutex;
static std::condition_variable g_responseCV;
static std::unordered_map<uint32_t, std::wstring> g_pendingResponses;
static std::atomic<uint32_t> g_nextRequestId(1);

bool Initialize() {
    // Prova a connettersi alla pipe di GameStringer
    for (int attempt = 0; attempt < 5; attempt++) {
        g_hPipe = CreateFileW(
            PIPE_NAME,
            GENERIC_READ | GENERIC_WRITE,
            0,
            nullptr,
            OPEN_EXISTING,
            0,
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
}

bool IsConnected() {
    return g_connected;
}

uint32_t SendTranslateRequest(const std::wstring& text) {
    if (!g_connected || g_hPipe == INVALID_HANDLE_VALUE) {
        return 0;
    }
    
    uint32_t requestId = g_nextRequestId++;
    
    // Prepara messaggio
    size_t textBytes = text.length() * sizeof(wchar_t);
    size_t totalSize = sizeof(IPCMessage) + textBytes;
    
    std::vector<uint8_t> buffer(totalSize);
    IPCMessage* msg = reinterpret_cast<IPCMessage*>(buffer.data());
    msg->type = MessageType::TRANSLATE_REQUEST;
    msg->requestId = requestId;
    msg->dataLength = (uint32_t)textBytes;
    memcpy(buffer.data() + sizeof(IPCMessage), text.c_str(), textBytes);
    
    // Invia
    DWORD bytesWritten;
    if (!WriteFile(g_hPipe, buffer.data(), (DWORD)totalSize, &bytesWritten, nullptr)) {
        Utils::LogError("Errore invio richiesta traduzione: %d", GetLastError());
        return 0;
    }
    
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

static void ReceiveThreadFunc() {
    std::vector<uint8_t> buffer(65536);
    
    while (g_running && g_connected) {
        DWORD bytesRead;
        BOOL success = ReadFile(
            g_hPipe,
            buffer.data(),
            (DWORD)buffer.size(),
            &bytesRead,
            nullptr
        );
        
        if (!success) {
            DWORD error = GetLastError();
            if (error == ERROR_BROKEN_PIPE || error == ERROR_PIPE_NOT_CONNECTED) {
                Utils::LogWarning("Connessione IPC persa");
                g_connected = false;
                break;
            }
            continue;
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
                
                // Notifica thread in attesa
                {
                    std::lock_guard<std::mutex> lock(g_responseMutex);
                    g_pendingResponses[msg->requestId] = translated;
                }
                g_responseCV.notify_all();
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
}

void StartReceiveThread() {
    if (g_running) return;
    
    g_running = true;
    g_receiveThread = std::thread(ReceiveThreadFunc);
}

void StopReceiveThread() {
    g_running = false;
    
    if (g_receiveThread.joinable()) {
        g_receiveThread.join();
    }
}

} // namespace IPC
} // namespace GSTranslator
