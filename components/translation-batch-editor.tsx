'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Save, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Lightbulb,
  Copy,
  ClipboardPaste
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

interface Translation {
  id: string;
  originalText: string;
  translatedText: string;
  status: string;
  filePath: string;
}

interface TranslationBatchEditorProps {
  translations: Translation[];
  onSave: (updates: Array<{ id: string; translatedText: string }>) => Promise<void>;
  onGenerateSuggestions: (ids: string[]) => Promise<void>;
}

export function TranslationBatchEditor({ 
  translations, 
  onSave,
  onGenerateSuggestions 
}: TranslationBatchEditorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedTranslations, setEditedTranslations] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === translations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(translations.map(t => t.id)));
    }
  };

  const updateTranslation = (id: string, text: string) => {
    setEditedTranslations(prev => ({
      ...prev,
      [id]: text
    }));
  };

  const handleSave = async () => {
    const updates = Array.from(selectedIds)
      .filter(id => editedTranslations[id] !== undefined)
      .map(id => ({
        id,
        translatedText: editedTranslations[id]
      }));

    if (updates.length === 0) {
      toast({
        title: 'Nessuna modifica',
        description: 'Seleziona e modifica almeno una traduzione',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave(updates);
      
      // Reset dopo il salvataggio
      setEditedTranslations({});
      setSelectedIds(new Set());
      
      toast({
        title: 'Salvate',
        description: `${updates.length} traduzioni aggiornate con successo`
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile salvare le traduzioni',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: 'Nessuna selezione',
        description: 'Seleziona almeno una traduzione',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerateSuggestions(Array.from(selectedIds));
      toast({
        title: 'Suggerimenti generati',
        description: `Generati suggerimenti per ${selectedIds.size} traduzioni`
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile generare suggerimenti',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyOriginals = () => {
    const texts = Array.from(selectedIds)
      .map(id => translations.find(t => t.id === id)?.originalText)
      .filter(Boolean)
      .join('\n\n');
    
    navigator.clipboard.writeText(texts);
    toast({
      title: 'Copiato',
      description: `${selectedIds.size} testi originali copiati negli appunti`
    });
  };

  const pasteTranslations = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split('\n\n').filter(line => line.trim());
      
      const selectedTranslations = Array.from(selectedIds)
        .map(id => translations.find(t => t.id === id))
        .filter(Boolean) as Translation[];
      
      selectedTranslations.forEach((translation, index) => {
        if (index < lines.length) {
          updateTranslation(translation.id, lines[index]);
        }
      });
      
      toast({
        title: 'Incollato',
        description: `Incollate ${Math.min(lines.length, selectedTranslations.length)} traduzioni`
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile incollare dagli appunti',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'reviewed':
      case 'edited':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'pending':
        return <AlertCircle className="h-3 w-3 text-gray-500" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Editor Batch</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} di {translations.length} selezionate
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAll}
            >
              {selectedIds.size === translations.length ? 'Deseleziona' : 'Seleziona'} Tutto
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Azioni batch */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyOriginals}
            disabled={selectedIds.size === 0}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copia Originali
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={pasteTranslations}
            disabled={selectedIds.size === 0}
          >
            <ClipboardPaste className="h-4 w-4 mr-2" />
            Incolla Traduzioni
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateSuggestions}
            disabled={selectedIds.size === 0 || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4 mr-2" />
            )}
            Genera Suggerimenti AI
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedIds.size === 0 || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salva Selezionate
          </Button>
        </div>

        {/* Lista traduzioni */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {translations.map((translation, index) => {
            const isSelected = selectedIds.has(translation.id);
            const isEdited = editedTranslations[translation.id] !== undefined;
            
            return (
              <motion.div
                key={translation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`p-4 border rounded-lg transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(translation.id)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(translation.status)}
                        <span className="text-xs text-muted-foreground">
                          {translation.filePath.split('/').pop()}
                        </span>
                        {isEdited && (
                          <Badge variant="secondary" className="text-xs">
                            Modificato
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Originale
                        </label>
                        <p className="text-sm mt-1">{translation.originalText}</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Traduzione
                        </label>
                        <Textarea
                          value={editedTranslations[translation.id] ?? translation.translatedText}
                          onChange={(e) => updateTranslation(translation.id, e.target.value)}
                          className="mt-1 min-h-[60px] text-sm"
                          placeholder="Inserisci traduzione..."
                          disabled={!isSelected}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}