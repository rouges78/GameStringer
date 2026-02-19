/**
 * Pipeline Agentica per Traduzioni (Translator + QA)
 * 
 * Questa pipeline utilizza due agenti (ruoli LLM) per garantire la qualità:
 * 1. Agente Traduttore: Effettua la traduzione iniziale.
 * 2. Agente Revisore (QA): Controlla la lunghezza, i tag di formattazione e le variabili.
 * 
 * Se il revisore trova errori critici (es. variabili %s o {0} mancanti), 
 * costringe il traduttore a correggere il testo, fino a un massimo di tentativi.
 */

import { getApiKeys } from './ai-translate-direct';

export interface AgenticOptions {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  maxLengthRatio?: number; // Es. 1.5 significa che la traduzione non può superare il 150% della lunghezza originale
  maxAttempts?: number;
}

export interface AgenticResult {
  translation: string;
  attempts: number;
  qaPassed: boolean;
  finalFeedback?: string;
}

export class AgenticTranslator {
  private static readonly OLLAMA_URL = 'http://localhost:11434';

  private static async getModel(): Promise<string> {
    const keys = getApiKeys();
    const preferredModel = keys.ollamaModel;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.OLLAMA_URL}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) return 'llama3';
      const data = await res.json();
      const available = (data.models || []).map((m: any) => m.name) as string[];
      
      if (available.length === 0) return 'llama3';
      
      if (preferredModel && available.some(n => n.startsWith(preferredModel))) {
        return available.find(n => n.startsWith(preferredModel))!;
      }
      
      // Preferisci modelli istruiti per compiti complessi come il QA
      const specialized = available.find(n => n.includes('tower') || n.includes('qwen') || n.includes('llama3') || n.includes('mistral'));
      return specialized || available[0];
    } catch (e) {
      return 'llama3'; // Fallback teorico
    }
  }

  private static async callOllama(system: string, user: string, model: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const res = await fetch(`${this.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: false,
        options: { temperature: 0.1, num_predict: 2048 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Ollama Error: ${res.status}`);
    const data = await res.json();
    return data?.message?.content?.trim() || '';
  }

  /**
   * Estrae le variabili comuni (es. %s, %d, {0}, {name}) da una stringa.
   */
  private static extractVariables(text: string): string[] {
    const regex = /(%[sd]\b|\{[a-zA-Z0-9_]+\})/g;
    const matches = text.match(regex);
    return matches ? Array.from(new Set(matches)) : [];
  }

  /**
   * Esegue la pipeline agentica completa (Traduzione -> QA -> Correzione).
   */
  public static async translate(opts: AgenticOptions): Promise<AgenticResult> {
    const maxAttempts = opts.maxAttempts || 3;
    const maxLengthRatio = opts.maxLengthRatio || 1.6;
    const model = await this.getModel();

    // 1. Agente Traduttore - Prompt
    const translatorSystem = `You are an expert video game localizer. Translate the text from ${opts.sourceLanguage} to ${opts.targetLanguage}.
Rules:
- Output ONLY the translated text. Do not add explanations.
- Preserve all variables (like %s, {0}) and HTML/XML tags.
- Keep the tone appropriate for a video game.`;

    let currentTranslation = '';
    let attempt = 1;
    let qaPassed = false;
    let feedback = '';

    // Esegui la prima traduzione
    let userPrompt = `Source text:\n${opts.text}\n\n${opts.context ? `Context: ${opts.context}\n\n` : ''}Translation:`;
    
    try {
      currentTranslation = await this.callOllama(translatorSystem, userPrompt, model);
      // Pulizia iniziale
      currentTranslation = currentTranslation.replace(/^(Translation|Output):\s*/i, '').replace(/^["']|["']$/g, '');

      while (attempt <= maxAttempts) {
        // 2. Agente Revisore (QA) - Logica Deterministica + LLM
        
        // A. QA Deterministico (molto più affidabile del LLM per i tag)
        const sourceVars = this.extractVariables(opts.text);
        const targetVars = this.extractVariables(currentTranslation);
        
        const missingVars = sourceVars.filter(v => !targetVars.includes(v));
        const extraVars = targetVars.filter(v => !sourceVars.includes(v));
        
        const isTooLong = currentTranslation.length > (opts.text.length * maxLengthRatio) && opts.text.length > 5;
        
        let qaErrors: string[] = [];
        
        if (missingVars.length > 0) {
          qaErrors.push(`CRITICAL: Missing variables in translation: ${missingVars.join(', ')}`);
        }
        if (extraVars.length > 0) {
          qaErrors.push(`CRITICAL: Extra variables added that are not in source: ${extraVars.join(', ')}`);
        }
        if (isTooLong) {
          qaErrors.push(`WARNING: Translation is too long for game UI (${currentTranslation.length} chars vs original ${opts.text.length} chars). Keep it concise.`);
        }

        // B. Se ci sono errori deterministici, non chiamiamo l'agente QA ma passiamo direttamente al fix
        if (qaErrors.length > 0) {
          qaPassed = false;
          feedback = qaErrors.join('\n');
        } else {
          // C. QA Agente LLM per la fluidità e il senso
          const qaSystem = `You are a strict Quality Assurance reviewer for game localization.
Review the translation from ${opts.sourceLanguage} to ${opts.targetLanguage}.
Source: "${opts.text}"
Translation: "${currentTranslation}"
${opts.context ? `Context: ${opts.context}` : ''}

Evaluate:
1. Does it sound natural and fit a video game?
2. Did it hallucinate or add meaning not present in the source?
3. Did it break any game markup?

If the translation is PERFECT, reply ONLY with "PASS".
If there are issues, reply with a short, direct instruction to the translator on what to fix (e.g. "Fix the tone to be more aggressive. Remove the extra punctuation.").`;

          const qaResponse = await this.callOllama(qaSystem, "Evaluate the translation.", model);
          
          if (qaResponse.trim().toUpperCase() === 'PASS' || qaResponse.includes('PASS')) {
            qaPassed = true;
            break; // Usciamo dal loop, traduzione perfetta
          } else {
            qaPassed = false;
            feedback = qaResponse;
          }
        }

        // Se siamo qui, il QA ha fallito. Chiediamo al Traduttore di correggere.
        attempt++;
        if (attempt > maxAttempts) break;

        console.log(`[Agentic QA] Attempt ${attempt - 1} failed. Feedback: ${feedback}`);

        const correctionPrompt = `Your previous translation had issues.
Source text: "${opts.text}"
Your translation: "${currentTranslation}"

QA Feedback to fix:
${feedback}

Provide the corrected translation. Output ONLY the corrected text.`;

        currentTranslation = await this.callOllama(translatorSystem, correctionPrompt, model);
        currentTranslation = currentTranslation.replace(/^(Translation|Output):\s*/i, '').replace(/^["']|["']$/g, '');
      }

    } catch (e: any) {
      console.error('[Agentic Pipeline] Error:', e);
      // Fallback
      if (!currentTranslation) currentTranslation = opts.text; 
    }

    return {
      translation: currentTranslation,
      attempts: Math.min(attempt, maxAttempts),
      qaPassed,
      finalFeedback: feedback
    };
  }
}
