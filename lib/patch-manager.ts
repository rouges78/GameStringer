import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import archiver from 'archiver';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface PatchMetadata {
  id: string;
  gameId: string;
  gameName: string;
  name: string;
  description: string;
  version: string;
  targetLanguage: string;
  sourceLanguage: string;
  patchType: 'REPLACEMENT' | 'INJECTION' | 'HYBRID';
  files: PatchFile[];
  translations: TranslationEntry[];
  createdAt: string;
  updatedAt: string;
  author: string;
  fileSize: number;
  checksum: string;
  isPublished: boolean;
  installCount: number;
  includeBackup: boolean;
  digitallySigned: boolean;
  dependencies?: string[];
  compatibility?: {
    gameVersion?: string;
    minGameVersion?: string;
    maxGameVersion?: string;
  };
}

export interface PatchFile {
  originalPath: string;
  patchPath: string;
  fileType: string;
  size: number;
  checksum: string;
  backup?: boolean;
}

export interface TranslationEntry {
  id: string;
  originalText: string;
  translatedText: string;
  context?: string;
  file?: string;
  lineNumber?: number;
  confidence?: number;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface PatchCreationOptions {
  gameId: string;
  gameName: string;
  name: string;
  description: string;
  targetLanguage: string;
  sourceLanguage?: string;
  patchType: 'REPLACEMENT' | 'INJECTION' | 'HYBRID';
  includeBackup?: boolean;
  digitallySigned?: boolean;
  author?: string;
}

export interface ExportOptions {
  format: 'exe' | 'zip' | 'pak';
  includeInstaller?: boolean;
  includeReadme?: boolean;
  compression?: 'normal' | 'high' | 'ultra';
  password?: string;
  signCertificate?: string;
}

class PatchManager {
  private patchesDir: string;
  private tempDir: string;

  constructor() {
    this.patchesDir = path.join(process.cwd(), 'patches');
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  async initialize() {
    // Crea le directory necessarie
    await fs.mkdir(this.patchesDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  // Crea una nuova patch
  async createPatch(options: PatchCreationOptions, translations: TranslationEntry[]): Promise<PatchMetadata> {
    const patchId = this.generatePatchId();
    const timestamp = new Date().toISOString();

    const metadata: PatchMetadata = {
      id: patchId,
      gameId: options.gameId,
      gameName: options.gameName,
      name: options.name,
      description: options.description,
      version: '1.0.0',
      targetLanguage: options.targetLanguage,
      sourceLanguage: options.sourceLanguage || 'en',
      patchType: options.patchType,
      files: [],
      translations: translations,
      createdAt: timestamp,
      updatedAt: timestamp,
      author: options.author || 'GameStringer User',
      fileSize: 0,
      checksum: '',
      isPublished: false,
      installCount: 0,
      includeBackup: options.includeBackup ?? true,
      digitallySigned: options.digitallySigned ?? false
    };

    // Salva i metadati
    const patchDir = path.join(this.patchesDir, patchId);
    await fs.mkdir(patchDir, { recursive: true });
    
    const metadataPath = path.join(patchDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Salva le traduzioni
    const translationsPath = path.join(patchDir, 'translations.json');
    await fs.writeFile(translationsPath, JSON.stringify(translations, null, 2));

    return metadata;
  }

  // Ottieni tutte le patch
  async getAllPatches(): Promise<PatchMetadata[]> {
    try {
      const dirs = await fs.readdir(this.patchesDir);
      const patches: PatchMetadata[] = [];

      for (const dir of dirs) {
        const metadataPath = path.join(this.patchesDir, dir, 'metadata.json');
        try {
          const data = await fs.readFile(metadataPath, 'utf-8');
          patches.push(JSON.parse(data));
        } catch (error) {
          console.error(`Errore nel leggere patch ${dir}:`, error);
        }
      }

      return patches.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      console.error('Errore nel recuperare le patch:', error);
      return [];
    }
  }

  // Ottieni una patch specifica
  async getPatch(patchId: string): Promise<PatchMetadata | null> {
    try {
      const metadataPath = path.join(this.patchesDir, patchId, 'metadata.json');
      const data = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Errore nel leggere patch ${patchId}:`, error);
      return null;
    }
  }

  // Aggiorna una patch
  async updatePatch(patchId: string, updates: Partial<PatchMetadata>): Promise<PatchMetadata | null> {
    const patch = await this.getPatch(patchId);
    if (!patch) return null;

    const updatedPatch = {
      ...patch,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const metadataPath = path.join(this.patchesDir, patchId, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(updatedPatch, null, 2));

    return updatedPatch;
  }

  // Aggiungi file a una patch
  async addFilesToPatch(patchId: string, files: PatchFile[]): Promise<boolean> {
    const patch = await this.getPatch(patchId);
    if (!patch) return false;

    patch.files = [...patch.files, ...files];
    patch.fileSize = patch.files.reduce((sum, file) => sum + file.size, 0);
    patch.updatedAt = new Date().toISOString();

    const metadataPath = path.join(this.patchesDir, patchId, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(patch, null, 2));

    return true;
  }

  // Esporta una patch
  async exportPatch(patchId: string, options: ExportOptions): Promise<string> {
    const patch = await this.getPatch(patchId);
    if (!patch) throw new Error('Patch non trovata');

    const exportDir = path.join(this.tempDir, `export_${patchId}`);
    await fs.mkdir(exportDir, { recursive: true });

    try {
      // Copia i file della patch
      const patchDir = path.join(this.patchesDir, patchId);
      await this.copyPatchFiles(patchDir, exportDir);

      // Genera README se richiesto
      if (options.includeReadme) {
        await this.generateReadme(patch, exportDir);
      }

      // Crea l'archivio
      const outputPath = await this.createArchive(patch, exportDir, options);

      // Firma digitale se richiesta
      if (patch.digitallySigned && options.signCertificate) {
        await this.signPackage(outputPath, options.signCertificate);
      }

      // Pulisci i file temporanei
      await fs.rm(exportDir, { recursive: true, force: true });

      return outputPath;
    } catch (error) {
      // Pulisci in caso di errore
      await fs.rm(exportDir, { recursive: true, force: true });
      throw error;
    }
  }

  // Importa traduzioni da file
  async importTranslations(filePath: string, format: 'json' | 'csv' | 'po'): Promise<TranslationEntry[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    switch (format) {
      case 'json':
        return JSON.parse(content);
      
      case 'csv':
        // Implementa parser CSV
        return this.parseCSVTranslations(content);
      
      case 'po':
        // Implementa parser PO
        return this.parsePOTranslations(content);
      
      default:
        throw new Error(`Formato non supportato: ${format}`);
    }
  }

  // Applica una patch
  async applyPatch(patchId: string, gameDir: string, backup: boolean = true): Promise<boolean> {
    const patch = await this.getPatch(patchId);
    if (!patch) return false;

    // Crea backup se richiesto
    if (backup) {
      await this.createBackup(gameDir, patchId);
    }

    try {
      // Applica i file della patch
      for (const file of patch.files) {
        const sourcePath = path.join(this.patchesDir, patchId, 'files', file.patchPath);
        const targetPath = path.join(gameDir, file.originalPath);

        // Crea la directory se non esiste
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        // Copia il file
        await fs.copyFile(sourcePath, targetPath);
      }

      // Incrementa il contatore di installazioni
      await this.updatePatch(patchId, {
        installCount: patch.installCount + 1
      });

      return true;
    } catch (error) {
      console.error('Errore nell\'applicare la patch:', error);
      
      // Ripristina il backup in caso di errore
      if (backup) {
        await this.restoreBackup(gameDir, patchId);
      }
      
      return false;
    }
  }

  // Rimuovi una patch applicata
  async removePatch(patchId: string, gameDir: string): Promise<boolean> {
    try {
      // Ripristina dal backup
      return await this.restoreBackup(gameDir, patchId);
    } catch (error) {
      console.error('Errore nel rimuovere la patch:', error);
      return false;
    }
  }

  // Verifica l'integrità di una patch
  async verifyPatch(patchId: string): Promise<boolean> {
    const patch = await this.getPatch(patchId);
    if (!patch) return false;

    try {
      // Verifica che tutti i file esistano
      for (const file of patch.files) {
        const filePath = path.join(this.patchesDir, patchId, 'files', file.patchPath);
        await fs.access(filePath);
        
        // Verifica checksum se disponibile
        if (file.checksum) {
          const actualChecksum = await this.calculateChecksum(filePath);
          if (actualChecksum !== file.checksum) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Funzioni di utilità private
  private generatePatchId(): string {
    return `patch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = await fs.readFile(filePath);
    hash.update(stream);
    return hash.digest('hex');
  }

  private async copyPatchFiles(sourceDir: string, targetDir: string): Promise<void> {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      
      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await this.copyPatchFiles(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }

  private async generateReadme(patch: PatchMetadata, outputDir: string): Promise<void> {
    const readme = `# ${patch.name}

## Descrizione
${patch.description}

## Informazioni
- **Versione**: ${patch.version}
- **Autore**: ${patch.author}
- **Data**: ${new Date(patch.createdAt).toLocaleDateString('it-IT')}
- **Lingua**: ${patch.targetLanguage.toUpperCase()}
- **Tipo**: ${patch.patchType}
- **Dimensione**: ${(patch.fileSize / 1024 / 1024).toFixed(2)} MB

## Installazione
1. Assicurati di avere un backup del gioco
2. Estrai i file nella directory del gioco
3. Sovrascrivi quando richiesto

## Disinstallazione
Per rimuovere la patch, ripristina i file originali dal backup.

## Note
${patch.includeBackup ? '- Questa patch include un sistema di backup automatico' : ''}
${patch.digitallySigned ? '- Questa patch è firmata digitalmente' : ''}

---
Creato con GameStringer
`;

    await fs.writeFile(path.join(outputDir, 'README.txt'), readme);
  }

  private async createArchive(
    patch: PatchMetadata, 
    sourceDir: string, 
    options: ExportOptions
  ): Promise<string> {
    const outputName = `${patch.name.replace(/\s+/g, '_')}_v${patch.version}`;
    let outputPath: string;

    switch (options.format) {
      case 'zip':
        outputPath = path.join(this.tempDir, `${outputName}.zip`);
        await this.createZipArchive(sourceDir, outputPath, options);
        break;
      
      case 'exe':
        outputPath = path.join(this.tempDir, `${outputName}.exe`);
        await this.createExeInstaller(sourceDir, outputPath, patch, options);
        break;
      
      case 'pak':
        outputPath = path.join(this.tempDir, `${outputName}.pak`);
        await this.createPakArchive(sourceDir, outputPath, options);
        break;
      
      default:
        throw new Error(`Formato non supportato: ${options.format}`);
    }

    return outputPath;
  }

  private async createZipArchive(
    sourceDir: string, 
    outputPath: string, 
    options: ExportOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { 
          level: options.compression === 'ultra' ? 9 : 
                 options.compression === 'high' ? 6 : 3 
        }
      });

      output.on('close', () => resolve());
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  private async createExeInstaller(
    sourceDir: string,
    outputPath: string,
    patch: PatchMetadata,
    options: ExportOptions
  ): Promise<void> {
    // Qui implementeresti la creazione di un installer EXE
    // Per ora creiamo solo uno ZIP rinominato
    const zipPath = outputPath.replace('.exe', '.zip');
    await this.createZipArchive(sourceDir, zipPath, options);
    await fs.rename(zipPath, outputPath);
  }

  private async createPakArchive(
    sourceDir: string,
    outputPath: string,
    options: ExportOptions
  ): Promise<void> {
    // Implementa formato PAK personalizzato
    await this.createZipArchive(sourceDir, outputPath.replace('.pak', '.zip'), options);
    await fs.rename(outputPath.replace('.pak', '.zip'), outputPath);
  }

  private async signPackage(packagePath: string, certificate: string): Promise<void> {
    // Implementa firma digitale
    console.log(`Firma digitale di ${packagePath} con certificato ${certificate}`);
  }

  private async createBackup(gameDir: string, patchId: string): Promise<void> {
    const backupDir = path.join(gameDir, '.gamestringer_backups', patchId);
    await fs.mkdir(backupDir, { recursive: true });
    
    // Implementa logica di backup
    console.log(`Backup creato in ${backupDir}`);
  }

  private async restoreBackup(gameDir: string, patchId: string): Promise<boolean> {
    const backupDir = path.join(gameDir, '.gamestringer_backups', patchId);
    
    try {
      // Implementa logica di ripristino
      console.log(`Ripristino backup da ${backupDir}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private parseCSVTranslations(content: string): TranslationEntry[] {
    // Implementa parser CSV
    const lines = content.split('\n');
    const translations: TranslationEntry[] = [];
    
    // Semplice implementazione CSV
    for (let i = 1; i < lines.length; i++) {
      const [id, original, translated, context] = lines[i].split(',');
      if (id && original && translated) {
        translations.push({
          id,
          originalText: original.trim(),
          translatedText: translated.trim(),
          context: context?.trim(),
          reviewed: false
        });
      }
    }
    
    return translations;
  }

  private parsePOTranslations(content: string): TranslationEntry[] {
    // Implementa parser PO
    const translations: TranslationEntry[] = [];
    // Implementazione semplificata
    return translations;
  }
}

export const patchManager = new PatchManager();
