#pragma once
/**
 * IPC Client per comunicazione con GameStringer
 * 
 * Usa Named Pipes per comunicazione bidirezionale veloce.
 */

#include <windows.h>
#include <string>

#define PIPE_NAME L"\\\\.\\pipe\\GameStringerUETranslator"
#define PIPE_BUFFER_SIZE 65536

class IPCClient {
public:
    IPCClient() : m_hPipe(INVALID_HANDLE_VALUE), m_Connected(false) {}
    
    ~IPCClient() {
        Disconnect();
    }
    
    /**
     * Connette al server GameStringer
     */
    bool Connect() {
        if (m_Connected) return true;
        
        // Attendi che il pipe sia disponibile
        if (!WaitNamedPipeW(PIPE_NAME, 5000)) {
            return false;
        }
        
        // Connetti al pipe
        m_hPipe = CreateFileW(
            PIPE_NAME,
            GENERIC_READ | GENERIC_WRITE,
            0,
            NULL,
            OPEN_EXISTING,
            0,
            NULL
        );
        
        if (m_hPipe == INVALID_HANDLE_VALUE) {
            return false;
        }
        
        // Imposta modalità message
        DWORD dwMode = PIPE_READMODE_MESSAGE;
        SetNamedPipeHandleState(m_hPipe, &dwMode, NULL, NULL);
        
        m_Connected = true;
        return true;
    }
    
    /**
     * Disconnette dal server
     */
    void Disconnect() {
        if (m_hPipe != INVALID_HANDLE_VALUE) {
            CloseHandle(m_hPipe);
            m_hPipe = INVALID_HANDLE_VALUE;
        }
        m_Connected = false;
    }
    
    /**
     * Verifica se connesso
     */
    bool IsConnected() const {
        return m_Connected && m_hPipe != INVALID_HANDLE_VALUE;
    }
    
    /**
     * Richiede traduzione di un testo
     */
    std::wstring RequestTranslation(const std::wstring& text) {
        if (!IsConnected()) return text;
        
        // Prepara messaggio JSON
        std::string json = "{\"type\":\"translate\",\"text\":\"";
        
        // Converti wstring a UTF-8
        int size = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, NULL, 0, NULL, NULL);
        std::string utf8Text(size, 0);
        WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, &utf8Text[0], size, NULL, NULL);
        
        // Escape caratteri speciali JSON
        std::string escaped;
        for (char c : utf8Text) {
            if (c == '"') escaped += "\\\"";
            else if (c == '\\') escaped += "\\\\";
            else if (c == '\n') escaped += "\\n";
            else if (c == '\r') escaped += "\\r";
            else if (c == '\t') escaped += "\\t";
            else if (c != 0) escaped += c;
        }
        
        json += escaped + "\"}";
        
        // Invia richiesta
        DWORD bytesWritten;
        if (!WriteFile(m_hPipe, json.c_str(), (DWORD)json.size(), &bytesWritten, NULL)) {
            Disconnect();
            return text;
        }
        
        // Leggi risposta
        char buffer[PIPE_BUFFER_SIZE];
        DWORD bytesRead;
        if (!ReadFile(m_hPipe, buffer, sizeof(buffer) - 1, &bytesRead, NULL)) {
            Disconnect();
            return text;
        }
        
        buffer[bytesRead] = '\0';
        
        // Parse risposta JSON (semplificato - cerca "translated":"...")
        std::string response(buffer);
        size_t pos = response.find("\"translated\":\"");
        if (pos == std::string::npos) return text;
        
        pos += 14; // Lunghezza di "\"translated\":\""
        size_t endPos = response.find("\"", pos);
        if (endPos == std::string::npos) return text;
        
        std::string translatedUtf8 = response.substr(pos, endPos - pos);
        
        // Unescape JSON
        std::string unescaped;
        for (size_t i = 0; i < translatedUtf8.size(); i++) {
            if (translatedUtf8[i] == '\\' && i + 1 < translatedUtf8.size()) {
                char next = translatedUtf8[i + 1];
                if (next == 'n') { unescaped += '\n'; i++; }
                else if (next == 'r') { unescaped += '\r'; i++; }
                else if (next == 't') { unescaped += '\t'; i++; }
                else if (next == '"') { unescaped += '"'; i++; }
                else if (next == '\\') { unescaped += '\\'; i++; }
                else unescaped += translatedUtf8[i];
            } else {
                unescaped += translatedUtf8[i];
            }
        }
        
        // Converti UTF-8 a wstring
        int wsize = MultiByteToWideChar(CP_UTF8, 0, unescaped.c_str(), -1, NULL, 0);
        std::wstring result(wsize, 0);
        MultiByteToWideChar(CP_UTF8, 0, unescaped.c_str(), -1, &result[0], wsize);
        
        // Rimuovi null terminator extra
        if (!result.empty() && result.back() == 0) {
            result.pop_back();
        }
        
        return result;
    }
    
    /**
     * Processa messaggi in arrivo (comandi da GameStringer)
     */
    void ProcessMessages() {
        if (!IsConnected()) return;
        
        // Controlla se ci sono dati disponibili
        DWORD bytesAvailable = 0;
        if (!PeekNamedPipe(m_hPipe, NULL, 0, NULL, &bytesAvailable, NULL)) {
            return;
        }
        
        if (bytesAvailable == 0) return;
        
        // Leggi messaggio
        char buffer[PIPE_BUFFER_SIZE];
        DWORD bytesRead;
        if (!ReadFile(m_hPipe, buffer, sizeof(buffer) - 1, &bytesRead, NULL)) {
            return;
        }
        
        buffer[bytesRead] = '\0';
        
        // Parse comando - ignora per ora, gestito dal main
        (void)buffer;
    }

private:
    HANDLE m_hPipe;
    bool m_Connected;
};
