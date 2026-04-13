/**
 * Project Export/Import System
 * Handles complete project serialization for backup, sharing, and migration
 */

export interface ExportFormat {
  version: string;
  format: 'gamestringer' | 'xliff' | 'json' | 'csv' | 'tmx';
  exportDate: string;
  metadata: ProjectMetadata;
  content: ExportContent;
}

export interface ProjectMetadata {
  projectId: string;
  projectName: string;
  gameName: string;
  gameId?: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
  modifiedAt: string;
  author?: string;
  notes?: string;
  stats: {
    totalStrings: number;
    translatedStrings: number;
    reviewedStrings: number;
    progress: number;
  };
}

export interface ExportContent {
  translations: TranslationEntry[];
  glossary: GlossaryEntry[];
  settings: ProjectSettings;
}

export interface TranslationEntry {
  id: string;
  source: string;
  target: string;
  context?: string;
  status: 'pending' | 'translated' | 'reviewed' | 'approved';
  notes?: string;
  translator?: string;
  modifiedAt?: string;
}

export interface GlossaryEntry {
  term: string;
  translation: string;
  context?: string;
  doNotTranslate?: boolean;
}

export interface ProjectSettings {
  aiProvider?: string;
  aiModel?: string;
  preserveFormatting?: boolean;
  useGlossary?: boolean;
  contextLines?: number;
  customPrompt?: string;
}

export interface ImportResult {
  success: boolean;
  projectId?: string;
  stats: {
    imported: number;
    skipped: number;
    errors: number;
  };
  errors?: string[];
}

class ProjectExportImport {
  private readonly CURRENT_VERSION = '1.0.0';

  /**
   * Export project to GameStringer format
   */
  async exportProject(
    metadata: ProjectMetadata,
    translations: TranslationEntry[],
    glossary: GlossaryEntry[],
    settings: ProjectSettings
  ): Promise<Blob> {
    const exportData: ExportFormat = {
      version: this.CURRENT_VERSION,
      format: 'gamestringer',
      exportDate: new Date().toISOString(),
      metadata,
      content: {
        translations,
        glossary,
        settings,
      },
    };

    const json = JSON.stringify(exportData, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Export to XLIFF format (industry standard)
   */
  async exportToXliff(
    metadata: ProjectMetadata,
    translations: TranslationEntry[]
  ): Promise<Blob> {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="${metadata.gameName}" source-language="${metadata.sourceLanguage}" target-language="${metadata.targetLanguage}" datatype="plaintext">
    <header>
      <tool tool-id="gamestringer" tool-name="GameStringer" tool-version="${this.CURRENT_VERSION}"/>
      <note>Exported from GameStringer on ${new Date().toISOString()}</note>
    </header>
    <body>
${translations.map(t => `      <trans-unit id="${t.id}" resname="${t.id}">
        <source>${this.escapeXml(t.source)}</source>
        <target state="${this.xliffState(t.status)}">${this.escapeXml(t.target)}</target>
${t.context ? `        <context-group><context>${this.escapeXml(t.context)}</context></context-group>` : ''}
${t.notes ? `        <note>${this.escapeXml(t.notes)}</note>` : ''}
      </trans-unit>`).join('\n')}
    </body>
  </file>
</xliff>`;

    return new Blob([xliff], { type: 'application/xml' });
  }

  /**
   * Export to CSV format
   */
  async exportToCsv(translations: TranslationEntry[]): Promise<Blob> {
    const headers = ['ID', 'Source', 'Target', 'Status', 'Context', 'Notes'];
    const rows = translations.map(t => [
      t.id,
      this.escapeCsv(t.source),
      this.escapeCsv(t.target),
      t.status,
      this.escapeCsv(t.context || ''),
      this.escapeCsv(t.notes || ''),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return new Blob([csv], { type: 'text/csv' });
  }

  /**
   * Export to TMX format (Translation Memory eXchange)
   */
  async exportToTmx(
    metadata: ProjectMetadata,
    translations: TranslationEntry[]
  ): Promise<Blob> {
    const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE tmx SYSTEM "tmx14.dtd">
<tmx version="1.4">
  <header creationtool="GameStringer" creationtoolversion="${this.CURRENT_VERSION}" 
          datatype="plaintext" segtype="sentence" 
          adminlang="en" srclang="${metadata.sourceLanguage}" 
          o-tmf="GameStringer"/>
  <body>
${translations.filter(t => t.target).map(t => `    <tu tuid="${t.id}">
      <tuv xml:lang="${metadata.sourceLanguage}">
        <seg>${this.escapeXml(t.source)}</seg>
      </tuv>
      <tuv xml:lang="${metadata.targetLanguage}">
        <seg>${this.escapeXml(t.target)}</seg>
      </tuv>
    </tu>`).join('\n')}
  </body>
</tmx>`;

    return new Blob([tmx], { type: 'application/xml' });
  }

  /**
   * Import from GameStringer format
   */
  async importProject(file: File): Promise<ImportResult> {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportFormat;

      if (!data.version || !data.content) {
        throw new Error('Invalid GameStringer project file');
      }

      // Version compatibility check
      if (!this.isVersionCompatible(data.version)) {
        throw new Error(`Incompatible version: ${data.version}`);
      }

      return {
        success: true,
        projectId: data.metadata.projectId,
        stats: {
          imported: data.content.translations.length,
          skipped: 0,
          errors: 0,
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        stats: { imported: 0, skipped: 0, errors: 1 },
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Import from CSV format
   */
  async importFromCsv(file: File): Promise<{ translations: TranslationEntry[]; errors: string[] }> {
    const text = await file.text();
    const lines = text.split('\n');
    const translations: TranslationEntry[] = [];
    const errors: string[] = [];

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parts = this.parseCsvLine(line);
        if (parts.length >= 3) {
          translations.push({
            id: parts[0] || `imported_${i}`,
            source: parts[1],
            target: parts[2],
            status: (parts[3] as TranslationEntry['status']) || 'translated',
            context: parts[4],
            notes: parts[5],
          });
        }
      } catch (error: unknown) {
        errors.push(`Line ${i + 1}: ${(error as Error).message}`);
      }
    }

    return { translations, errors };
  }

  /**
   * Import from XLIFF format
   */
  async importFromXliff(file: File): Promise<{ translations: TranslationEntry[]; errors: string[] }> {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const translations: TranslationEntry[] = [];
    const errors: string[] = [];

    const transUnits = doc.querySelectorAll('trans-unit');
    transUnits.forEach((unit, index) => {
      try {
        const id = unit.getAttribute('id') || `xliff_${index}`;
        const source = unit.querySelector('source')?.textContent || '';
        const target = unit.querySelector('target')?.textContent || '';
        const state = unit.querySelector('target')?.getAttribute('state');

        translations.push({
          id,
          source,
          target,
          status: this.xliffStateToStatus(state ?? null),
        });
      } catch (error: unknown) {
        errors.push(`Unit ${index}: ${(error as Error).message}`);
      }
    });

    return { translations, errors };
  }

  /**
   * Merge imported translations with existing
   */
  mergeTranslations(
    existing: TranslationEntry[],
    imported: TranslationEntry[],
    strategy: 'overwrite' | 'skip' | 'merge-empty'
  ): TranslationEntry[] {
    const existingMap = new Map(existing.map(t => [t.id, t]));

    for (const imp of imported) {
      const ex = existingMap.get(imp.id);
      
      if (!ex) {
        existingMap.set(imp.id, imp);
      } else {
        switch (strategy) {
          case 'overwrite':
            existingMap.set(imp.id, imp);
            break;
          case 'merge-empty':
            if (!ex.target && imp.target) {
              existingMap.set(imp.id, { ...ex, target: imp.target, status: 'translated' });
            }
            break;
          case 'skip':
          default:
            break;
        }
      }
    }

    return Array.from(existingMap.values());
  }

  // Helper methods
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private escapeCsv(text: string): string {
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  private xliffState(status: TranslationEntry['status']): string {
    switch (status) {
      case 'approved': return 'final';
      case 'reviewed': return 'signed-off';
      case 'translated': return 'translated';
      default: return 'new';
    }
  }

  private xliffStateToStatus(state: string | null): TranslationEntry['status'] {
    switch (state) {
      case 'final': return 'approved';
      case 'signed-off': return 'reviewed';
      case 'translated': return 'translated';
      default: return 'pending';
    }
  }

  private isVersionCompatible(version: string): boolean {
    const [major] = version.split('.');
    const [currentMajor] = this.CURRENT_VERSION.split('.');
    return major === currentMajor;
  }
}

export const projectExportImport = new ProjectExportImport();
export default projectExportImport;
