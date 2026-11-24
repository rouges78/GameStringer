/**
 * Nome con cui chiamare un modello Ollama, scelto fra quelli installati.
 *
 * Ollama risolve un nome senza tag come `:latest`: chi ha installato solo
 * `translategemma:12b` riceve 404 se l'app chiede `translategemma`. Qui si
 * preferisce il nome esatto (o `:latest`), altrimenti la prima variante con
 * tag della stessa famiglia. Se non c'è nulla, null.
 */
export function pickInstalledModel(installed: string[], family: string): string | null {
  if (installed.includes(family)) return family;
  if (installed.includes(`${family}:latest`)) return `${family}:latest`;
  return installed.find((name) => name.startsWith(`${family}:`)) ?? null;
}

/** Tutte le varianti installate di una famiglia, nell'ordine di Ollama. */
export function installedVariants(installed: string[], family: string): string[] {
  return installed.filter((name) => name === family || name.startsWith(`${family}:`));
}
