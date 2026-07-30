/**
 * Fidelity / anti-censura prompt block — OPT-IN, spento di default.
 *
 * Motivazione: sui giochi single-player la scena di traduzione amatoriale si
 * lamenta spesso di LLM che "ammorbidiscono", riassumono o rifiutano di
 * tradurre contenuti maturi già PRESENTI nell'originale (violenza, turpiloquio,
 * temi adulti), aggiungendo warning o commenti morali non richiesti. Questo
 * blocco istruisce i provider LLM a localizzare fedelmente e per intero un'opera
 * di fiction, senza censurare né inventare nulla.
 *
 * Vincoli di sicurezza/design:
 * - È OPT-IN: senza `uncensored: true` non viene mai iniettato (default OFF).
 * - Non chiede di generare NUOVI contenuti: impone di tradurre SOLO ciò che è
 *   presente nella sorgente ("never invent, add, or expand"). È fedeltà, non
 *   ampliamento.
 * - I provider MT puri (DeepL, MyMemory, Lingva, NLLB, LibreTranslate…) ignorano
 *   i prompt: il blocco ha effetto solo sui provider LLM-capable.
 */

/**
 * Testo del blocco (inglese, come il resto dei prompt di sistema).
 * Esportato per essere testabile e riusabile dalla pipeline agentica/reflection.
 */
export const FIDELITY_PROMPT_BLOCK = `Content fidelity (lawful single-player fiction localization):
- Translate ALL source content faithfully and completely, including mature themes, profanity, violence, and sexual content that is ALREADY present in the source.
- Do NOT censor, soften, omit, summarize, or bowdlerize. Preserve the original register, tone, and intensity.
- Do NOT add content warnings, disclaimers, moral commentary, or meta notes.
- Never refuse and never replace text with an apology or a placeholder. Output only the translation.
- Translate only what is present in the source. Never invent, add, or expand content.`;

/**
 * Ritorna il blocco anti-censura se abilitato, altrimenti stringa vuota.
 * @param enabled true per iniettare il blocco (opt-in). undefined/false → '' .
 */
export function buildFidelityPromptBlock(enabled: boolean | undefined): string {
  return enabled ? FIDELITY_PROMPT_BLOCK : '';
}
