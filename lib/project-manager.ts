/**
 * GameStringer Project Manager
 * Gestisce salvataggio e caricamento progetti di traduzione (.gsproj)
 */

export interface TranslationEntry {
  original: string;
  translated: string;
  context?: string;
  status: 'pending' | 'translated' | 'reviewed' | 'approved';
  notes?: string;
  translator?: string;
  timestamp?: string;
}

export interface ProjectFile {
  path: string;
  relativePath: string;
  fileType: string;
  entries: TranslationEntry[];
  totalStrings: number;
  translatedStrings: number;
  lastModified?: string;
}

export interface ProjectSettings {
  sourceLanguage: string;
  targetLanguage: string;
  translationService: string;
  glossaryEnabled: boolean;
  autoSave: boolean;
  backupEnabled: boolean;
}

export interface ProjectMetadata {
  name: string;
  description?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  gameId?: string;
  gameName?: string;
  gamePlatform?: string;
  gameEngine?: string;
}

export interface GameStringerProject {
  formatVersion: string;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  files: ProjectFile[];
  glossary: Record<string, string>;
  statistics: {
    totalFiles: number;
    totalStrings: number;
    translatedStrings: number;
    reviewedStrings: number;
    approvedStrings: number;
    progress: number;
  };
}

const PROJECT_FORMAT_VERSION = '1.0.0';

export class ProjectManager {
  private currentProject: GameStringerProject | null = null;
  private projectPath: string | null = null;
  private isDirty: boolean = false;

  /**
   * Crea un nuovo progetto
   */
  createProject(options: {
    name: string;
    description?: string;
    author?: string;
    gameId?: string;
    gameName?: string;
    gamePlatform?: string;
    gameEngine?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
  }): GameStringerProject {
    const now = new Date().toISOString();
    
    this.currentProject = {
      formatVersion: PROJECT_FORMAT_VERSION,
      metadata: {
        name: options.name,
        description: options.description,
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        author: options.author,
        gameId: options.gameId,
        gameName: options.gameName,
        gamePlatform: options.gamePlatform,
        gameEngine: options.gameEngine,
      },
      settings: {
        sourceLanguage: options.sourceLanguage || 'en',
        targetLanguage: options.targetLanguage || 'it',
        translationService: 'ollama',
        glossaryEnabled: true,
        autoSave: true,
        backupEnabled: true,
      },
      files: [],
      glossary: {},
      statistics: {
        totalFiles: 0,
        totalStrings: 0,
        translatedStrings: 0,
        reviewedStrings: 0,
        approvedStrings: 0,
        progress: 0,
      },
    };

    this.isDirty = true;
    this.projectPath = null;
    
    return this.currentProject;
  }

  /**
   * Carica un progetto da file
   */
  async loadProject(filePath: string): Promise<GameStringerProject> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const content = await invoke<string>('read_text_file', { path: filePath });
      
      const project = JSON.parse(content) as GameStringerProject;
      
      // Valida formato
      if (!project.formatVersion || !project.metadata || !project.files) {
        throw new Error('Formato progetto non valido');
      }

      this.currentProject = project;
      this.projectPath = filePath;
      this.isDirty = false;
      
      return project;
    } catch (error: any) {
      console.error('Errore caricamento progetto:', error);
      throw new Error(`Impossibile caricare il progetto: ${error.message}`);
    }
  }

  /**
   * Salva il progetto corrente
   */
  async saveProject(filePath?: string): Promise<string> {
    if (!this.currentProject) {
      throw new Error('Nessun progetto aperto');
    }

    const savePath = filePath || this.projectPath;
    if (!savePath) {
      throw new Error('Specificare un percorso per il salvataggio');
    }

    try {
      // Aggiorna timestamp
      this.currentProject.metadata.updatedAt = new Date().toISOString();
      
      // Ricalcola statistiche
      this.updateStatistics();

      const { invoke } = await import('@tauri-apps/api/core');
      const content = JSON.stringify(this.currentProject, null, 2);
      
      await invoke('write_text_file', { 
        path: savePath, 
        content 
      });

      this.projectPath = savePath;
      this.isDirty = false;
      
      return savePath;
    } catch (error: any) {
      console.error('Errore salvataggio progetto:', error);
      throw new Error(`Impossibile salvare il progetto: ${error.message}`);
    }
  }

  /**
   * Esporta progetto con dialog
   */
  async exportProject(): Promise<string | null> {
    if (!this.currentProject) {
      throw new Error('Nessun progetto aperto');
    }

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        defaultPath: `${this.currentProject.metadata.name}.gsproj`,
        filters: [
          { name: 'GameStringer Project', extensions: ['gsproj'] }
        ]
      });

      if (filePath) {
        return await this.saveProject(filePath);
      }
      return null;
    } catch (error: any) {
      console.error('Errore export progetto:', error);
      throw error;
    }
  }

  /**
   * Importa progetto con dialog
   */
  async importProject(): Promise<GameStringerProject | null> {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePath = await open({
        multiple: false,
        filters: [
          { name: 'GameStringer Project', extensions: ['gsproj'] }
        ]
      });

      if (filePath && typeof filePath === 'string') {
        return await this.loadProject(filePath);
      }
      return null;
    } catch (error: any) {
      console.error('Errore import progetto:', error);
      throw error;
    }
  }

  /**
   * Aggiungi file al progetto
   */
  addFile(file: Omit<ProjectFile, 'totalStrings' | 'translatedStrings'>): void {
    if (!this.currentProject) {
      throw new Error('Nessun progetto aperto');
    }

    const projectFile: ProjectFile = {
      ...file,
      totalStrings: file.entries.length,
      translatedStrings: file.entries.filter(e => e.status !== 'pending').length,
      lastModified: new Date().toISOString(),
    };

    // Controlla se il file esiste già
    const existingIndex = this.currentProject.files.findIndex(
      f => f.path === file.path
    );

    if (existingIndex >= 0) {
      this.currentProject.files[existingIndex] = projectFile;
    } else {
      this.currentProject.files.push(projectFile);
    }

    this.isDirty = true;
    this.updateStatistics();
  }

  /**
   * Rimuovi file dal progetto
   */
  removeFile(filePath: string): void {
    if (!this.currentProject) {
      throw new Error('Nessun progetto aperto');
    }

    this.currentProject.files = this.currentProject.files.filter(
      f => f.path !== filePath
    );

    this.isDirty = true;
    this.updateStatistics();
  }

  /**
   * Aggiorna una traduzione
   */
  updateTranslation(
    filePath: string, 
    originalText: string, 
    translation: Partial<TranslationEntry>
  ): void {
    if (!this.currentProject) {
      throw new Error('Nessun progetto aperto');
    }

    const file = this.currentProject.files.find(f => f.path === filePath);
    if (!file) {
      throw new Error('File non trovato nel progetto');
    }

    const entry = file.entries.find(e => e.original === originalText);
    if (!entry) {
      throw new Error('Entry non trovata');
    }

    Object.assign(entry, translation, { timestamp: new Date().toISOString() });
    
    // Aggiorna conteggio
    file.translatedStrings = file.entries.filter(e => e.status !== 'pending').length;
    file.lastModified = new Date().toISOString();

    this.isDirty = true;
    this.updateStatistics();
  }

  /**
   * Aggiungi termine al glossario
   */
  addGlossaryTerm(original: string, translation: string): void {
    if (!this.currentProject) {
      throw new Error('Nessun progetto aperto');
    }

    this.currentProject.glossary[original] = translation;
    this.isDirty = true;
  }

  /**
   * Rimuovi termine dal glossario
   */
  removeGlossaryTerm(original: string): void {
    if (!this.currentProject) {
      throw new Error('Nessun progetto aperto');
    }

    delete this.currentProject.glossary[original];
    this.isDirty = true;
  }

  /**
   * Aggiorna statistiche progetto
   */
  private updateStatistics(): void {
    if (!this.currentProject) return;

    const stats = this.currentProject.statistics;
    stats.totalFiles = this.currentProject.files.length;
    stats.totalStrings = 0;
    stats.translatedStrings = 0;
    stats.reviewedStrings = 0;
    stats.approvedStrings = 0;

    for (const file of this.currentProject.files) {
      stats.totalStrings += file.entries.length;
      for (const entry of file.entries) {
        if (entry.status === 'translated') stats.translatedStrings++;
        if (entry.status === 'reviewed') stats.reviewedStrings++;
        if (entry.status === 'approved') stats.approvedStrings++;
      }
    }

    const completed = stats.translatedStrings + stats.reviewedStrings + stats.approvedStrings;
    stats.progress = stats.totalStrings > 0 
      ? Math.round((completed / stats.totalStrings) * 100) 
      : 0;
  }

  /**
   * Esporta traduzioni in formato specifico
   */
  async exportTranslations(format: 'json' | 'csv' | 'po'): Promise<string | null> {
    if (!this.currentProject) {
      throw new Error('Nessun progetto aperto');
    }

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const ext = format === 'po' ? 'po' : format;
      
      const filePath = await save({
        defaultPath: `${this.currentProject.metadata.name}_translations.${ext}`,
        filters: [
          { name: `${format.toUpperCase()} File`, extensions: [ext] }
        ]
      });

      if (!filePath) return null;

      let content = '';

      if (format === 'json') {
        const translations: Record<string, string> = {};
        for (const file of this.currentProject.files) {
          for (const entry of file.entries) {
            if (entry.translated) {
              translations[entry.original] = entry.translated;
            }
          }
        }
        content = JSON.stringify(translations, null, 2);
      } else if (format === 'csv') {
        const lines = ['original,translated,status,file'];
        for (const file of this.currentProject.files) {
          for (const entry of file.entries) {
            const escaped = (s: string) => `"${s.replace(/"/g, '""')}"`;
            lines.push(`${escaped(entry.original)},${escaped(entry.translated || '')},${entry.status},${escaped(file.relativePath)}`);
          }
        }
        content = lines.join('\n');
      } else if (format === 'po') {
        const lines = [
          '# GameStringer Translation Export',
          `# Project: ${this.currentProject.metadata.name}`,
          `# Language: ${this.currentProject.settings.targetLanguage}`,
          '',
        ];
        for (const file of this.currentProject.files) {
          for (const entry of file.entries) {
            lines.push(`#: ${file.relativePath}`);
            lines.push(`msgid "${entry.original.replace(/"/g, '\\"')}"`);
            lines.push(`msgstr "${(entry.translated || '').replace(/"/g, '\\"')}"`);
            lines.push('');
          }
        }
        content = lines.join('\n');
      }

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('write_text_file', { path: filePath, content });

      return filePath;
    } catch (error: any) {
      console.error('Errore export traduzioni:', error);
      throw error;
    }
  }

  // Getters
  get project(): GameStringerProject | null {
    return this.currentProject;
  }

  get path(): string | null {
    return this.projectPath;
  }

  get dirty(): boolean {
    return this.isDirty;
  }

  get hasProject(): boolean {
    return this.currentProject !== null;
  }
}

// Singleton instance
export const projectManager = new ProjectManager();
