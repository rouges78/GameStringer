/**
 * Vision-Language Models (VLM) Translator
 * 
 * Permette di inviare immagini (es. screenshot del gioco) direttamente
 * a modelli multimodali locali (LLaVA, Qwen-VL, Pixtral) per estrarre 
 * e tradurre il testo contestualmente in un singolo passaggio.
 */

export interface VlmTranslateOptions {
  imageBase64: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  model?: string; // Es. 'llava', 'qwen2-vl', 'minicpm-v'
}

export class VlmTranslator {
  private static readonly OLLAMA_URL = 'http://localhost:11434';

  /**
   * Verifica quali modelli Vision sono disponibili in locale su Ollama
   */
  public static async getAvailableVisionModels(): Promise<string[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    try {
      const res = await fetch(`${this.OLLAMA_URL}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return [];
      const data = await res.json();
      
      const allModels = (data.models || []).map((m: { name: string }) => m.name) as string[];
      // Filtra i modelli noti per essere multimodali (VLM)
      return allModels.filter(m => 
        m.includes('llava') || 
        m.includes('qwen2-vl') || 
        m.includes('minicpm-v') || 
        m.includes('pixtral') ||
        m.includes('vision')
      );
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Invia l'immagine al VLM per estrazione e traduzione contestuale
   */
  public static async translateImage(opts: VlmTranslateOptions): Promise<string> {
    const models = await this.getAvailableVisionModels();
    
    if (models.length === 0) {
      throw new Error('Nessun modello Vision (VLM) trovato su Ollama. Installa "llava" o "qwen2-vl".');
    }

    const selectedModel = opts.model && models.includes(opts.model) ? opts.model : models[0];
    
    // Rimuovi il prefisso data URI se presente (Ollama vuole solo il Base64 puro)
    const base64Data = opts.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const systemPrompt = `You are an expert video game localizer.
You will be provided with an image from a video game (UI, dialogue, menu).
1. Identify all the text in the image written in ${opts.sourceLanguage}.
2. Translate the text into ${opts.targetLanguage}.
3. Return ONLY the translated text. Do not describe the image. Do not add notes.
If there are multiple text elements, preserve their approximate spatial arrangement using newlines.
${opts.context ? `Context: ${opts.context}` : ''}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const res = await fetch(`${this.OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: `Translate the text in this image to ${opts.targetLanguage}.`,
              images: [base64Data] // Passiamo l'immagine direttamente al LLM
            }
          ],
          stream: false,
          options: { temperature: 0.1, num_predict: 1024 }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Ollama VLM Error: ${res.status}`);
      }

      const data = await res.json();
      let translated = data?.message?.content?.trim() || '';
      
      // Pulisci output spurio frequente nei VLM ("The text says: ...")
      translated = translated
        .replace(/^(The text says:|Translation:|Translated text:|Here is the translation:)\s*/i, '')
        .replace(/^["']|["']$/g, '');

      return translated;
    } catch (e: unknown) {
      clientLogger.error('[VLM] Errore elaborazione immagine:', e);
      throw e;
    }
  }
}
