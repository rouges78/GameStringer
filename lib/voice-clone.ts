/**
 * Voice Clone TTS - Clonazione voce per doppiaggio automatico
 * Supporta ElevenLabs, OpenAI TTS, e modelli locali
 */

export interface VoiceProfile {
  id: string;
  name: string;
  description?: string;
  provider: 'elevenlabs' | 'openai' | 'local' | 'azure';
  voiceId: string;
  settings: VoiceSettings;
  sampleAudioUrl?: string;
  createdAt: string;
}

export interface VoiceSettings {
  stability: number; // 0-1
  similarityBoost: number; // 0-1
  style?: number; // 0-1
  speakerBoost?: boolean;
  speed?: number; // 0.5-2
  pitch?: number; // -20 to 20
}

export interface CloneRequest {
  name: string;
  description?: string;
  audioSamples: File[] | string[]; // Audio files or URLs
  provider: 'elevenlabs' | 'local';
}

export interface SynthesisRequest {
  text: string;
  voiceProfile: VoiceProfile;
  language?: string;
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised';
  outputFormat?: 'mp3' | 'wav' | 'ogg';
}

export interface SynthesisResult {
  audioUrl: string;
  audioBlob: Blob;
  duration: number;
  characterCount: number;
  provider: string;
}

// Preset voci per diversi tipi di personaggi
export const VOICE_PRESETS: Record<string, Partial<VoiceSettings>> = {
  narrator: {
    stability: 0.75,
    similarityBoost: 0.75,
    speed: 0.9,
  },
  hero: {
    stability: 0.6,
    similarityBoost: 0.8,
    speed: 1.0,
  },
  villain: {
    stability: 0.5,
    similarityBoost: 0.7,
    speed: 0.85,
    pitch: -5,
  },
  child: {
    stability: 0.7,
    similarityBoost: 0.6,
    speed: 1.1,
    pitch: 10,
  },
  robot: {
    stability: 0.9,
    similarityBoost: 0.5,
    speed: 0.95,
  },
  elderly: {
    stability: 0.65,
    similarityBoost: 0.7,
    speed: 0.8,
  },
};

// Voci predefinite OpenAI
export const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy', gender: 'neutral', style: 'balanced' },
  { id: 'echo', name: 'Echo', gender: 'male', style: 'warm' },
  { id: 'fable', name: 'Fable', gender: 'neutral', style: 'expressive' },
  { id: 'onyx', name: 'Onyx', gender: 'male', style: 'deep' },
  { id: 'nova', name: 'Nova', gender: 'female', style: 'friendly' },
  { id: 'shimmer', name: 'Shimmer', gender: 'female', style: 'clear' },
];

class VoiceCloneService {
  private profiles: VoiceProfile[] = [];
  private apiKeys: Record<string, string> = {};

  constructor() {
    this.loadProfiles();
  }

  private loadProfiles() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gamestringer_voice_profiles');
      if (stored) {
        this.profiles = JSON.parse(stored);
      }
    }
  }

  private saveProfiles() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gamestringer_voice_profiles', JSON.stringify(this.profiles));
    }
  }

  setApiKey(provider: string, key: string) {
    this.apiKeys[provider] = key;
  }

  getApiKey(provider: string): string | undefined {
    return this.apiKeys[provider];
  }

  getProfiles(): VoiceProfile[] {
    return this.profiles;
  }

  getProfile(id: string): VoiceProfile | undefined {
    return this.profiles.find(p => p.id === id);
  }

  async createProfile(profile: Omit<VoiceProfile, 'id' | 'createdAt'>): Promise<VoiceProfile> {
    const newProfile: VoiceProfile = {
      ...profile,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.profiles.push(newProfile);
    this.saveProfiles();
    return newProfile;
  }

  updateProfile(id: string, updates: Partial<VoiceProfile>): VoiceProfile | null {
    const index = this.profiles.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    this.profiles[index] = { ...this.profiles[index], ...updates };
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

  async cloneVoice(request: CloneRequest): Promise<VoiceProfile> {
    if (request.provider === 'elevenlabs') {
      return this.cloneWithElevenLabs(request);
    }
    throw new Error(`Provider ${request.provider} non supportato per la clonazione`);
  }

  private async cloneWithElevenLabs(request: CloneRequest): Promise<VoiceProfile> {
    const apiKey = this.apiKeys['elevenlabs'];
    if (!apiKey) {
      throw new Error('API key ElevenLabs non configurata');
    }

    const formData = new FormData();
    formData.append('name', request.name);
    if (request.description) {
      formData.append('description', request.description);
    }

    for (const sample of request.audioSamples) {
      if (sample instanceof File) {
        formData.append('files', sample);
      }
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || 'Errore clonazione voce');
    }

    const result = await response.json();
    
    return this.createProfile({
      name: request.name,
      description: request.description,
      provider: 'elevenlabs',
      voiceId: result.voice_id,
      settings: {
        stability: 0.5,
        similarityBoost: 0.75,
      },
    });
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const { voiceProfile } = request;

    switch (voiceProfile.provider) {
      case 'openai':
        return this.synthesizeWithOpenAI(request);
      case 'elevenlabs':
        return this.synthesizeWithElevenLabs(request);
      case 'azure':
        return this.synthesizeWithAzure(request);
      default:
        throw new Error(`Provider ${voiceProfile.provider} non supportato`);
    }
  }

  private async synthesizeWithOpenAI(request: SynthesisRequest): Promise<SynthesisResult> {
    const apiKey = this.apiKeys['openai'];
    if (!apiKey) {
      throw new Error('API key OpenAI non configurata');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: request.text,
        voice: request.voiceProfile.voiceId,
        response_format: request.outputFormat || 'mp3',
        speed: request.voiceProfile.settings.speed || 1.0,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Errore sintesi vocale OpenAI');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioUrl,
      audioBlob,
      duration: 0, // Calcolato dopo
      characterCount: request.text.length,
      provider: 'openai',
    };
  }

  private async synthesizeWithElevenLabs(request: SynthesisRequest): Promise<SynthesisResult> {
    const apiKey = this.apiKeys['elevenlabs'];
    if (!apiKey) {
      throw new Error('API key ElevenLabs non configurata');
    }

    const { voiceProfile, text, outputFormat = 'mp3' } = request;
    const { settings } = voiceProfile;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceProfile.voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': `audio/${outputFormat}`,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarityBoost,
            style: settings.style || 0,
            use_speaker_boost: settings.speakerBoost || true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || 'Errore sintesi vocale ElevenLabs');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioUrl,
      audioBlob,
      duration: 0,
      characterCount: text.length,
      provider: 'elevenlabs',
    };
  }

  private async synthesizeWithAzure(request: SynthesisRequest): Promise<SynthesisResult> {
    const apiKey = this.apiKeys['azure'];
    const region = this.apiKeys['azure_region'] || 'westeurope';
    
    if (!apiKey) {
      throw new Error('API key Azure non configurata');
    }

    const { voiceProfile, text, language = 'it-IT' } = request;

    // SSML per controllo avanzato
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
        <voice name="${voiceProfile.voiceId}">
          <prosody rate="${(voiceProfile.settings.speed || 1) * 100}%" pitch="${voiceProfile.settings.pitch || 0}%">
            ${text}
          </prosody>
        </voice>
      </speak>
    `;

    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        },
        body: ssml,
      }
    );

    if (!response.ok) {
      throw new Error('Errore sintesi vocale Azure');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioUrl,
      audioBlob,
      duration: 0,
      characterCount: text.length,
      provider: 'azure',
    };
  }

  // Batch synthesis per doppiaggio completo
  async synthesizeBatch(
    dialogues: Array<{ id: string; text: string; character?: string }>,
    voiceProfile: VoiceProfile,
    onProgress?: (progress: number, current: string) => void
  ): Promise<Map<string, SynthesisResult>> {
    const results = new Map<string, SynthesisResult>();
    
    for (let i = 0; i < dialogues.length; i++) {
      const dialogue = dialogues[i];
      
      if (onProgress) {
        onProgress((i / dialogues.length) * 100, dialogue.text.substring(0, 50));
      }

      try {
        const result = await this.synthesize({
          text: dialogue.text,
          voiceProfile,
        });
        results.set(dialogue.id, result);
      } catch (error) {
        console.error(`Errore sintesi per ${dialogue.id}:`, error);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

export const voiceCloneService = new VoiceCloneService();
