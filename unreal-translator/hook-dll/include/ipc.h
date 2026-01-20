#pragma once

#include <string>
#include <functional>

namespace GSTranslator {
namespace IPC {

// Comunicazione con GameStringer via Named Pipe

constexpr const wchar_t* PIPE_NAME = L"\\\\.\\pipe\\GameStringerTranslator";

// Messaggi IPC
enum class MessageType : uint32_t {
    // DLL -> GameStringer
    TRANSLATE_REQUEST = 1,
    CACHE_SYNC = 2,
    LOG_MESSAGE = 3,
    STATS_UPDATE = 4,
    
    // GameStringer -> DLL
    TRANSLATE_RESPONSE = 101,
    CONFIG_UPDATE = 102,
    SHUTDOWN = 103
};

struct IPCMessage {
    MessageType type;
    uint32_t requestId;
    uint32_t dataLength;
    // Data follows...
};

// Inizializza connessione IPC
bool Initialize();

// Chiude connessione
void Shutdown();

// Verifica se connesso a GameStringer
bool IsConnected();

// Invia richiesta di traduzione
// Ritorna requestId, 0 se errore
uint32_t SendTranslateRequest(const std::wstring& text);

// Riceve risposta traduzione (blocking con timeout)
bool ReceiveTranslateResponse(uint32_t requestId, std::wstring& translatedText, uint32_t timeoutMs = 5000);

// Invia log a GameStringer
void SendLog(const char* level, const std::string& message);

// Invia statistiche
void SendStats(uint64_t requests, uint64_t cacheHits, uint64_t errors);

// Callback per messaggi in arrivo da GameStringer
using MessageCallback = std::function<void(MessageType type, const void* data, uint32_t length)>;
void SetMessageCallback(MessageCallback callback);

// Thread di ricezione messaggi
void StartReceiveThread();
void StopReceiveThread();

} // namespace IPC
} // namespace GSTranslator
