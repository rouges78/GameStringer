/**
 * Il blob `gameStringerSettings` è condiviso. La pagina Impostazioni ne gestisce
 * solo una parte, i campi del suo stato iniziale; il resto lo scrivono altri,
 * direttamente in localStorage e anche mentre la pagina è aperta: gli endpoint
 * personalizzati (translation.endpoints), il preset di catena, le opzioni Ollama,
 * lo smart router, il confronto multi-LLM, la lingua dell'interfaccia
 * (system.language).
 *
 * Fino al 01/10/2026 il Salva scriveva l'intero stato della pagina, cioè la
 * fotografia del blob presa al mount: un endpoint digitato nella stessa visita
 * tornava al valore vecchio, o spariva, su localStorage e su disco. Ora il Salva
 * parte dal blob CORRENTE e ci scrive sopra solo i campi che la pagina possiede.
 *
 * @param current il blob così com'è adesso
 * @param page    lo stato della pagina
 * @param owned   la forma dei campi della pagina (lo stato iniziale): per ogni
 *                sezione contano solo le chiavi, non i valori
 */
export function mergePageSettings(
  current: Record<string, unknown>,
  page: Record<string, unknown>,
  owned: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...current };
  for (const [section, fields] of Object.entries(owned)) {
    const base = asRecord(current[section]);
    const mine = asRecord(page[section]);
    const next: Record<string, unknown> = { ...base };
    for (const key of Object.keys(asRecord(fields))) {
      if (key in mine) next[key] = mine[key];
    }
    out[section] = next;
  }
  return out;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
