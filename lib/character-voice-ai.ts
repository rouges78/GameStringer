/**
 * Character Voice AI - Profili personalità per traduzioni contestuali
 * Ogni personaggio ha un profilo che influenza come vengono tradotti i suoi dialoghi
 */

import { translateSingleWithFallback } from './ai-translate-direct';
import { clientLogger } from '@/lib/client-logger';

export interface CharacterProfile {
  id: string;
  name: string;
  gameId?: string;
  avatar?: string;
  
  // Personalità base
  personality: {
    archetype: CharacterArchetype;
    traits: string[];
    mood: 'cheerful' | 'serious' | 'mysterious' | 'aggressive' | 'calm' | 'nervous';
    age: 'child' | 'teen' | 'adult' | 'elderly';
    gender: 'male' | 'female' | 'neutral' | 'unknown';
  };
  
  // Stile di parlato
  speechStyle: {
    formality: 'very_formal' | 'formal' | 'neutral' | 'informal' | 'very_informal';
    vocabulary: 'archaic' | 'sophisticated' | 'standard' | 'simple' | 'slang' | 'technical';
    sentenceLength: 'short' | 'medium' | 'long';
    punctuationStyle: 'minimal' | 'standard' | 'expressive';
  };
  
  // Pattern specifici
  patterns: {
    catchphrases: string[];
    fillerWords: string[];
    endingSuffixes: string[];
    avoidWords: string[];
    preferredWords: Record<string, string>; // word -> replacement
  };
  
  // Voce (per TTS)
  voice?: {
    provider: 'openai' | 'elevenlabs' | 'azure';
    voiceId: string;
    pitch: number;
    speed: number;
    emotion?: string;
  };
  
  // Esempi di dialoghi per contesto
  exampleDialogues: Array<{
    original: string;
    translated: string;
    context?: string;
  }>;
  
  createdAt: string;
  updatedAt: string;
}

export type CharacterArchetype = 
  | 'hero'
  | 'villain'
  | 'mentor'
  | 'sidekick'
  | 'love_interest'
  | 'comic_relief'
  | 'mysterious_stranger'
  | 'noble'
  | 'pirate'
  | 'warrior'
  | 'wizard'
  | 'merchant'
  | 'child'
  | 'robot'
  | 'monster'
  | 'narrator'
  | 'custom';

// Preset per archetipi comuni
export const ARCHETYPE_PRESETS: Record<CharacterArchetype, Partial<CharacterProfile>> = {
  hero: {
    personality: {
      archetype: 'hero',
      traits: ['coraggioso', 'determinato', 'altruista'],
      mood: 'serious',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'neutral',
      vocabulary: 'standard',
      sentenceLength: 'medium',
      punctuationStyle: 'standard'
    },
    patterns: {
      catchphrases: ['Non mi arrenderò!', 'Devo proteggere tutti!'],
      fillerWords: [],
      endingSuffixes: [],
      avoidWords: ['paura', 'impossibile'],
      preferredWords: { 'enemy': 'avversario', 'kill': 'sconfiggere' }
    }
  },
  villain: {
    personality: {
      archetype: 'villain',
      traits: ['astuto', 'crudele', 'ambizioso'],
      mood: 'mysterious',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'formal',
      vocabulary: 'sophisticated',
      sentenceLength: 'long',
      punctuationStyle: 'expressive'
    },
    patterns: {
      catchphrases: ['Sciocchi...', 'Il potere sarà mio!'],
      fillerWords: ['hmm...', 'interessante...'],
      endingSuffixes: ['...'],
      avoidWords: [],
      preferredWords: { 'friend': 'pedina', 'help': 'servire' }
    }
  },
  pirate: {
    personality: {
      archetype: 'pirate',
      traits: ['avventuroso', 'rozzo', 'leale'],
      mood: 'cheerful',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'very_informal',
      vocabulary: 'slang',
      sentenceLength: 'short',
      punctuationStyle: 'expressive'
    },
    patterns: {
      catchphrases: ['Arrr!', 'Per mille balene!', 'Corpo di mille filibustieri!'],
      fillerWords: ['argh', 'yo-ho'],
      endingSuffixes: [', marinaio!', ', per Davy Jones!'],
      avoidWords: ['signore', 'prego'],
      preferredWords: { 
        'money': 'dobloni', 
        'friend': 'compare', 
        'ship': 'vascello',
        'ocean': 'sette mari'
      }
    }
  },
  noble: {
    personality: {
      archetype: 'noble',
      traits: ['elegante', 'altezzoso', 'colto'],
      mood: 'calm',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'very_formal',
      vocabulary: 'sophisticated',
      sentenceLength: 'long',
      punctuationStyle: 'standard'
    },
    patterns: {
      catchphrases: ['In verità...', 'Come potete osare...'],
      fillerWords: ['ebbene', 'dunque', 'invero'],
      endingSuffixes: [', mio caro', ', vi prego'],
      avoidWords: ['ciao', 'ok', 'tipo'],
      preferredWords: { 
        'hello': 'salve', 
        'goodbye': 'vi porgo i miei omaggi',
        'house': 'dimora',
        'servant': 'valletto'
      }
    }
  },
  child: {
    personality: {
      archetype: 'child',
      traits: ['innocente', 'curioso', 'energico'],
      mood: 'cheerful',
      age: 'child',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'very_informal',
      vocabulary: 'simple',
      sentenceLength: 'short',
      punctuationStyle: 'expressive'
    },
    patterns: {
      catchphrases: ['Wow!', 'Davvero?!', 'Fantastico!'],
      fillerWords: ['ehm', 'tipo', 'cioè'],
      endingSuffixes: ['!', '?!'],
      avoidWords: [],
      preferredWords: { 
        'big': 'grandissimo', 
        'scary': 'pauroso pauroso'
      }
    }
  },
  robot: {
    personality: {
      archetype: 'robot',
      traits: ['logico', 'preciso', 'neutrale'],
      mood: 'calm',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'formal',
      vocabulary: 'technical',
      sentenceLength: 'medium',
      punctuationStyle: 'minimal'
    },
    patterns: {
      catchphrases: ['Affermativo.', 'Elaborazione in corso...', 'Dati insufficienti.'],
      fillerWords: ['...elaborando...', '[BEEP]'],
      endingSuffixes: ['. Fine trasmissione.'],
      avoidWords: ['forse', 'penso', 'sento'],
      preferredWords: { 
        'think': 'calcolare',
        'feel': 'rilevare',
        'want': 'richiedere',
        'yes': 'affermativo',
        'no': 'negativo'
      }
    }
  },
  wizard: {
    personality: {
      archetype: 'wizard',
      traits: ['saggio', 'misterioso', 'potente'],
      mood: 'mysterious',
      age: 'elderly',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'formal',
      vocabulary: 'archaic',
      sentenceLength: 'long',
      punctuationStyle: 'standard'
    },
    patterns: {
      catchphrases: ['Così sia...', 'Le stelle parlano...', 'Il destino vuole...'],
      fillerWords: ['hmm', 'vediamo'],
      endingSuffixes: ['...giovane apprendista', ', figliolo'],
      avoidWords: ['tecnologia', 'scienza'],
      preferredWords: { 
        'power': 'arcano potere',
        'magic': 'arti mistiche',
        'book': 'grimorio',
        'enemy': 'forze oscure'
      }
    }
  },
  warrior: {
    personality: {
      archetype: 'warrior',
      traits: ['onorabile', 'forte', 'diretto'],
      mood: 'serious',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'neutral',
      vocabulary: 'standard',
      sentenceLength: 'short',
      punctuationStyle: 'minimal'
    },
    patterns: {
      catchphrases: ['Per l\'onore!', 'La mia spada è con te.', 'Così sia.'],
      fillerWords: [],
      endingSuffixes: [', compagno d\'armi'],
      avoidWords: ['paura', 'ritirata'],
      preferredWords: { 
        'fight': 'battaglia',
        'win': 'vittoria',
        'lose': 'cadere con onore'
      }
    }
  },
  merchant: {
    personality: {
      archetype: 'merchant',
      traits: ['affabile', 'astuto', 'avido'],
      mood: 'cheerful',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'informal',
      vocabulary: 'standard',
      sentenceLength: 'medium',
      punctuationStyle: 'expressive'
    },
    patterns: {
      catchphrases: ['Un affare per te!', 'Prezzi imbattibili!', 'Solo per oggi!'],
      fillerWords: ['amico mio', 'senti senti'],
      endingSuffixes: [', che ne dici?', ', è un affare!'],
      avoidWords: ['gratis', 'economico'],
      preferredWords: { 
        'cheap': 'conveniente',
        'expensive': 'di qualità superiore',
        'buy': 'investire'
      }
    }
  },
  mentor: {
    personality: {
      archetype: 'mentor',
      traits: ['saggio', 'paziente', 'protettivo'],
      mood: 'calm',
      age: 'elderly',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'neutral',
      vocabulary: 'sophisticated',
      sentenceLength: 'medium',
      punctuationStyle: 'standard'
    },
    patterns: {
      catchphrases: ['Ricorda...', 'Un giorno capirai.', 'La vera forza...'],
      fillerWords: ['vedi', 'sai'],
      endingSuffixes: [', giovane', ', mio allievo'],
      avoidWords: [],
      preferredWords: {}
    }
  },
  sidekick: {
    personality: {
      archetype: 'sidekick',
      traits: ['leale', 'entusiasta', 'impulsivo'],
      mood: 'cheerful',
      age: 'teen',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'informal',
      vocabulary: 'simple',
      sentenceLength: 'short',
      punctuationStyle: 'expressive'
    },
    patterns: {
      catchphrases: ['Sono con te!', 'Andiamo!', 'Ce la faremo!'],
      fillerWords: ['ehi', 'dai'],
      endingSuffixes: ['!'],
      avoidWords: [],
      preferredWords: {}
    }
  },
  love_interest: {
    personality: {
      archetype: 'love_interest',
      traits: ['affettuoso', 'comprensivo', 'emotivo'],
      mood: 'calm',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'informal',
      vocabulary: 'standard',
      sentenceLength: 'medium',
      punctuationStyle: 'expressive'
    },
    patterns: {
      catchphrases: ['Ti sarò sempre accanto.', 'Credici.'],
      fillerWords: ['sai', 'ecco'],
      endingSuffixes: ['...'],
      avoidWords: [],
      preferredWords: {}
    }
  },
  comic_relief: {
    personality: {
      archetype: 'comic_relief',
      traits: ['buffo', 'goffo', 'ottimista'],
      mood: 'cheerful',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'very_informal',
      vocabulary: 'slang',
      sentenceLength: 'short',
      punctuationStyle: 'expressive'
    },
    patterns: {
      catchphrases: ['Oops!', 'Non volevo!', 'Ehehe...'],
      fillerWords: ['cioè', 'boh', 'mah'],
      endingSuffixes: ['... credo?', '... forse?'],
      avoidWords: [],
      preferredWords: {}
    }
  },
  mysterious_stranger: {
    personality: {
      archetype: 'mysterious_stranger',
      traits: ['enigmatico', 'distante', 'onnisciente'],
      mood: 'mysterious',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'formal',
      vocabulary: 'sophisticated',
      sentenceLength: 'medium',
      punctuationStyle: 'minimal'
    },
    patterns: {
      catchphrases: ['Tutto sarà rivelato...', 'Il tempo dirà...'],
      fillerWords: ['...'],
      endingSuffixes: ['...'],
      avoidWords: ['io', 'mio'],
      preferredWords: {}
    }
  },
  monster: {
    personality: {
      archetype: 'monster',
      traits: ['feroce', 'primitivo', 'minaccioso'],
      mood: 'aggressive',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'very_informal',
      vocabulary: 'simple',
      sentenceLength: 'short',
      punctuationStyle: 'expressive'
    },
    patterns: {
      catchphrases: ['GRRRR!', 'RUAAAH!'],
      fillerWords: ['*ringhia*', '*sibila*'],
      endingSuffixes: ['!'],
      avoidWords: [],
      preferredWords: {
        'eat': 'divorare',
        'kill': 'sbranare'
      }
    }
  },
  narrator: {
    personality: {
      archetype: 'narrator',
      traits: ['onnisciente', 'neutrale', 'eloquente'],
      mood: 'calm',
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'formal',
      vocabulary: 'sophisticated',
      sentenceLength: 'long',
      punctuationStyle: 'standard'
    },
    patterns: {
      catchphrases: [],
      fillerWords: [],
      endingSuffixes: [],
      avoidWords: [],
      preferredWords: {}
    }
  },
  custom: {
    personality: {
      archetype: 'custom',
      traits: [],
      mood: 'neutral' as unknown,
      age: 'adult',
      gender: 'neutral'
    },
    speechStyle: {
      formality: 'neutral',
      vocabulary: 'standard',
      sentenceLength: 'medium',
      punctuationStyle: 'standard'
    },
    patterns: {
      catchphrases: [],
      fillerWords: [],
      endingSuffixes: [],
      avoidWords: [],
      preferredWords: {}
    }
  }
};

class CharacterVoiceService {
  private profiles: CharacterProfile[] = [];
  private storageKey = 'gamestringer_character_profiles';

  constructor() {
    this.loadProfiles();
  }

  private loadProfiles() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.profiles = JSON.parse(stored);
      }
    }
  }

  private saveProfiles() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profiles));
    }
  }

  getProfiles(): CharacterProfile[] {
    return this.profiles;
  }

  getProfilesByGame(gameId: string): CharacterProfile[] {
    return this.profiles.filter(p => p.gameId === gameId);
  }

  getProfile(id: string): CharacterProfile | undefined {
    return this.profiles.find(p => p.id === id);
  }

  createProfile(data: Partial<CharacterProfile>): CharacterProfile {
    const archetype = data.personality?.archetype || 'custom';
    const preset = ARCHETYPE_PRESETS[archetype];
    
    const profile: CharacterProfile = {
      id: crypto.randomUUID(),
      name: data.name || 'Nuovo Personaggio',
      gameId: data.gameId,
      avatar: data.avatar,
      personality: {
        ...preset.personality!,
        ...data.personality
      },
      speechStyle: {
        ...preset.speechStyle!,
        ...data.speechStyle
      },
      patterns: {
        catchphrases: [...(preset.patterns?.catchphrases || []), ...(data.patterns?.catchphrases || [])],
        fillerWords: [...(preset.patterns?.fillerWords || []), ...(data.patterns?.fillerWords || [])],
        endingSuffixes: [...(preset.patterns?.endingSuffixes || []), ...(data.patterns?.endingSuffixes || [])],
        avoidWords: [...(preset.patterns?.avoidWords || []), ...(data.patterns?.avoidWords || [])],
        preferredWords: { ...(preset.patterns?.preferredWords || {}), ...(data.patterns?.preferredWords || {}) }
      },
      voice: data.voice,
      exampleDialogues: data.exampleDialogues || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.profiles.push(profile);
    this.saveProfiles();
    return profile;
  }

  updateProfile(id: string, updates: Partial<CharacterProfile>): CharacterProfile | null {
    const index = this.profiles.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.profiles[index] = {
      ...this.profiles[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveProfiles();
    return this.profiles[index];
  }

  deleteProfile(id: string): boolean {
    const index = this.profiles.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.profiles.splice(index, 1);
    this.saveProfiles();
    return true;
  }

  // Genera prompt per LLM basato sul profilo
  generateTranslationPrompt(profile: CharacterProfile, text: string, targetLang: string): string {
    const { personality, speechStyle, patterns } = profile;
    
    let prompt = `Traduci il seguente dialogo in ${targetLang} mantenendo lo stile del personaggio.\n\n`;
    prompt += `PERSONAGGIO: ${profile.name}\n`;
    prompt += `ARCHETIPO: ${personality.archetype}\n`;
    prompt += `TRATTI: ${personality.traits.join(', ')}\n`;
    prompt += `UMORE: ${personality.mood}\n`;
    prompt += `ETÀ: ${personality.age}\n\n`;
    
    prompt += `STILE DI PARLATO:\n`;
    prompt += `- Formalità: ${speechStyle.formality}\n`;
    prompt += `- Vocabolario: ${speechStyle.vocabulary}\n`;
    prompt += `- Frasi: ${speechStyle.sentenceLength}\n\n`;
    
    if (patterns.catchphrases.length > 0) {
      prompt += `FRASI TIPICHE: ${patterns.catchphrases.join(', ')}\n`;
    }
    if (patterns.fillerWords.length > 0) {
      prompt += `INTERCALARI: ${patterns.fillerWords.join(', ')}\n`;
    }
    if (Object.keys(patterns.preferredWords).length > 0) {
      prompt += `SOSTITUZIONI PREFERITE: ${Object.entries(patterns.preferredWords).map(([k, v]) => `${k}→${v}`).join(', ')}\n`;
    }
    if (patterns.avoidWords.length > 0) {
      prompt += `PAROLE DA EVITARE: ${patterns.avoidWords.join(', ')}\n`;
    }
    
    if (profile.exampleDialogues.length > 0) {
      prompt += `\nESEMPI:\n`;
      profile.exampleDialogues.slice(0, 3).forEach(ex => {
        prompt += `"${ex.original}" → "${ex.translated}"\n`;
      });
    }
    
    prompt += `\nTESTO DA TRADURRE:\n"${text}"\n\n`;
    prompt += `Rispondi SOLO con la traduzione, senza spiegazioni.`;
    
    return prompt;
  }

  // Traduzione con profilo personaggio
  async translateWithProfile(
    profile: CharacterProfile, 
    text: string, 
    targetLang: string = 'it'
  ): Promise<{ translated: string; suggestions: string[] }> {
    const prompt = this.generateTranslationPrompt(profile, text, targetLang);
    
    try {
      // Traduzione con fallback automatico (Gemini → DeepSeek → OpenAI)
      const result = await translateSingleWithFallback(
        prompt,
        targetLang,
        undefined,
        `character voice: ${profile.name}`
      );
      
      // Post-process con patterns del personaggio
      let translated = result.translated;
      
      // Applica sostituzioni preferite
      for (const [from, to] of Object.entries(profile.patterns.preferredWords)) {
        const regex = new RegExp(`\\b${from}\\b`, 'gi');
        translated = translated.replace(regex, to);
      }
      
      // Aggiungi suffisso casuale se configurato
      if (profile.patterns.endingSuffixes.length > 0 && Math.random() > 0.7) {
        const suffix = profile.patterns.endingSuffixes[
          Math.floor(Math.random() * profile.patterns.endingSuffixes.length)
        ];
        translated += suffix;
      }
      
      return {
        translated,
        suggestions: []
      };
    } catch (error: unknown) {
      clientLogger.error('Character translation failed:', error);
      return { translated: text, suggestions: ['Traduzione fallita'] };
    }
  }
}

export const characterVoiceService = new CharacterVoiceService();
