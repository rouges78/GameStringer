'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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

  const parseCSV = async (text: string): Promise<any[]> => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
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

  const parseJSON = async (text: string): Promise<any[]> => {
    try {
      const data = JSON.parse(text);
      
      // Supporta sia array diretto che oggetto con campo translations
      const translations = Array.isArray(data) ? data : (data.translations || []);
      
      return translations.map((t: any) => ({
        filePath: t.filePath || 'unknown',
        originalText: t.originalText || '',
        translatedText: t.translatedText || '',
        targetLanguage: t.targetLanguage || 'it',
        sourceLanguage: t.sourceLanguage || 'en',
        context: t.context
      }));
    } catch (error) {
      throw new Error('Formato JSON non valido');
    }
  };

  const handleImport = async () => {
    if (!selectedGame || !selectedFile) {
      toast({
        title: 'Errore',
        description: 'Seleziona un gioco e un file da importare',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    
    try {
      const text = await selectedFile.text();
      let translations: any[] = [];
      
      if (selectedFile.name.endsWith('.csv')) {
        translations = await parseCSV(text);
      } else if (selectedFile.name.endsWith('.json')) {
        translations = await parseJSON(text);
      } else {
        throw new Error('Formato file non supportato');
      }

      if (translations.length === 0) {
        throw new Error('Nessuna traduzione trovata nel file');
      }

      // Invia le traduzioni all'API
      const response = await fetch('/api/translations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: selectedGame,
          translations
        })
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'importazione');
      }

      const result = await response.json();
      
      toast({
        title: 'Importazione completata',
        description: `Importate ${result.imported} traduzioni su ${result.total}`
      });
      
      onImportComplete();
      onOpenChange(false);
      
      // Reset form
      setSelectedGame('');
      setSelectedFile(null);
    } catch (error) {
      console.error('Errore nell\'importazione:', error);
      toast({
        title: 'Errore',
        description: error instanceof Error ? error.message : 'Errore durante l\'importazione',
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
          <DialogTitle>Importa Traduzioni</DialogTitle>
          <DialogDescription>
            Importa traduzioni da un file CSV o JSON
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="game">Gioco</Label>
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger id="game">
                <SelectValue placeholder="Seleziona un gioco" />
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
            <Label htmlFor="file">File di traduzione</Label>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => document.getElementById('import-file-input')?.click()}
              >
                <FileText className="h-4 w-4 mr-2" />
                {selectedFile ? selectedFile.name : 'Scegli file...'}
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
              Formati supportati: CSV, JSON
            </p>
          </div>
          
          {selectedFile && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Formato file rilevato:</p>
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
            Annulla
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedGame || !selectedFile || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importazione...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importa
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}