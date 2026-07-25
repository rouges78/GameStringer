/**
 * Indirizzo del server Ollama scelto dall'utente.
 *
 * Prima l'indirizzo era cablato nel backend Rust (`127.0.0.1:11434`) in nove
 * punti diversi e non esisteva alcuna impostazione: chi esegue Ollama su
 * un'altra porta, dentro WSL o Docker, o su un'altra macchina della rete non
 * aveva modo di dirlo all'app. Sei utenti l'hanno segnalato, uno annotando che
 * «ho provato porte e URL diversi, zero effetto» — perché venivano ignorati.
 *
 * Vuoto = rilevamento automatico lato Rust: variabile d'ambiente `OLLAMA_HOST`
 * (lo standard di Ollama) e poi `http://127.0.0.1:11434`.
 */
export function getOllamaBaseUrl(): string | undefined {
  try {
    const raw = localStorage.getItem('gameStringerSettings');
    if (!raw) return undefined;
    const url = JSON.parse(raw)?.translation?.ollamaUrl;
    const trimmed = typeof url === 'string' ? url.trim() : '';
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

/** Argomento pronto da fondere negli `invoke` dei comandi Ollama. */
export function ollamaArgs(): { baseUrl?: string } {
  const baseUrl = getOllamaBaseUrl();
  return baseUrl ? { baseUrl } : {};
}
