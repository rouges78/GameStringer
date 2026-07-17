/**
 * Placeholder Guard — protezione garantita di tag, variabili e control code.
 *
 * Obiettivo del task "Protezione tag/variabili garantita": assicurare che i
 * token che il gioco interpreta ({player}, %s, control code RPG Maker, ruby,
 * tag rich-text, entità HTML, ecc.) SOPRAVVIVANO alla traduzione, con un
 * auto-fix deterministico (zero costi, nessuna chiamata LLM) usato dal pass
 * di reflection e dalla pipeline.
 *
 * Copertura dei token:
 * - printf: %s %d %.2f %x %c %% e posizionali %1$s (flag/larghezza/precisione/lunghezza)
 * - graffe: {name} {0} {{mustache}} ${var} #{ruby}
 * - control code (RPG Maker/escape): \C[3] \V[1] \N[1] \I[5] \n \t \. \| \! \{ \}
 * - tag rich-text/HTML: <b> </b> <color=#fff>
 * - Unreal/label: [[T0]]
 * - BBCode: [b] [color=red] [ruby=かんじ] [/ruby]
 * - ruby giapponese (aozora): ｜漢字《かんじ》 e 《かんじ》
 * - entità HTML: &amp; &#123;
 *
 * NB: l'estrazione è deliberatamente conservativa nel non toccare il testo:
 * l'auto-fix ripristina i token MANCANTI (append o restore posizionale) ma non
 * cancella contenuto per rimuovere token "inventati" — quelli restano segnalati
 * dall'agente di review.
 */

/**
 * Pattern unico dei token protetti. L'ordine delle alternative conta: le forme
 * più specifiche/lunghe vanno prima di quelle generiche che iniziano con lo
 * stesso carattere (es. [[..]] prima di [..], {{..}} prima di {..}).
 */
export const PLACEHOLDER_PATTERN =
  // ruby aozora: ｜base《reading》 oppure 《reading》
  '｜[^｜《》\\n]{1,40}《[^《》\\n]{1,40}》|《[^《》\\n]{1,40}》' +
  // printf: %% e conversioni con posizionale/flag/larghezza/precisione/lunghezza
  // (niente flag "spazio": eviterebbe falsi positivi come "50% fatto";
  //  '@' incluso per il formato stile iOS/Obj-C "%@")
  '|%%|%(?:\\d+\\$)?[-+0#]*\\d*(?:\\.\\d+)?(?:hh|h|ll|l|L|z|j|t)?[diouxXeEfFgGaAcspn@]' +
  // control code / escape: \C[3] \N[1] \V[2] \I[5] \n \t ... e single-char \. \| \! \> \< \^ \$ \{ \}
  '|\\\\[A-Za-z]+(?:\\[[^\\]]*\\])?|\\\\[.|!<>^${}]' +
  // tag rich-text / HTML: <b> </b> <color=#fff>
  '|<[^<>]{1,60}>' +
  // Unreal / label a doppia parentesi: [[T0]]
  '|\\[\\[[^\\]]+\\]\\]' +
  // BBCode: [b] [color=red] [ruby=かんじ] [/ruby]
  '|\\[/?[a-zA-Z][^\\]]{0,40}\\]' +
  // graffe: {{mustache}} ${var} #{ruby} {name} {0}
  '|\\{\\{[^{}]+\\}\\}|\\$\\{[^{}]+\\}|#\\{[^{}]+\\}|\\{[a-zA-Z0-9_.:\\-]+\\}' +
  // entità HTML: &amp; &#123;
  '|&#?[a-zA-Z0-9]{2,10};';

/** Regex globale riutilizzabile per l'estrazione (lastIndex resettato in extract). */
export const PLACEHOLDER_REGEX = new RegExp(PLACEHOLDER_PATTERN, 'g');

/** Estrae i token protetti da una stringa, in ordine di apparizione (con duplicati). */
export function extractPlaceholders(text: string): string[] {
  if (!text) return [];
  PLACEHOLDER_REGEX.lastIndex = 0;
  return text.match(PLACEHOLDER_REGEX) || [];
}

/** Vero se la stringa contiene almeno un token protetto. */
export function hasPlaceholders(text: string): boolean {
  if (!text) return false;
  const re = new RegExp(PLACEHOLDER_PATTERN);
  return re.test(text);
}

export interface PlaceholderDiff {
  /** Token presenti nel sorgente ma mancanti (per conteggio) nella traduzione. */
  missing: string[];
  /** Token presenti nella traduzione ma assenti (per conteggio) dal sorgente. */
  extra: string[];
  /** Token del sorgente, in ordine. */
  src: string[];
  /** Token della traduzione, in ordine. */
  tr: string[];
}

/** Confronta i token di sorgente e traduzione per multiset (conteggio). */
export function diffPlaceholders(source: string, translation: string): PlaceholderDiff {
  const src = extractPlaceholders(source);
  const tr = extractPlaceholders(translation);

  // missing: scorri i token sorgente scalando quelli presenti nella traduzione
  const trPool = new Map<string, number>();
  for (const p of tr) trPool.set(p, (trPool.get(p) || 0) + 1);
  const missing: string[] = [];
  for (const p of src) {
    const c = trPool.get(p) || 0;
    if (c > 0) trPool.set(p, c - 1);
    else missing.push(p);
  }

  // extra: scorri i token traduzione scalando quelli presenti nel sorgente
  const srcPool = new Map<string, number>();
  for (const p of src) srcPool.set(p, (srcPool.get(p) || 0) + 1);
  const extra: string[] = [];
  for (const p of tr) {
    const c = srcPool.get(p) || 0;
    if (c > 0) srcPool.set(p, c - 1);
    else extra.push(p);
  }

  return { missing, extra, src, tr };
}

/** Vero se tutti i token del sorgente sopravvivono (per conteggio) nella traduzione. */
export function placeholdersPreserved(source: string, translation: string): boolean {
  return diffPlaceholders(source, translation).missing.length === 0;
}

/**
 * Auto-fix deterministico: ripristina i token protetti persi dalla traduzione.
 *
 * Strategia (conservativa, non distruttiva):
 *  1. Se sorgente e traduzione hanno lo stesso multiset di token → nessuna
 *     modifica (anche se riordinati: il riordino è spesso corretto per la lingua).
 *  2. Stesso NUMERO di token ma identità diverse (es. il modello ha cambiato
 *     %d in %s, o ha alterato un tag) → restore POSIZIONALE: i token della
 *     traduzione vengono rimpiazzati, in ordine, con quelli del sorgente.
 *  3. Token mancanti (la traduzione ne ha meno) → i mancanti vengono aggiunti
 *     in coda, così sopravvivono comunque (la posizione può richiedere review).
 *  4. Solo token "inventati" in più e nessuno mancante → testo lasciato intatto.
 */
export function autoFixPlaceholders(source: string, translation: string): string {
  if (!source || translation == null) return translation;
  const { missing, extra, src, tr } = diffPlaceholders(source, translation);
  if (missing.length === 0 && extra.length === 0) return translation;

  // Caso 2: stesso numero di token ma diversi → restore posizionale
  if (src.length > 0 && src.length === tr.length) {
    let k = 0;
    const re = new RegExp(PLACEHOLDER_PATTERN, 'g');
    return translation.replace(re, () => src[k++] ?? '');
  }

  // Caso 3: alcuni token del sorgente mancano → append in coda (sopravvivenza)
  if (missing.length > 0) {
    const base = translation.replace(/\s+$/, '');
    return base.length > 0 ? `${base} ${missing.join(' ')}` : missing.join(' ');
  }

  // Caso 4: solo token inventati in più → non cancellare contenuto
  return translation;
}
