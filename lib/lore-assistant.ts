/**
 * Lore Assistant — Chat RAG locale per contesto del gioco.
 * 
 * Mantiene un log vettoriale dei dialoghi estratti e permette all'utente
 * di chiedere all'IA domande sulla lore del gioco ("Chi è questo Re?").
 * Trasforma GameStringer da "traduttore" a "compagno di co-op".
 */

import { ollamaFetch } from './ai/ollama-http';
import { clientLogger } from './client-logger';
import {
  detectEmbeddingModel,
  embedTexts,
  cosineSimilarity,
  getSemanticTMMode,
} from './ai/semantic-retriever';

// Retrieval semantico dei dialoghi (embeddings locali via Ollama).
const LORE_VEC_STORE_KEY = 'gs-lore-vec:v1'; // IndexedDB (idb-keyval): { model, vectors }
const LORE_MAX_EMBED_PER_CALL = 128;         // voci embeddate per singolo ask() (incrementale)
const LORE_EMBED_CHUNK = 64;                 // dimensione chunk verso /api/embed
const LORE_MIN_SIM = 0.35;                   // soglia cosine minima (pre-boost)
const LORE_SPEAKER_BONUS = 0.15;             // bonus se la domanda nomina il personaggio

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
  /** Come sono stati recuperati i dialoghi rilevanti: embeddings o TF-IDF. */
  retrieval?: 'semantic' | 'keyword';
}

class LoreAssistantEngine {
  private dialogueLog: DialogueEntry[] = [];
  private maxEntries = 2000;
  private storageKey = 'gs_lore_dialogues';

  // Store vettoriale semantico (cache ricostruibile, persistita in IndexedDB).
  private loreVectors = new Map<string, number[]>();
  private loreVectorModel: string | null = null;
  private vectorsLoaded = false;

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

  /** Carica i vettori persistiti (IndexedDB) una sola volta per sessione. */
  private async ensureVectorsLoaded(): Promise<void> {
    if (this.vectorsLoaded) return;
    this.vectorsLoaded = true;
    try {
      const { get } = await import('idb-keyval');
      const stored = (await get(LORE_VEC_STORE_KEY)) as
        | { model: string; vectors: Record<string, number[]> }
        | undefined;
      if (stored && stored.vectors) {
        this.loreVectorModel = stored.model;
        this.loreVectors = new Map(Object.entries(stored.vectors));
      }
    } catch {
      // IndexedDB non disponibile → si lavora solo in memoria per la sessione
    }
  }

  /** Persiste i vettori (cache ricostruibile: il fallimento non è mai un errore). */
  private async saveVectors(): Promise<void> {
    try {
      const { set } = await import('idb-keyval');
      await set(LORE_VEC_STORE_KEY, {
        model: this.loreVectorModel,
        vectors: Object.fromEntries(this.loreVectors),
      });
    } catch {
      // resta valido in memoria
    }
  }

  /**
   * Retrieval SEMANTICO dei dialoghi (embeddings locali via Ollama), layer sopra
   * il keyword TF-IDF: trova dialoghi concettualmente pertinenti anche quando le
   * parole non combaciano (parafrasi, sinonimi, riferimenti indiretti).
   *
   * Indicizzazione lazy e incrementale, vettori persistiti in IndexedDB (NON in
   * localStorage: eviterebbe di gonfiare il log e sforare la quota). Ritorna:
   *  - un array (anche vuoto) se il retrieval semantico è disponibile ed è stato eseguito;
   *  - null se non disponibile (modalità 'off', Ollama giù, nessun modello embedding,
   *    o embedding fallito) → il chiamante ricade sul TF-IDF (fail-open).
   */
  private async searchRelevantSemantic(query: string, topK: number): Promise<DialogueEntry[] | null> {
    if (getSemanticTMMode() === 'off') return null;
    if (this.dialogueLog.length === 0) return [];

    const model = await detectEmbeddingModel();
    if (!model) return null;

    await this.ensureVectorsLoaded();

    // Reset se è cambiato il modello (spazio vettoriale / dimensioni diversi)
    if (this.loreVectorModel && this.loreVectorModel !== model) {
      this.loreVectors.clear();
    }
    this.loreVectorModel = model;

    // Pruning dei vettori orfani (dialoghi rimossi o troncati a maxEntries)
    const liveIds = new Set(this.dialogueLog.map(d => d.id));
    let dirty = false;
    for (const id of Array.from(this.loreVectors.keys())) {
      if (!liveIds.has(id)) { this.loreVectors.delete(id); dirty = true; }
    }

    // Embedding incrementale delle voci mancanti (cap per chiamata: non blocca la chat)
    const missing = this.dialogueLog.filter(d => !this.loreVectors.has(d.id));
    const toEmbed = missing.slice(0, LORE_MAX_EMBED_PER_CALL);
    for (let i = 0; i < toEmbed.length; i += LORE_EMBED_CHUNK) {
      const chunk = toEmbed.slice(i, i + LORE_EMBED_CHUNK);
      const texts = chunk.map(d => (d.speaker ? `${d.speaker}: ${d.text}` : d.text));
      const vectors = await embedTexts(model, texts, 'document');
      if (!vectors) break; // fail-open: si riprova al prossimo ask()
      for (let j = 0; j < chunk.length; j++) {
        this.loreVectors.set(chunk[j].id, vectors[j]);
        dirty = true;
      }
    }
    if (dirty) await this.saveVectors();

    if (this.loreVectors.size === 0) return null; // embedding fallito del tutto → keyword

    // Embedding della query
    const queryVecs = await embedTexts(model, [query], 'query');
    if (!queryVecs || !queryVecs[0]) return null;
    const queryVec = queryVecs[0];
    const qLower = query.toLowerCase();
    const now = Date.now();

    const scored = this.dialogueLog.map(entry => {
      const vec = this.loreVectors.get(entry.id);
      if (!vec) return { entry, score: -1 };
      let score = cosineSimilarity(queryVec, vec);
      if (score < LORE_MIN_SIM) return { entry, score: -1 };
      // Bonus se la domanda nomina esplicitamente il personaggio
      if (entry.speaker && qLower.includes(entry.speaker.toLowerCase())) score += LORE_SPEAKER_BONUS;
      // Recency boost (come nel TF-IDF): i dialoghi recenti pesano di più sul "qui e ora"
      const ageHours = (now - entry.timestamp) / (1000 * 60 * 60);
      score *= Math.max(0.5, 1 - ageHours / 48);
      return { entry, score };
    });

    const results = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.entry);

    clientLogger.debug(`[Lore] Retrieval semantico: ${results.length} dialoghi (modello: ${model})`);
    return results;
  }

  /**
   * Pre-indicizzazione ("indicizza ora") del lore: embedda TUTTI i dialoghi
   * non ancora vettorializzati, senza il cap per-ask, così il primo ask()
   * trova l'indice pronto. Fail-open: ritorna ok:false se il semantico è
   * spento o nessun modello embedding è disponibile.
   */
  async warmLoreIndex(
    onProgress?: (indexed: number, total: number) => void
  ): Promise<{ ok: boolean; model: string | null; total: number; indexed: number }> {
    if (getSemanticTMMode() === 'off') return { ok: false, model: null, total: 0, indexed: 0 };
    const model = await detectEmbeddingModel(true);
    if (!model) return { ok: false, model: null, total: 0, indexed: 0 };

    await this.ensureVectorsLoaded();
    if (this.loreVectorModel && this.loreVectorModel !== model) {
      this.loreVectors.clear();
    }
    this.loreVectorModel = model;

    const missing = this.dialogueLog.filter(d => !this.loreVectors.has(d.id));
    const total = missing.length;
    let indexed = 0;
    let dirty = false;
    for (let i = 0; i < missing.length; i += LORE_EMBED_CHUNK) {
      const chunk = missing.slice(i, i + LORE_EMBED_CHUNK);
      const texts = chunk.map(d => (d.speaker ? `${d.speaker}: ${d.text}` : d.text));
      const vectors = await embedTexts(model, texts, 'document');
      if (!vectors) break; // Ollama caduto a metà → stop, si riprende al prossimo warm/ask
      for (let j = 0; j < chunk.length; j++) {
        this.loreVectors.set(chunk[j].id, vectors[j]);
        dirty = true;
        indexed++;
      }
      onProgress?.(indexed, total);
    }
    if (dirty) await this.saveVectors();
    return { ok: true, model, total, indexed };
  }

  /**
   * Chiedi all'IA usando il contesto dei dialoghi (RAG)
   */
  async ask(query: LoreQuery): Promise<LoreResponse> {
    // Retrieval semantico se disponibile, altrimenti (o se non trova nulla) TF-IDF.
    const semantic = await this.searchRelevantSemantic(query.question, 15);
    const usedSemantic = semantic !== null && semantic.length > 0;
    const relevant = usedSemantic ? semantic! : this.searchRelevant(query.question, 15);
    
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
      retrieval: usedSemantic ? 'semantic' : 'keyword',
    };
  }

  /**
   * Chiama l'LLM (Ollama → Gemini → OpenAI fallback)
   */
  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    // 1. Ollama
    try {
      const resp = await ollamaFetch('/api/generate', {
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

    // 2. Gemini (free) — default gemini-3.5-flash, override via NEXT_PUBLIC_GEMINI_MODEL
    const { getSecureKey } = await import('@/lib/secure-key-store');
    const geminiKey = await getSecureKey('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const loreGeminiModel =
          (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GEMINI_MODEL) ||
          'gemini-3.5-flash';
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${loreGeminiModel}:generateContent?key=${geminiKey}`,
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

