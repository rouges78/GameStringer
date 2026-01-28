/**
 * 🤖 AI Translation Service
 * 
 * Servizio per traduzioni intelligenti usando LLM locali (Ollama) o cloud (OpenAI, etc.)
 * Feature distintiva: context-aware gaming translations
 */

export interface AIProvider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  baseUrl: string;
  models: string[];
  isAvailable: boolean;
}

export interface GameTranslationContext {
  gameTitle: string;
  genre: 'rpg' | 'action' | 'horror' | 'adventure' | 'strategy' | 'simulation' | 'puzzle' | 'sports' | 'racing' | 'visual_novel';
  setting: string;
  tone: 'serious' | 'comedic' | 'dark' | 'epic' | 'casual' | 'mysterious';
  era: 'medieval' | 'modern' | 'futuristic' | 'fantasy' | 'historical';
  targetAudience: 'all' | 'teen' | 'mature';
  glossary?: Record<string, string>;
  characterVoices?: Record<string, {
    personality: string;
    speechStyle: string;
    formality: 'formal' | 'informal' | 'mixed';
  }>;
}

export interface AITranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: GameTranslationContext;
  textType?: 'dialogue' | 'ui' | 'item' | 'quest' | 'lore' | 'system' | 'tutorial';
  speaker?: string;
  maxLength?: number;
  preserveFormatting?: boolean;
  alternatives?: number;
}

export interface AITranslationResult {
  translation: string;
  alternatives: string[];
  confidence: number;
  reasoning?: string;
  suggestedGlossary?: Record<string, string>;
  warnings?: string[];
  tokensUsed: number;
  provider: string;
  model: string;
  processingTime: number;
}

export interface OllamaModel {
  name: string;
  size: string;
  modified_at: string;
  digest: string;
}

const DEFAULT_PROVIDERS: AIProvider[] = [
  {
    id: 'ollama',
    name: 'Ollama (Locale)',
    type: 'local',
    baseUrl: 'http://localhost:11434',
    models: [
      // 🆕 Specializzati Traduzioni
      'translategemma',      // Modello ottimizzato per traduzioni
      // 🆕 Nuovi modelli 2026
      'glm-4.7-flash',       // Veloce, basso consumo memoria
      'glm-4.7',             // GLM completo
      'deepseek-v3.2',       // Ultimo DeepSeek
      'kimi-k2.5',           // Kimi avanzato
      'deepseek-ocr',        // OCR specializzato
      // Modelli consolidati
      'llama3.2', 'qwen2.5', 'gemma2', 'mistral', 'phi3'
    ],
    isAvailable: false
  },
  {
    id: 'qwen3',
    name: 'Qwen 3 (Lingue Asiatiche)',
    type: 'local',
    baseUrl: 'http://localhost:11434',
    models: ['qwen3:32b', 'qwen3:14b', 'qwen3:8b', 'qwen3:4b', 'qwen3', 'qwen2.5:14b', 'qwen2.5:7b', 'qwen2.5'],
    isAvailable: false
  },
  {
    id: 'nllb',
    name: 'NLLB-200 (200 Lingue)',
    type: 'cloud',
    baseUrl: 'https://api-inference.huggingface.co',
    models: ['nllb-200-distilled-600M'],
    isAvailable: true
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Locale)',
    type: 'local',
    baseUrl: 'http://localhost:1234',
    models: [],
    isAvailable: false
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    isAvailable: true
  }
];

class AITranslationService {
  private providers: AIProvider[] = [...DEFAULT_PROVIDERS];
  private currentProvider: string = 'ollama';
  private currentModel: string = 'llama3.2';
  private ollamaModels: OllamaModel[] = [];

  /**
   * Verifica disponibilità Ollama
   */
  async checkOllamaAvailability(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const data = await response.json();
        this.ollamaModels = data.models || [];
        
        const ollamaProvider = this.providers.find(p => p.id === 'ollama');
        if (ollamaProvider) {
          ollamaProvider.isAvailable = true;
          ollamaProvider.models = this.ollamaModels.map(m => m.name);
        }
        
        return true;
      }
      return false;
    } catch {
      const ollamaProvider = this.providers.find(p => p.id === 'ollama');
      if (ollamaProvider) {
        ollamaProvider.isAvailable = false;
      }
      return false;
    }
  }

  /**
   * Verifica disponibilità LM Studio
   */
  async checkLMStudioAvailability(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const lmProvider = this.providers.find(p => p.id === 'lmstudio');
        if (lmProvider) {
          lmProvider.isAvailable = true;
          lmProvider.models = data.data?.map((m: any) => m.id) || [];
        }
        return true;
      }
      return false;
    } catch {
      const lmProvider = this.providers.find(p => p.id === 'lmstudio');
      if (lmProvider) {
        lmProvider.isAvailable = false;
      }
      return false;
    }
  }

  /**
   * Ottieni tutti i provider disponibili
   */
  async getAvailableProviders(): Promise<AIProvider[]> {
    await Promise.all([
      this.checkOllamaAvailability(),
      this.checkLMStudioAvailability()
    ]);
    return this.providers;
  }

  /**
   * Ottieni modelli Ollama installati
   */
  getOllamaModels(): OllamaModel[] {
    return this.ollamaModels;
  }

  /**
   * Imposta provider e modello corrente
   */
  setProvider(providerId: string, model?: string): void {
    this.currentProvider = providerId;
    if (model) {
      this.currentModel = model;
    }
  }

  /**
   * Genera il prompt di sistema per traduzioni gaming
   */
  private buildSystemPrompt(context?: GameTranslationContext): string {
    let prompt = `Sei un traduttore esperto specializzato in videogiochi. 
Il tuo compito è tradurre testi di gioco mantenendo:
- Il tono e lo stile appropriato al genere
- La terminologia gaming corretta
- Le sfumature culturali
- La lunghezza simile all'originale quando possibile

REGOLE IMPORTANTI:
1. NON tradurre variabili come {player_name}, %s, $1, etc.
2. Mantieni i tag HTML/XML intatti
3. Preserva la punteggiatura speciale del gioco
4. Usa la terminologia italiana standard per i videogiochi`;

    if (context) {
      prompt += `\n\nCONTESTO DEL GIOCO:
- Titolo: ${context.gameTitle}
- Genere: ${context.genre}
- Ambientazione: ${context.setting}
- Tono: ${context.tone}
- Era: ${context.era}
- Target: ${context.targetAudience}`;

      if (context.glossary && Object.keys(context.glossary).length > 0) {
        prompt += `\n\nGLOSSARIO (usa SEMPRE queste traduzioni):`;
        for (const [term, translation] of Object.entries(context.glossary)) {
          prompt += `\n- "${term}" → "${translation}"`;
        }
      }

      if (context.characterVoices) {
        prompt += `\n\nVOCI DEI PERSONAGGI:`;
        for (const [char, voice] of Object.entries(context.characterVoices)) {
          prompt += `\n- ${char}: ${voice.personality}, stile ${voice.speechStyle}, ${voice.formality}`;
        }
      }
    }

    return prompt;
  }

  /**
   * Genera il prompt utente per la traduzione
   */
  private buildUserPrompt(request: AITranslationRequest): string {
    let prompt = `Traduci il seguente testo da ${this.getLanguageName(request.sourceLanguage)} a ${this.getLanguageName(request.targetLanguage)}:

"${request.text}"`;

    if (request.textType) {
      const typeDescriptions: Record<string, string> = {
        dialogue: 'dialogo tra personaggi',
        ui: 'elemento interfaccia utente',
        item: 'nome/descrizione oggetto',
        quest: 'testo missione/quest',
        lore: 'testo narrativo/lore',
        system: 'messaggio di sistema',
        tutorial: 'istruzione tutorial'
      };
      prompt += `\n\nTipo di testo: ${typeDescriptions[request.textType] || request.textType}`;
    }

    if (request.speaker && request.context?.characterVoices?.[request.speaker]) {
      const voice = request.context.characterVoices[request.speaker];
      prompt += `\n\nPersonaggio parlante: ${request.speaker}
- Personalità: ${voice.personality}
- Stile: ${voice.speechStyle}`;
    }

    if (request.maxLength) {
      prompt += `\n\nLimite caratteri: ${request.maxLength} (cerca di rispettarlo)`;
    }

    if (request.alternatives && request.alternatives > 1) {
      prompt += `\n\nFornisci ${request.alternatives} alternative di traduzione, separate da "|||"`;
    }

    prompt += `\n\nRispondi SOLO con la traduzione, senza spiegazioni.`;

    return prompt;
  }

  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      'en': 'inglese',
      'it': 'italiano',
      'es': 'spagnolo',
      'fr': 'francese',
      'de': 'tedesco',
      'pt': 'portoghese',
      'ru': 'russo',
      'ja': 'giapponese',
      'ko': 'coreano',
      'zh': 'cinese'
    };
    return languages[code] || code;
  }

  /**
   * Traduzione con Ollama (locale)
   */
  async translateWithOllama(request: AITranslationRequest): Promise<AITranslationResult> {
    const startTime = Date.now();
    
    const systemPrompt = this.buildSystemPrompt(request.context);
    const userPrompt = this.buildUserPrompt(request);

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.currentModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            num_predict: 500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      const translation = data.message?.content?.trim() || '';
      
      // Parse alternatives se richieste
      const alternatives: string[] = [];
      if (request.alternatives && translation.includes('|||')) {
        const parts = translation.split('|||').map(p => p.trim());
        alternatives.push(...parts.slice(1));
      }

      return {
        translation: alternatives.length > 0 ? translation.split('|||')[0].trim() : translation,
        alternatives,
        confidence: 0.85,
        tokensUsed: data.eval_count || 0,
        provider: 'ollama',
        model: this.currentModel,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Ollama translation failed: ${error}`);
    }
  }

  /**
   * Traduzione con LM Studio (locale, compatibile OpenAI)
   */
  async translateWithLMStudio(request: AITranslationRequest): Promise<AITranslationResult> {
    const startTime = Date.now();
    
    const systemPrompt = this.buildSystemPrompt(request.context);
    const userPrompt = this.buildUserPrompt(request);

    try {
      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.currentModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`LM Studio error: ${response.status}`);
      }

      const data = await response.json();
      const translation = data.choices?.[0]?.message?.content?.trim() || '';

      return {
        translation,
        alternatives: [],
        confidence: 0.85,
        tokensUsed: data.usage?.total_tokens || 0,
        provider: 'lmstudio',
        model: this.currentModel,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`LM Studio translation failed: ${error}`);
    }
  }

  /**
   * Traduzione principale - seleziona automaticamente il provider
   */
  async translate(request: AITranslationRequest): Promise<AITranslationResult> {
    // Verifica disponibilità provider locali
    const ollamaAvailable = await this.checkOllamaAvailability();
    const lmStudioAvailable = await this.checkLMStudioAvailability();

    // Priorità: Ollama > LM Studio > Cloud
    if (this.currentProvider === 'ollama' && ollamaAvailable) {
      return this.translateWithOllama(request);
    }
    
    if (this.currentProvider === 'lmstudio' && lmStudioAvailable) {
      return this.translateWithLMStudio(request);
    }

    // Fallback a Ollama se disponibile
    if (ollamaAvailable) {
      this.currentProvider = 'ollama';
      return this.translateWithOllama(request);
    }

    // Fallback a LM Studio se disponibile
    if (lmStudioAvailable) {
      this.currentProvider = 'lmstudio';
      return this.translateWithLMStudio(request);
    }

    throw new Error('Nessun provider AI disponibile. Installa Ollama o LM Studio per traduzioni AI locali.');
  }

  /**
   * Traduzione batch con AI
   */
  async translateBatch(
    texts: string[],
    request: Omit<AITranslationRequest, 'text'>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<AITranslationResult[]> {
    const results: AITranslationResult[] = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.translate({
          ...request,
          text: texts[i]
        });
        results.push(result);
      } catch (error) {
        results.push({
          translation: texts[i],
          alternatives: [],
          confidence: 0,
          warnings: [`Translation failed: ${error}`],
          tokensUsed: 0,
          provider: 'none',
          model: 'none',
          processingTime: 0
        });
      }
      
      onProgress?.(i + 1, texts.length);
      
      // Small delay to avoid overwhelming local LLM
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Suggerisci termini per glossario basandosi sul testo
   */
  async suggestGlossaryTerms(
    texts: string[],
    context: GameTranslationContext
  ): Promise<Record<string, string>> {
    const prompt = `Analizza questi testi di un gioco ${context.genre} e suggerisci termini che dovrebbero avere una traduzione consistente.

Testi:
${texts.slice(0, 20).map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Rispondi in formato JSON con coppie "termine_inglese": "traduzione_italiana_suggerita"
Includi solo termini gaming-specific o importanti per la consistenza.`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.currentModel,
          prompt,
          stream: false,
          format: 'json'
        })
      });

      if (response.ok) {
        const data = await response.json();
        try {
          return JSON.parse(data.response);
        } catch {
          return {};
        }
      }
    } catch {
      // Ignore errors for suggestions
    }
    
    return {};
  }
}

export const aiTranslationService = new AITranslationService();
export default aiTranslationService;
