#pragma once
//
// gs_frame_share.h — il formato con cui gs-hook pubblica i fotogrammi.
//
// QUESTO FILE È IL CONTRATTO. La controparte che lo legge è
// `src-tauri/src/commands/game_frame.rs`: se qui cambia un campo, là va
// cambiato lo stesso, e il numero di versione serve proprio a far fallire in
// modo esplicito chi si dimentica. Il progetto ha già collezionato IPC in cui
// mancava un lato; qui i due lati nascono insieme e hanno un test che li mette
// uno di fronte all'altro.
//
// PERCHÉ MEMORIA CONDIVISA E NON UNA PIPE. Un fotogramma è grosso e va sempre
// SOSTITUITO, mai accodato: al consumatore interessa l'ultimo, non la storia.
// Una pipe accumulerebbe fotogrammi vecchi che nessuno vuole, e basterebbe un
// lettore lento per riempire il buffer e bloccare il gioco. Un buffer che si
// sovrascrive non può ingolfarsi: se il lettore è lento, salta dei fotogrammi,
// che è esattamente il comportamento giusto.
//
// PERCHÉ NESSUNA RICHIESTA. Non c'è un canale «dammi un fotogramma». Il
// produttore pubblica, il consumatore legge quando vuole. Un percorso di
// richiesta significherebbe che il thread di rendering del gioco aspetta
// qualcuno, e un consumatore fermo diventerebbe un gioco fermo.
//
#include <cstdint>

namespace gs {
namespace frame {

// 'G','S','F','R' in little-endian. Un lettore che apre la mappatura sbagliata
// se ne accorge subito invece di interpretare byte a caso come pixel.
constexpr uint32_t kMagic = 0x52465347u;

// Da alzare a ogni modifica del formato. Il lettore rifiuta ciò che non conosce.
constexpr uint32_t kVersione = 1;

// Unico formato per ora: 8 bit per canale, ordine BGR**X** come lo restituisce
// GDI, righe dall'ALTO in basso. La conversione la fa il consumatore, che sa
// cosa gli serve. Due dettagli che vanno dichiarati qui perché sbagliarli
// produce un'immagine plausibile invece di un errore:
//
//   - IL QUARTO BYTE NON È ALPHA. Le DIB a 32 bit di GDI lo lasciano a zero:
//     è riempimento. Copiarlo come alpha dà un fotogramma corretto nei colori
//     e completamente trasparente — misurato, 5180 pixel giusti e nessuno
//     visibile.
//   - LE RIGHE VANNO DALL'ALTO IN BASSO. `GetDIBits` con altezza positiva le
//     restituisce dal basso, che è il verso del formato BMP; per il resto del
//     mondo è capovolto. Il produttore chiede quindi altezza NEGATIVA e
//     pubblica dall'alto. Anche questo è stato misurato al contrario prima di
//     essere scritto qui.
constexpr uint32_t kFormatoBGRA32 = 0;

// I pixel iniziano qui. Fisso e generoso: aggiungere un campo
// all'intestazione non deve spostare i pixel, altrimenti un produttore nuovo e
// un consumatore vecchio si disallineano in silenzio.
constexpr uint32_t kOffsetPixel = 64;

// Nome della mappatura: `Local\` la tiene nella sessione dell'utente, senza i
// privilegi che `Global\` richiede. Il PID del gioco fa parte del nome perché
// più giochi possono essere agganciati insieme.
//   Local\gs-hook-frame-<pid>
constexpr wchar_t kPrefissoNome[] = L"Local\\gs-hook-frame-";

// Disposizione in memoria condivisa. Campi a larghezza fissa e in un ordine che
// dà lo stesso allineamento a 32 e a 64 bit: il gioco può essere x86 mentre il
// backend è x64, e i due DEVONO vedere gli stessi offset.
//
//   0  magic          4
//   4  versione       4
//   8  larghezza      4
//  12  altezza        4
//  16  formato        4
//  20  byteFotogramma 4
//  24  scrittura      8   (allineato a 8 in entrambe le architetture)
//  32  pid            4
//  36  riservato      4
//  64  pixel...
//
struct Intestazione {
    uint32_t magic;
    uint32_t versione;
    uint32_t larghezza;
    uint32_t altezza;
    uint32_t formato;
    uint32_t byteFotogramma;
    uint64_t scrittura;      // vedi sotto: contatore in stile seqlock
    uint32_t pid;
    uint32_t riservato;
};
static_assert(sizeof(Intestazione) == 40, "il formato è un contratto: non cambiarne la dimensione senza alzare kVersione");

// IL CONTATORE `scrittura`, che è la parte che evita letture stracciate.
//
// Il produttore scrive mentre il consumatore legge: senza precauzioni il
// lettore può prendere metà del fotogramma vecchio e metà del nuovo, e il
// risultato **sembra un'immagine**, quindi l'errore non si nota. È lo stesso
// modo di sbagliare che questo progetto ha già incontrato: un risultato
// plausibile e falso.
//
// Convenzione (seqlock):
//   dispari → scrittura IN CORSO, i pixel non sono affidabili
//   pari    → stabile
//
// Il lettore legge il contatore, copia, rilegge: la copia vale solo se il
// valore era pari ED è rimasto identico. Nessun lock, quindi un consumatore
// che muore non può bloccare il gioco — che con un mutex condiviso, invece,
// succederebbe.

// Avvia la pubblicazione per questo processo. Idempotente.
// Ritorna false se la mappatura non si può creare (e allora non si pubblica,
// senza far fallire nient'altro).
bool Inizializza(uint32_t larghezza, uint32_t altezza);

// Pubblica un fotogramma BGRA32. `byte` deve valere larghezza*altezza*4.
// Silenziosa e a costo fisso: viene chiamata dal thread di rendering del gioco.
void Pubblica(const void* pixel, uint32_t byte);

// Chiude la mappatura. Da chiamare allo spegnimento del hook.
void Chiudi();

} // namespace frame
} // namespace gs
