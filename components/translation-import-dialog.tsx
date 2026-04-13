'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';

interface TranslationImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  games: Array<{ id: string; title: string }>;
  onImportComplete: () => void;
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
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const parseCSV = async (text: string): Promise<unknown[]> => {
    const lines = text.split('\n').filter(line => line.trim());
    const _headers = lines[0].split(',').map(h => h.trim());

    const translations = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^,]+)/g) || [];
      const cleanValues = values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
      
      if (cleanValues.length >= 3) {
        translations.push({
          filePath: cleanValues[0] || 'unknown',
          originalText: cleanValues[1] || '',
          translatedText: cleanValues[2] || '',
          targetLanguage: cleanValues[3] || 'it',
          sourceLanguage: 'en',
          context: cleanValues[5] || undefined
        });
      }
    }
    
    return translations;
  };

  const parseJSON = async (text: string): Promise<unknown[]> => {
    try {
      const data = JSON.parse(text);
      
      // Supporta sia array diretto che oggetto con campo translations
      const translations = Array.isArray(data) ? data : (data.translations || []);
      
      return translations.map((item: Record<string, unknown>) => ({
        filePath: (item.filePath as string) || 'unknown',
        originalText: (item.originalText as string) || '',
        translatedText: (item.translatedText as string) || '',
        targetLanguage: (item.targetLanguage as string) || 'it',
        sourceLanguage: (item.sourceLanguage as string) || 'en',
        context: item.context as string | undefined
      }));
    } catch {
      throw new Error('Invalid JSON format');
    }
  };

  const handleImport = async () => {
    if (!selectedGame || !selectedFile) {
      toast({
        title: 'Error',
        description: 'Select a game and file to import',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    
    try {
      const text = await selectedFile.text();
      let translations: unknown[] = [];
      
      if (selectedFile.name.endsWith('.csv')) {
        translations = await parseCSV(text);
      } else if (selectedFile.name.endsWith('.json')) {
        translations = await parseJSON(text);
      } else {
        throw new Error('Unsupported file format');
      }

      if (translations.length === 0) {
        throw new Error('No translations found in file');
      }

      // Import diretto in Translation Memory (no API routes in Tauri)
      let imported = 0;
      const total = translations.length;
      
      for (const item of translations) {
        try {
          const rec = item as Record<string, unknown>;
          const tmData = JSON.parse(localStorage.getItem('gs_translation_memory') || '[]');
          tmData.push({
            id: `import-${Date.now()}-${imported}`,
            sourceText: rec.source || rec.original,
            targetText: rec.target || rec.translated,
            gameId: selectedGame,
            provider: 'import',
            confidence: 0.9,
            createdAt: new Date().toISOString()
          });
          localStorage.setItem('gs_translation_memory', JSON.stringify(tmData));
          imported++;
        } catch {}
      }
      
      toast({
        title: 'Import completed',
        description: `Imported ${imported} of ${total} translations`
      });
      
      onImportComplete();
      onOpenChange(false);
      
      // Reset form
      setSelectedGame('');
      setSelectedFile(null);
    } catch (error: unknown) {
      clientLogger.error(`Import error: ${String(error)}`);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error during import',
        variant: 'destructive'
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
                <SelectValue placeholder="Select a game" />
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


