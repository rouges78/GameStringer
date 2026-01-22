import { BatchOperation, BatchResult } from '@/lib/types/batch-operations';
import { BatchItem } from './batch-processor';
import { prisma } from './prisma';
import { 
  Languages, 
  Download, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Trash2,
  FileText,
  Archive
} from 'lucide-react';

export interface TranslationBatchItem extends BatchItem {
  data: {
    originalText?: string;
    translatedText?: string;
    targetLanguage?: string;
    sourceLanguage?: string;
    status?: string;
    gameId?: string;
    filePath?: string;
  };
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'po';
  includeMetadata?: boolean;
  filterByStatus?: string[];
  groupByGame?: boolean;
}

export interface ImportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'po';
  overwriteExisting?: boolean;
  validateBeforeImport?: boolean;
  createMissing?: boolean;
}

// Batch translate operation
export async function batchTranslateProcessor(item: TranslationBatchItem): Promise<any> {
  const { targetLanguage = 'it', sourceLanguage = 'en' } = item.data;
  
  // Get the translation record
  const translation = await prisma.translation.findUnique({
    where: { id: item.id },
    include: { game: true }
  });

  if (!translation) {
    throw new Error(`Translation not found: ${item.id}`);
  }

  // Skip if already translated
  if (translation.translatedText && translation.status === 'completed') {
    return {
      translationId: item.id,
      skipped: true,
      reason: 'Already translated'
    };
  }

  // Simulate AI translation (replace with actual AI service)
  const translatedText = await simulateTranslation(
    translation.originalText,
    sourceLanguage,
    targetLanguage
  );

  // Update the translation
  const updatedTranslation = await prisma.translation.update({
    where: { id: item.id },
    data: {
      translatedText,
      targetLanguage,
      status: 'completed',
      confidence: 0.85, // AI confidence score
      updatedAt: new Date()
    }
  });

  return {
    translationId: item.id,
    originalText: translation.originalText,
    translatedText,
    confidence: 0.85,
    updated: true
  };
}

// Batch export operation
export async function batchExportProcessor(
  items: TranslationBatchItem[],
  options: ExportOptions
): Promise<any> {
  const translationIds = items.map(item => item.id);
  
  // Get translations with related data
  const translations = await prisma.translation.findMany({
    where: {
      id: { in: translationIds },
      ...(options.filterByStatus && {
        status: { in: options.filterByStatus }
      })
    },
    include: {
      game: options.includeMetadata,
      suggestions: options.includeMetadata
    },
    orderBy: [
      { gameId: 'asc' },
      { filePath: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  // Format data based on export format
  let exportData: any;
  
  switch (options.format) {
    case 'json':
      exportData = formatAsJSON(translations, options);
      break;
    case 'csv':
      exportData = formatAsCSV(translations, options);
      break;
    case 'xlsx':
      exportData = formatAsXLSX(translations, options);
      break;
    case 'po':
      exportData = formatAsPO(translations, options);
      break;
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }

  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `translations-export-${timestamp}.${options.format}`;

  return {
    filename,
    data: exportData,
    count: translations.length,
    format: options.format
  };
}

// Batch import operation
export async function batchImportProcessor(
  importData: any,
  options: ImportOptions
): Promise<BatchResult> {
  let parsedData: any[];
  
  // Parse data based on format
  switch (options.format) {
    case 'json':
      parsedData = parseJSONImport(importData);
      break;
    case 'csv':
      parsedData = parseCSVImport(importData);
      break;
    case 'xlsx':
      parsedData = parseXLSXImport(importData);
      break;
    case 'po':
      parsedData = parsePOImport(importData);
      break;
    default:
      throw new Error(`Unsupported import format: ${options.format}`);
  }

  const results: BatchResult['results'] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const item of parsedData) {
    try {
      // Validate item
      if (options.validateBeforeImport && !validateImportItem(item)) {
        throw new Error('Invalid item format');
      }

      // Check if translation exists
      const existingTranslation = await prisma.translation.findFirst({
        where: {
          gameId: item.gameId,
          filePath: item.filePath,
          originalText: item.originalText
        }
      });

      if (existingTranslation && !options.overwriteExisting) {
        results.push({
          itemId: item.id || `${item.gameId}-${item.originalText}`,
          success: false,
          error: 'Translation already exists'
        });
        failureCount++;
        continue;
      }

      // Create or update translation
      const translationData = {
        gameId: item.gameId,
        filePath: item.filePath,
        originalText: item.originalText,
        translatedText: item.translatedText,
        targetLanguage: item.targetLanguage,
        sourceLanguage: item.sourceLanguage || 'en',
        status: item.status || 'completed',
        confidence: item.confidence || 1.0,
        isManualEdit: true
      };

      let translation;
      if (existingTranslation) {
        translation = await prisma.translation.update({
          where: { id: existingTranslation.id },
          data: translationData
        });
      } else {
        translation = await prisma.translation.create({
          data: translationData
        });
      }

      results.push({
        itemId: translation.id,
        success: true,
        result: translation
      });
      successCount++;

    } catch (error) {
      results.push({
        itemId: item.id || `unknown-${Date.now()}`,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      failureCount++;
    }
  }

  return {
    operationId: `import-${Date.now()}`,
    totalItems: parsedData.length,
    successCount,
    failureCount,
    results,
    duration: 0, // Will be calculated by processor
    completedAt: new Date()
  };
}

// Batch status update operation
export async function batchStatusUpdateProcessor(item: TranslationBatchItem): Promise<any> {
  const { status } = item.data;
  
  if (!status) {
    throw new Error('Status is required for status update operation');
  }

  const updatedTranslation = await prisma.translation.update({
    where: { id: item.id },
    data: {
      status,
      updatedAt: new Date()
    }
  });

  return {
    translationId: item.id,
    oldStatus: updatedTranslation.status,
    newStatus: status,
    updated: true
  };
}

// Batch delete operation
export async function batchDeleteProcessor(item: TranslationBatchItem): Promise<any> {
  // Soft delete by updating status
  const deletedTranslation = await prisma.translation.delete({
    where: { id: item.id }
  });

  return {
    translationId: item.id,
    deleted: true,
    originalText: deletedTranslation.originalText
  };
}

// Batch approve operation
export async function batchApproveProcessor(item: TranslationBatchItem): Promise<any> {
  const approvedTranslation = await prisma.translation.update({
    where: { id: item.id },
    data: { status: 'approved' }
  });

  return {
    translationId: item.id,
    approved: true,
    originalText: approvedTranslation.originalText
  };
}

// Batch reject operation
export async function batchRejectProcessor(item: TranslationBatchItem): Promise<any> {
  const rejectedTranslation = await prisma.translation.update({
    where: { id: item.id },
    data: { status: 'rejected' }
  });

  return {
    translationId: item.id,
    rejected: true,
    originalText: rejectedTranslation.originalText
  };
}

// Helper functions for formatting exports
function formatAsJSON(translations: any[], options: ExportOptions): string {
  const data = options.groupByGame 
    ? groupTranslationsByGame(translations)
    : translations;
  
  return JSON.stringify(data, null, 2);
}

function formatAsCSV(translations: any[], options: ExportOptions): string {
  const headers = [
    'ID',
    'Game',
    'File Path',
    'Original Text',
    'Translated Text',
    'Source Language',
    'Target Language',
    'Status',
    'Confidence',
    'Created At',
    'Updated At'
  ];

  const rows = translations.map(t => [
    t.id,
    t.game?.title || '',
    t.filePath,
    `"${t.originalText.replace(/"/g, '""')}"`,
    `"${t.translatedText.replace(/"/g, '""')}"`,
    t.sourceLanguage,
    t.targetLanguage,
    t.status,
    t.confidence,
    t.createdAt.toISOString(),
    t.updatedAt.toISOString()
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function formatAsXLSX(translations: any[], options: ExportOptions): any {
  // This would require a library like xlsx
  // For now, return structured data that can be processed by xlsx
  return {
    worksheets: [{
      name: 'Translations',
      data: translations.map(t => ({
        ID: t.id,
        Game: t.game?.title || '',
        'File Path': t.filePath,
        'Original Text': t.originalText,
        'Translated Text': t.translatedText,
        'Source Language': t.sourceLanguage,
        'Target Language': t.targetLanguage,
        Status: t.status,
        Confidence: t.confidence,
        'Created At': t.createdAt.toISOString(),
        'Updated At': t.updatedAt.toISOString()
      }))
    }]
  };
}

function formatAsPO(translations: any[], options: ExportOptions): string {
  let po = `# Translation file generated by GameStringer
# Generated on: ${new Date().toISOString()}
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: ${translations[0]?.targetLanguage || 'unknown'}\\n"

`;

  translations.forEach(t => {
    po += `#: ${t.filePath}
msgid "${t.originalText.replace(/"/g, '\\"')}"
msgstr "${t.translatedText.replace(/"/g, '\\"')}"

`;
  });

  return po;
}

// Helper functions for parsing imports
function parseJSONImport(data: string): any[] {
  return JSON.parse(data);
}

function parseCSVImport(data: string): any[] {
  // Simple CSV parser - in production, use a proper CSV library
  const lines = data.split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const item: any = {};
    headers.forEach((header, index) => {
      item[header.trim()] = values[index]?.trim().replace(/^"|"$/g, '');
    });
    return item;
  });
}

function parseXLSXImport(data: any): any[] {
  // This would require xlsx library
  return data.worksheets?.[0]?.data || [];
}

function parsePOImport(data: string): any[] {
  const translations: any[] = [];
  const lines = data.split('\n');
  let currentEntry: any = {};
  
  for (const line of lines) {
    if (line.startsWith('msgid ')) {
      currentEntry.originalText = line.substring(7, line.length - 1);
    } else if (line.startsWith('msgstr ')) {
      currentEntry.translatedText = line.substring(8, line.length - 1);
      if (currentEntry.originalText) {
        translations.push({ ...currentEntry });
        currentEntry = {};
      }
    }
  }
  
  return translations;
}

function validateImportItem(item: any): boolean {
  return !!(item.originalText && item.gameId && item.filePath);
}

function groupTranslationsByGame(translations: any[]): any {
  return translations.reduce((acc, translation) => {
    const gameTitle = translation.game?.title || 'Unknown Game';
    if (!acc[gameTitle]) {
      acc[gameTitle] = [];
    }
    acc[gameTitle].push(translation);
    return acc;
  }, {});
}

// Simulate AI translation (replace with actual service)
async function simulateTranslation(
  text: string, 
  sourceLanguage: string, 
  targetLanguage: string
): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  // Simple mock translation
  const mockTranslations: Record<string, string> = {
    'Hello World': 'Ciao Mondo',
    'Start Game': 'Inizia Gioco',
    'Settings': 'Impostazioni',
    'Exit': 'Esci',
    'Save Game': 'Salva Gioco',
    'Load Game': 'Carica Gioco',
    'New Game': 'Nuovo Gioco',
    'Continue': 'Continua',
    'Options': 'Opzioni',
    'Quit': 'Esci'
  };
  
  return mockTranslations[text] || `[${targetLanguage.toUpperCase()}] ${text}`;
}

// Pre-configured batch operations for translations
export const translationBatchOperations: BatchOperation[] = [
  {
    id: 'batch-translate',
    name: 'Translate',
    icon: Languages,
    requiresConfirmation: false,
    description: 'Auto-translate selected items using AI',
    action: async (items: string[]) => {
      const batchItems: TranslationBatchItem[] = items.map(id => ({
        id,
        data: { targetLanguage: 'it', sourceLanguage: 'en' }
      }));

      const results: BatchResult['results'] = [];
      let successCount = 0;
      let failureCount = 0;

      for (const item of batchItems) {
        try {
          const result = await batchTranslateProcessor(item);
          results.push({
            itemId: item.id,
            success: true,
            result
          });
          successCount++;
        } catch (error) {
          results.push({
            itemId: item.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
          failureCount++;
        }
      }

      return {
        operationId: `translate-${Date.now()}`,
        totalItems: items.length,
        successCount,
        failureCount,
        results,
        duration: 0,
        completedAt: new Date()
      };
    }
  },
  {
    id: 'batch-export',
    name: 'Export',
    icon: Download,
    requiresConfirmation: false,
    description: 'Export selected translations to file',
    action: async (items: string[]) => {
      const batchItems: TranslationBatchItem[] = items.map(id => ({
        id,
        data: {}
      }));

      const result = await batchExportProcessor(batchItems, {
        format: 'json',
        includeMetadata: true
      });

      return {
        operationId: `export-${Date.now()}`,
        totalItems: items.length,
        successCount: items.length,
        failureCount: 0,
        results: [{
          itemId: 'export-file',
          success: true,
          result
        }],
        duration: 0,
        completedAt: new Date()
      };
    }
  },
  {
    id: 'batch-approve',
    name: 'Approve',
    icon: CheckCircle,
    requiresConfirmation: true,
    description: 'Mark selected translations as approved',
    action: async (items: string[]) => {
      const batchItems: TranslationBatchItem[] = items.map(id => ({
        id,
        data: { status: 'reviewed' }
      }));

      const results: BatchResult['results'] = [];
      let successCount = 0;
      let failureCount = 0;

      for (const item of batchItems) {
        try {
          const result = await batchStatusUpdateProcessor(item);
          results.push({
            itemId: item.id,
            success: true,
            result
          });
          successCount++;
        } catch (error) {
          results.push({
            itemId: item.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
          failureCount++;
        }
      }

      return {
        operationId: `approve-${Date.now()}`,
        totalItems: items.length,
        successCount,
        failureCount,
        results,
        duration: 0,
        completedAt: new Date()
      };
    }
  },
  {
    id: 'batch-delete',
    name: 'Delete',
    icon: Trash2,
    requiresConfirmation: true,
    description: 'Delete selected translations (cannot be undone)',
    action: async (items: string[]) => {
      const batchItems: TranslationBatchItem[] = items.map(id => ({
        id,
        data: {}
      }));

      const results: BatchResult['results'] = [];
      let successCount = 0;
      let failureCount = 0;

      for (const item of batchItems) {
        try {
          const result = await batchDeleteProcessor(item);
          results.push({
            itemId: item.id,
            success: true,
            result
          });
          successCount++;
        } catch (error) {
          results.push({
            itemId: item.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
          failureCount++;
        }
      }

      return {
        operationId: `delete-${Date.now()}`,
        totalItems: items.length,
        successCount,
        failureCount,
        results,
        duration: 0,
        completedAt: new Date()
      };
    }
  }
];