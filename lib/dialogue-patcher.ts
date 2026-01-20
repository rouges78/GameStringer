import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export interface DialogueEntry {
  id: string;
  characterEN: string;
  characterIT?: string;
  textEN: string;
  textIT?: string;
  context?: string;
  notes?: string;
}

export interface DialoguePatch {
  gameId: string;
  gameName: string;
  sourceFile: string;
  targetLanguage: string;
  entries: DialogueEntry[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    author?: string;
  };
}

export class DialoguePatcher {
  private delimiter = '\t'; // Tab delimiter for Decarnation files

  /**
   * Parse dialogue file from Decarnation or similar games
   */
  parseDialogueFile(filePath: string): any[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Parse TSV/CSV with flexible options
    const records = parse(content, {
      delimiter: this.delimiter,
      relax_quotes: true,
      skip_empty_lines: true,
      skip_records_with_error: true,
      columns: false // We'll handle columns manually due to inconsistent structure
    });

    return records;
  }

  /**
   * Extract dialogue entries from parsed records
   */
  extractDialogues(records: any[]): DialogueEntry[] {
    const dialogues: DialogueEntry[] = [];
    
    // Column indices for Decarnation format
    const ENGLISH_COL = 7;
    const CHARACTER_EN_COL = 4;
    const ID_COL = 0;
    const SCENE_COL = 1;
    
    for (const record of records) {
      // Skip header or empty rows
      if (!record || record.length < 8) continue;
      
      const englishText = record[ENGLISH_COL]?.trim();
      const characterName = record[CHARACTER_EN_COL]?.trim();
      const id = `${record[ID_COL]}_${record[SCENE_COL]}`.trim();
      
      // Skip non-dialogue entries
      if (!englishText || englishText === '' || 
          englishText.startsWith('Cut to') || 
          englishText.includes('blank') ||
          characterName === '') {
        continue;
      }
      
      dialogues.push({
        id,
        characterEN: characterName || 'Narrator',
        textEN: englishText,
        context: record[SCENE_COL] || undefined
      });
    }
    
    return dialogues;
  }

  /**
   * Create a translation patch for Italian
   */
  createItalianPatch(dialogues: DialogueEntry[]): DialoguePatch {
    // Add Italian translations
    const translatedEntries = dialogues.map(entry => ({
      ...entry,
      characterIT: this.translateCharacterName(entry.characterEN),
      textIT: '' // Will be filled by translation service or manually
    }));

    return {
      gameId: 'decarnation',
      gameName: 'Decarnation',
      sourceFile: 'dialogues-resources.assets-52.txt',
      targetLanguage: 'it',
      entries: translatedEntries,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        author: 'GameStringer'
      }
    };
  }

  /**
   * Translate character names to Italian
   */
  private translateCharacterName(name: string): string {
    const translations: Record<string, string> = {
      'Gloria': 'Gloria',
      'Petrus': 'Pietro',
      'Joy': 'Gioia',
      'Narrator': 'Narratore'
    };
    
    return translations[name] || name;
  }

  /**
   * Apply patch to original file
   */
  applyPatch(originalPath: string, patch: DialoguePatch, outputPath: string): void {
    const records = this.parseDialogueFile(originalPath);
    const patchMap = new Map(patch.entries.map(e => [e.id, e]));
    
    // Update records with translations
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record || record.length < 8) continue;
      
      const id = `${record[0]}_${record[1]}`.trim();
      const patchEntry = patchMap.get(id);
      
      if (patchEntry && patchEntry.textIT) {
        // Replace English text with Italian in the English column
        record[7] = patchEntry.textIT;
        
        // Update character name if needed
        if (patchEntry.characterIT) {
          record[4] = patchEntry.characterIT;
        }
      }
    }
    
    // Write patched file
    const output = stringify(records, {
      delimiter: this.delimiter
    });
    
    fs.writeFileSync(outputPath, output, 'utf-8');
  }

  /**
   * Export patch to JSON for editing
   */
  exportPatch(patch: DialoguePatch, outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(patch, null, 2), 'utf-8');
  }

  /**
   * Import patch from JSON
   */
  importPatch(patchPath: string): DialoguePatch {
    const content = fs.readFileSync(patchPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Generate translation template
   */
  generateTranslationTemplate(dialogues: DialogueEntry[], outputPath: string): void {
    const template = dialogues.map(d => ({
      id: d.id,
      character: d.characterEN,
      english: d.textEN,
      italian: '',
      notes: ''
    }));

    const csv = stringify(template, {
      header: true,
      columns: ['id', 'character', 'english', 'italian', 'notes']
    });

    fs.writeFileSync(outputPath, csv, 'utf-8');
  }
}

// Export singleton instance
export const dialoguePatcher = new DialoguePatcher();
