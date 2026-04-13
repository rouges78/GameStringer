/**
 * GameStringer Translation Hub — Sistema di condivisione Translation Pack (.gspack)
 * 
 * Permette agli utenti di:
 * - Esportare profili di traduzione completi (glossario, prompt, cache pre-tradotta)
 * - Condividerli come file .gspack (JSON compresso)
 * - Installare pack dalla community con 1-click
 * - Cercare pack per gioco nel Community Hub
 */

export interface TranslationPack {
  id: string;
  version: string;
  format: 'gspack-v1';
  metadata: {
    gameName: string;
    gameEngine: string;
    sourceLanguage: string;
    targetLanguage: string;
    author: string;
    description: string;
    createdAt: string;
    stringCount: number;
    qualityScore?: number;
    tags: string[];
  };
  glossary: GlossaryEntry[];
  translations: TranslationEntry[];
  prompts?: CustomPrompt[];
  settings?: PackSettings;
}

export interface GlossaryEntry {
  source: string;
  target: string;
  context?: string;
  category?: 'character' | 'item' | 'location' | 'spell' | 'ui' | 'lore' | 'general';
}

export interface TranslationEntry {
  id: string;
  original: string;
  translated: string;
  context?: string;
  verified: boolean;
  editedBy?: string;
}

export interface CustomPrompt {
  name: string;
  systemPrompt: string;
  description: string;
}

export interface PackSettings {
  preferredProvider?: string;
  preferredModel?: string;
  temperature?: number;
  gameSpecificRules?: string[];
}

export interface HubListing {
  id: string;
  gameName: string;
  targetLanguage: string;
  author: string;
  description: string;
  stringCount: number;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  downloadUrl: string;
}

class TranslationHubEngine {
  private packsKey = 'gs_installed_packs';

  /**
   * Esporta un Translation Pack dal progetto corrente
   */
  async exportPack(opts: {
    gameName: string;
    gameEngine: string;
    sourceLanguage: string;
    targetLanguage: string;
    author: string;
    description: string;
    glossary: GlossaryEntry[];
    translations: TranslationEntry[];
    prompts?: CustomPrompt[];
    settings?: PackSettings;
  }): Promise<Blob> {
    const pack: TranslationPack = {
      id: `gspack-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      version: '1.0.0',
      format: 'gspack-v1',
      metadata: {
        gameName: opts.gameName,
        gameEngine: opts.gameEngine,
        sourceLanguage: opts.sourceLanguage,
        targetLanguage: opts.targetLanguage,
        author: opts.author,
        description: opts.description,
        createdAt: new Date().toISOString(),
        stringCount: opts.translations.length,
        tags: [],
      },
      glossary: opts.glossary,
      translations: opts.translations,
      prompts: opts.prompts,
      settings: opts.settings,
    };

    const json = JSON.stringify(pack, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Importa un Translation Pack da file .gspack
   */
  async importPack(file: File): Promise<TranslationPack> {
    const text = await file.text();
    const pack = JSON.parse(text) as TranslationPack;

    if (pack.format !== 'gspack-v1') {
      throw new Error(`Formato pack non supportato: ${pack.format}`);
    }

    // Salva nei pack installati
    const installed = this.getInstalledPacks();
    installed.push({
      id: pack.id,
      gameName: pack.metadata.gameName,
      targetLanguage: pack.metadata.targetLanguage,
      author: pack.metadata.author,
      stringCount: pack.metadata.stringCount,
      installedAt: new Date().toISOString(),
    });
    localStorage.setItem(this.packsKey, JSON.stringify(installed));

    return pack;
  }

  /**
   * Download e installa pack da URL (1-click)
   */
  async installFromUrl(url: string): Promise<TranslationPack> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download fallito: ${response.status}`);
    const blob = await response.blob();
    const file = new File([blob], 'pack.gspack', { type: 'application/json' });
    return this.importPack(file);
  }

  /**
   * Cerca pack nel Community Hub (GitHub Discussions)
   */
  async searchPacks(gameName: string): Promise<HubListing[]> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/rouges78/GameStringer/discussions?per_page=30`,
        { headers: { 'Accept': 'application/vnd.github+json' } }
      );
      if (!response.ok) return [];
      const discussions = await response.json();
      
      interface GHDiscussion {
        title?: string;
        body?: string;
        number?: number;
        user?: { login?: string };
        reactions?: { total_count?: number };
        created_at?: string;
        updated_at?: string;
        html_url?: string;
      }
      return (discussions as GHDiscussion[])
        .filter((d) => {
          const title = (d.title || '').toLowerCase();
          const body = (d.body || '').toLowerCase();
          return (title.includes('pack') || title.includes('translation') || body.includes('.gspack')) &&
                 (title.includes(gameName.toLowerCase()) || body.includes(gameName.toLowerCase()));
        })
        .map((d) => ({
          id: String(d.number),
          gameName,
          targetLanguage: 'auto',
          author: d.user?.login || 'unknown',
          description: (d.body || '').slice(0, 200),
          stringCount: 0,
          downloads: d.reactions?.total_count || 0,
          rating: 0,
          createdAt: d.created_at || '',
          updatedAt: d.updated_at || '',
          tags: [],
          downloadUrl: d.html_url || '',
        }));
    } catch {
      return [];
    }
  }

  getInstalledPacks(): unknown[] {
    try {
      return JSON.parse(localStorage.getItem(this.packsKey) || '[]');
    } catch {
      return [];
    }
  }

  removePack(packId: string) {
    const installed = this.getInstalledPacks().filter((p) => (p as Record<string, unknown>).id !== packId);
    localStorage.setItem(this.packsKey, JSON.stringify(installed));
  }
}

export const translationHub = typeof window !== 'undefined' ? new TranslationHubEngine() : null;
