/**
 * Lore Assistant — Chat RAG locale per contesto del gioco.
 * 
 * Mantiene un log vettoriale dei dialoghi estratti e permette all'utente
 * di chiedere all'IA domande sulla lore del gioco ("Chi è questo Re?").
 * Trasforma GameStringer da "traduttore" a "compagno di co-op".
 */

export interface DialogueEntry {
  id: string;
  text: string;
  speaker?: string;
  timestamp: number;
  scene?: string;
  chapter?: string;
  embedding?: number[];
}

export interface LoreQuery {
  question: string;
  language: string;
}

export interface LoreResponse {
  answer: string;
  relevantDialogues: DialogueEntry[];
  confidence: number;
}

class LoreAssistantEngine {
  private dialogueLog: DialogueEntry[] = [];
  private maxEntries = 2000;
  private storageKey = 'gs_lore_dialogues';

  constructor() {
    this.load();
  }

  /**
   * Aggiungi un dialogo al log
   */
  addDialogue(text: string, speaker?: string, scene?: string, chapter?: string) {
    const entry: DialogueEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      text: text.trim(),
      speaker,
      timestamp: Date.now(),
      scene,
      chapter,
    };

    // Evita duplicati consecutivi
    const last = this.dialogueLog[this.dialogueLog.length - 1];
    if (last && last.text === entry.text && last.speaker === entry.speaker) return;

    this.dialogueLog.push(entry);
    if (this.dialogueLog.length > this.maxEntries) {
      this.dialogueLog = this.dialogueLog.slice(-this.maxEntries);
    }
    this.save();
  }

  /**
   * Cerca dialoghi rilevanti per una domanda (TF-IDF semplificato)
   */
  searchRelevant(query: string, topK: number = 10): DialogueEntry[] {
    const queryTerms = this.tokenize(query);
    
    const scored = this.dialogueLog.map(entry => {
      const entryTerms = this.tokenize(entry.text + ' ' + (entry.speaker || ''));
      let score = 0;
      for (const term of queryTerms) {
        if (entryTerms.includes(term)) score += 1;
        // Bonus per match esatto di nomi
        if (entry.speaker && entry.speaker.toLowerCase().includes(term)) score += 3;
      }
      // Recency boost
      const ageHours = (Date.now() - entry.timestamp) / (1000 * 60 * 60);
      score *= Math.max(0.5, 1 - ageHours / 48); // Decay over 48h
      return { entry, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.entry);
  }

  /**
   * Chiedi all'IA usando il contesto dei dialoghi (RAG)
   */
  async ask(query: LoreQuery): Promise<LoreResponse> {
    const relevant = this.searchRelevant(query.question, 15);
    
    const contextBlock = relevant.map((d, i) => {
      const speaker = d.speaker ? `[${d.speaker}]` : '';
      const scene = d.scene ? ` (Scene: ${d.scene})` : '';
      return `${i + 1}. ${speaker} "${d.text}"${scene}`;
    }).join('\n');

    const systemPrompt = `You are a Lore Assistant for a video game. The player is asking about the game's story, characters, or world.
You have access to the dialogue history extracted from the game. Use ONLY the provided dialogues to answer.
If you don't have enough information, say so honestly.
Answer in ${query.language}. Be concise but helpful, like a knowledgeable companion.`;

    const userPrompt = `Game dialogue history (most relevant):
${contextBlock || '(No dialogue history yet)'}

Player's question: ${query.question}

Answer based ONLY on the dialogues above. If you can identify character names, relationships, or plot points from the text, mention them.`;

    // Try Ollama first, then cloud fallback
    const answer = await this.callLLM(systemPrompt, userPrompt);

    return {
      answer,
      relevantDialogues: relevant.slice(0, 5),
      confidence: relevant.length > 3 ? 0.9 : relevant.length > 0 ? 0.6 : 0.2,
    };
  }

  /**
   * Chiama l'LLM (Ollama → Gemini → OpenAI fallback)
   */
  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    // 1. Ollama
    try {
      const resp = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2:3b',
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          stream: false,
          options: { temperature: 0.5, num_predict: 500 }
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.response) return data.response.trim();
      }
    } catch {}

    // 2. Gemini (free)
    const { getSecureKey } = await import('@/lib/secure-key-store');
    const geminiKey = await getSecureKey('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 500 }
            }),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text.trim();
        }
      } catch {}
    }

    return "Non ho abbastanza contesto per rispondere. Continua a giocare e riprova più tardi — memorizzerò altri dialoghi.";
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  getStats() {
    const speakers = new Set(this.dialogueLog.filter(d => d.speaker).map(d => d.speaker));
    const scenes = new Set(this.dialogueLog.filter(d => d.scene).map(d => d.scene));
    return {
      totalDialogues: this.dialogueLog.length,
      uniqueSpeakers: speakers.size,
      speakers: Array.from(speakers),
      scenes: Array.from(scenes),
      oldestEntry: this.dialogueLog[0]?.timestamp || null,
      newestEntry: this.dialogueLog[this.dialogueLog.length - 1]?.timestamp || null,
    };
  }

  getRecentDialogues(count: number = 20): DialogueEntry[] {
    return this.dialogueLog.slice(-count);
  }

  clear() {
    this.dialogueLog = [];
    this.save();
  }

  private save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.dialogueLog));
    } catch {}
  }

  private load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.dialogueLog = JSON.parse(saved);
      }
    } catch {}
  }
}

export const loreAssistant = typeof window !== 'undefined' ? new LoreAssistantEngine() : null;
