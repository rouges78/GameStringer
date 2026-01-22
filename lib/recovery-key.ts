/**
 * Recovery Key System
 * Genera e valida recovery key di 12 parole per il recupero password
 */

// Wordlist semplificata (parole comuni inglesi facili da ricordare)
const WORDLIST = [
  'apple', 'banana', 'cherry', 'dragon', 'eagle', 'falcon', 'garden', 'harbor',
  'island', 'jungle', 'kingdom', 'lemon', 'mountain', 'nature', 'ocean', 'planet',
  'queen', 'river', 'sunset', 'tiger', 'umbrella', 'valley', 'winter', 'yellow',
  'zebra', 'anchor', 'bridge', 'castle', 'desert', 'engine', 'forest', 'glacier',
  'helmet', 'igloo', 'jacket', 'kitten', 'lantern', 'marble', 'needle', 'orange',
  'palace', 'quartz', 'rainbow', 'silver', 'thunder', 'urban', 'velvet', 'wizard',
  'alpha', 'beta', 'gamma', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
  'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
  'yankee', 'zulu', 'arrow', 'blade', 'crown', 'diamond', 'ember', 'flame',
  'ghost', 'hunter', 'iron', 'jewel', 'knight', 'lunar', 'mystic', 'ninja',
  'onyx', 'phoenix', 'quest', 'raven', 'storm', 'titan', 'ultra', 'vortex',
  'wolf', 'xenon', 'youth', 'zenith', 'azure', 'bronze', 'coral', 'dusk',
  'eclipse', 'frost', 'golden', 'horizon', 'ivory', 'jade', 'karma', 'lotus',
  'meteor', 'nebula', 'oasis', 'prism', 'quantum', 'radiant', 'sapphire', 'topaz',
  'unity', 'vivid', 'wisdom', 'zephyr', 'amber', 'blaze', 'crystal', 'dawn',
];

/**
 * Genera una recovery key di 12 parole casuali
 */
export function generateRecoveryKey(): string[] {
  const words: string[] = [];
  const usedIndices = new Set<number>();
  
  while (words.length < 12) {
    const randomIndex = Math.floor(Math.random() * WORDLIST.length);
    if (!usedIndices.has(randomIndex)) {
      usedIndices.add(randomIndex);
      words.push(WORDLIST[randomIndex]);
    }
  }
  
  return words;
}

/**
 * Converte array di parole in stringa formattata
 */
export function recoveryKeyToString(words: string[]): string {
  return words.join(' ');
}

/**
 * Converte stringa in array di parole
 */
export function stringToRecoveryKey(keyString: string): string[] {
  return keyString.toLowerCase().trim().split(/\s+/);
}

/**
 * Valida se una recovery key è nel formato corretto
 */
export function isValidRecoveryKeyFormat(words: string[]): boolean {
  if (words.length !== 12) return false;
  return words.every(word => WORDLIST.includes(word.toLowerCase()));
}

/**
 * Genera hash della recovery key per storage sicuro
 * Usa SHA-256 via Web Crypto API
 */
export async function hashRecoveryKey(words: string[]): Promise<string> {
  const keyString = words.join('-').toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(keyString);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Verifica se una recovery key corrisponde all'hash salvato
 */
export async function verifyRecoveryKey(words: string[], storedHash: string): Promise<boolean> {
  const inputHash = await hashRecoveryKey(words);
  return inputHash === storedHash;
}

/**
 * Salva l'hash della recovery key in localStorage
 */
export async function saveRecoveryKeyHash(profileId: string, words: string[]): Promise<void> {
  const hash = await hashRecoveryKey(words);
  localStorage.setItem(`gs_recovery_${profileId}`, hash);
}

/**
 * Ottiene l'hash della recovery key salvato
 */
export function getRecoveryKeyHash(profileId: string): string | null {
  return localStorage.getItem(`gs_recovery_${profileId}`);
}

/**
 * Verifica la recovery key per un profilo
 */
export async function verifyProfileRecoveryKey(profileId: string, words: string[]): Promise<boolean> {
  const storedHash = getRecoveryKeyHash(profileId);
  if (!storedHash) return false;
  return verifyRecoveryKey(words, storedHash);
}

/**
 * Rimuove la recovery key di un profilo
 */
export function removeRecoveryKey(profileId: string): void {
  localStorage.removeItem(`gs_recovery_${profileId}`);
}

/**
 * Formatta la recovery key per la visualizzazione (gruppi di 3)
 */
export function formatRecoveryKeyForDisplay(words: string[]): string[][] {
  const groups: string[][] = [];
  for (let i = 0; i < words.length; i += 3) {
    groups.push(words.slice(i, i + 3));
  }
  return groups;
}
