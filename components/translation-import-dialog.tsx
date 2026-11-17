'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { listEditorTranslations, upsertEditorTranslations } from '@/lib/editor-translations-store';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

interface TranslationImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  games: Array<{ id: string; title: string }>;
  /** Chiamata solo se almeno una traduzione è stata davvero salvata, con il gioco di destinazione. */
  onImportComplete: (gameId: string) => void;
}

/** Una riga letta dal file di import, già normalizzata. */
export interface ImportRow {
  filePath?: string;
  originalText: string;
  translatedText: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  context?: string;
}

type StoreRow = Record<string, unknown>;

/**
 * Tokenizer CSV (RFC 4180): campi tra virgolette con "" come escape, campi vuoti,
 * CRLF e a-capo dentro i campi quotati. Il vecchio parser usava una regex che
 * saltava i campi vuoti (le colonne scorrevano) e spezzava le righe sugli a-capo.
 */
export function parseCsvRecords(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some(v => v.trim() !== '')) records.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else {
      field += c;
    }
  }
  endRow();
  return records;
}

// Nomi di colonna riconosciuti (minuscolo, solo lettere). Includono l'header
// che l'Editor stesso scrive in export (original,translated,status,targetLanguage).
const CSV_COLUMNS: Record<keyof ImportRow, string[]> = {
  filePath: ['filepath', 'file', 'path'],
  originalText: ['original', 'originaltext', 'source', 'sourcetext'],
  translatedText: ['translated', 'translatedtext', 'translation', 'target', 'targettext'],
  targetLanguage: ['targetlanguage', 'targetlang'],
  sourceLanguage: ['sourcelanguage', 'sourcelang'],
  context: ['context', 'key'],
};

/**
 * CSV → righe di import. La prima riga è l'header: se nomina le colonne di testo
 * originale e tradotto si mappa per nome, altrimenti si usa lo schema posizionale
 * storico (filePath, original, translated, targetLanguage, —, context).
 */
export function parseImportCsv(text: string): ImportRow[] {
  const [header, ...records] = parseCsvRecords(text);
  if (!header) return [];
  const names = header.map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (field: keyof ImportRow) => names.findIndex(n => CSV_COLUMNS[field].includes(n));
  const byName = col('originalText') >= 0 && col('translatedText') >= 0;
  const index: Record<keyof ImportRow, number> = byName
    ? {
        filePath: col('filePath'),
        originalText: col('originalText'),
        translatedText: col('translatedText'),
        targetLanguage: col('targetLanguage'),
        sourceLanguage: col('sourceLanguage'),
        context: col('context'),
      }
    : { filePath: 0, originalText: 1, translatedText: 2, targetLanguage: 3, sourceLanguage: -1, context: 5 };
  const at = (rec: string[], i: number) => (i >= 0 ? rec[i] ?? '' : '');
  return records.map(rec => ({
    filePath: at(rec, index.filePath).trim() || undefined,
    originalText: at(rec, index.originalText),
    translatedText: at(rec, index.translatedText),
    targetLanguage: at(rec, index.targetLanguage).trim() || undefined,
    sourceLanguage: at(rec, index.sourceLanguage).trim() || undefined,
    context: at(rec, index.context).trim() || undefined,
  }));
}

/** JSON → righe di import: array diretto o `{ translations: [...] }` (anche l'export JSON dell'Editor). */
export function parseImportJson(text: string): ImportRow[] {
  const data: unknown = JSON.parse(text);
  const list = Array.isArray(data)
    ? data
    : ((data as { translations?: unknown } | null)?.translations ?? []);
  if (!Array.isArray(list)) return [];
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return list.map((raw): ImportRow => {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      filePath: str(item.filePath) || undefined,
      originalText: str(item.originalText) || str(item.original) || str(item.source) || str(item.sourceText),
      translatedText: str(item.translatedText) || str(item.translated) || str(item.target) || str(item.targetText),
      targetLanguage: str(item.targetLanguage) || undefined,
      sourceLanguage: str(item.sourceLanguage) || undefined,
      context: str(item.context) || undefined,
    };
  });
}

/**
 * Fonde le righe importate nei record dello store dell'Editor (stesso shape che
 * l'Editor legge e scrive). Una stringa già presente per lo stesso gioco e la
 * stessa lingua viene aggiornata invece di duplicarla. Le righe senza testo
 * originale o tradotto sono saltate. `written` = una coppia [id, testo tradotto]
 * per ogni riga accettata: le righe ripetute nel file finiscono nello stesso
 * record, ma contano ognuna (una ripetizione non è un import fallito).
 */
export function mergeImportRows(
  existing: StoreRow[],
  rows: ImportRow[],
  game: { id: string; title: string },
  defaultTargetLang: string,
  now: string,
): { merged: StoreRow[]; written: Array<[string, string]> } {
  const merged = existing.slice();
  const written: Array<[string, string]> = [];
  const keyOf = (original: string, target: string) => `${target}\u0000${original}`;
  const index = new Map<string, number>();
  merged.forEach((r, i) => {
    if (r.gameId === game.id && typeof r.originalText === 'string') {
      index.set(keyOf(r.originalText, String(r.targetLanguage ?? '')), i);
    }
  });
  rows.forEach((row, i) => {
    if (!row.originalText.trim() || !row.translatedText.trim()) return;
    const targetLanguage = row.targetLanguage || defaultTargetLang;
    const key = keyOf(row.originalText, targetLanguage);
    const at = index.get(key);
    if (at !== undefined) {
      const id = String(merged[at].id);
      merged[at] = { ...merged[at], translatedText: row.translatedText, status: 'completed', updatedAt: now };
      written.push([id, row.translatedText]);
      return;
    }
    const id = `import-${game.id}-${Date.parse(now)}-${i}`;
    merged.push({
      id,
      gameId: game.id,
      filePath: row.filePath || 'import',
      originalText: row.originalText,
      translatedText: row.translatedText,
      targetLanguage,
      sourceLanguage: row.sourceLanguage || 'en',
      status: 'completed',
      confidence: 0,
      isManualEdit: false,
      ...(row.context ? { context: row.context } : {}),
      updatedAt: now,
      game: { id: game.id, title: game.title, platform: 'import' },
      suggestions: [],
    });
    index.set(key, merged.length - 1);
    written.push([id, row.translatedText]);
  });
  return { merged, written };
}

/** Quante righe scritte si ritrovano davvero nello store riletto, con il testo scritto. */
export function countStoredImports(stored: StoreRow[], written: Array<[string, string]>): number {
  const byId = new Map(stored.map(r => [String(r.id), r] as const));
  let n = 0;
  for (const [id, text] of written) {
    if (byId.get(id)?.translatedText === text) n++;
  }
  return n;
}

export function TranslationImportDialog({
  open,
  onOpenChange,
  games,
  onImportComplete
}: TranslationImportDialogProps) {
  const { t } = useTranslation();
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  // Lingua di destinazione per le righe che non la dichiarano (prima: 'it' fisso).
  const [defaultTargetLang, setDefaultTargetLang] = useState('en');
  useDefaultTargetLang(setDefaultTargetLang);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    const game = games.find(g => g.id === selectedGame);
    if (!game || !selectedFile) {
      toast.error(t('common.selectAGameAndFileToImport'));
      return;
    }

    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.json')) {
      toast.error(t('exportDialogComp.formatoNonSupportato'));
      return;
    }

    setIsImporting(true);

    try {
      const text = await selectedFile.text();
      let rows: ImportRow[];
      if (name.endsWith('.csv')) {
        rows = parseImportCsv(text);
      } else {
        try {
          rows = parseImportJson(text);
        } catch {
          toast.error(t('common.fileJsonNonValido'));
          return;
        }
      }

      if (rows.length === 0) {
        toast.error(t('dictionary.noTranslationsFound'));
        return;
      }

      // Scrive nello store che l'Editor legge (listEditorTranslations). Una lettura
      // che fallisce rigetta (finisce nel catch) invece di dare [], che riscritto
      // cancellerebbe le stringhe già salvate.
      const existing = await listEditorTranslations();
      const { merged, written } = mergeImportRows(existing, rows, game, defaultTargetLang, new Date().toISOString());
      if (written.length === 0) {
        toast.error(t('translationImportDialogComp.noValidRows'));
        return;
      }

      // Solo i record toccati, in un'unica lettura+scrittura (un upsert per riga
      // riscriverebbe l'intero array ogni volta). Rigetta se lo store non li salva.
      const writtenIds = new Set(written.map(([id]) => id));
      try {
        await upsertEditorTranslations(merged.filter(r => writtenIds.has(String(r.id))));
      } catch (saveError: unknown) {
        clientLogger.error(`Import save error: ${String(saveError)}`);
        toast.error(t('common.impossibileSalvareLeTraduzioni'));
        return;
      }

      // Si conta solo ciò che si rilegge davvero dallo store.
      const imported = countStoredImports(await listEditorTranslations({ gameId: game.id }), written);
      const total = rows.length;
      const summary = t('translationImportDialogComp.importResult')
        .replace('{n}', String(imported))
        .replace('{total}', String(total));

      if (imported === 0) {
        toast.error(t('common.impossibileSalvareLeTraduzioni'));
        return;
      }

      if (imported < total) toast.warning(summary);
      else toast.success(summary);

      onImportComplete(game.id);
      onOpenChange(false);

      // Reset form
      setSelectedGame('');
      setSelectedFile(null);
    } catch (error: unknown) {
      clientLogger.error(`Import error: ${String(error)}`);
      toast.error(t('common.error'), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('translationImportDialogComp.importTranslations')}</DialogTitle>
          <DialogDescription>
            Import translations from CSV or JSON file
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="game">{t('translationImportDialogComp.game')}</Label>
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger id="game">
                <SelectValue placeholder={t('common.selectAGame')} />
              </SelectTrigger>
              <SelectContent>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="file">{t('translationImportDialogComp.translationFile')}</Label>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => document.getElementById('import-file-input')?.click()}
              >
                <FileText className="h-4 w-4 mr-2" />
                {selectedFile ? selectedFile.name : 'Choose file...'}
              </Button>
              <input
                id="import-file-input"
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Supported formats: CSV, JSON
            </p>
          </div>
          
          {selectedFile && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{t('translationImportDialogComp.detectedFileFormat')}</p>
              <p className="text-sm text-muted-foreground">
                {selectedFile.name.endsWith('.csv') ? 'CSV' : 'JSON'}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedGame || !selectedFile || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



