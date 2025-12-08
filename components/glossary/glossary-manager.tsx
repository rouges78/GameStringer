'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@/lib/tauri-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Book,
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Search,
  Save,
  X,
  FileText,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  GameGlossary, 
  GlossaryEntry,
  GlossaryMetadata,
  GLOSSARY_CONTEXTS, 
  GLOSSARY_TONES, 
  GAME_GENRES 
} from '@/types/glossary';
import { GameContextEditor } from './game-context-editor';

interface GlossaryManagerProps {
  gameId: string;
  gameName: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  onGlossaryChange?: (glossary: GameGlossary | null) => void;
}

export function GlossaryManager({
  gameId,
  gameName,
  sourceLanguage = 'en',
  targetLanguage = 'it',
  onGlossaryChange
}: GlossaryManagerProps) {
  const [glossary, setGlossary] = useState<GameGlossary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GlossaryEntry | null>(null);

  // Form state per nuova voce
  const [newEntry, setNewEntry] = useState({
    original: '',
    translation: '',
    caseSensitive: false,
    context: '',
    notes: ''
  });

  // Carica glossario
  useEffect(() => {
    loadGlossary();
  }, [gameId]);

  const loadGlossary = async () => {
    setIsLoading(true);
    try {
      const result = await invoke<GameGlossary | null>('get_glossary', { gameId });
      setGlossary(result);
      onGlossaryChange?.(result);
    } catch (error) {
      console.error('Errore caricamento glossario:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createGlossary = async () => {
    try {
      const result = await invoke<GameGlossary>('create_glossary', {
        gameId,
        gameName,
        sourceLanguage,
        targetLanguage
      });
      setGlossary(result);
      onGlossaryChange?.(result);
      toast.success('Glossario creato!');
    } catch (error) {
      toast.error('Errore creazione glossario');
      console.error(error);
    }
  };

  const addEntry = async () => {
    if (!newEntry.original || !newEntry.translation) {
      toast.error('Inserisci termine originale e traduzione');
      return;
    }

    try {
      await invoke('add_glossary_entry', {
        gameId,
        original: newEntry.original,
        translation: newEntry.translation,
        caseSensitive: newEntry.caseSensitive,
        context: newEntry.context || null,
        notes: newEntry.notes || null
      });
      
      await loadGlossary();
      setNewEntry({ original: '', translation: '', caseSensitive: false, context: '', notes: '' });
      setShowAddDialog(false);
      toast.success('Voce aggiunta!');
    } catch (error) {
      toast.error('Errore aggiunta voce');
      console.error(error);
    }
  };

  const updateEntry = async () => {
    if (!editingEntry) return;

    try {
      await invoke('update_glossary_entry', {
        gameId,
        entryId: editingEntry.id,
        original: editingEntry.original,
        translation: editingEntry.translation,
        caseSensitive: editingEntry.caseSensitive,
        context: editingEntry.context,
        notes: editingEntry.notes
      });
      
      await loadGlossary();
      setEditingEntry(null);
      toast.success('Voce aggiornata!');
    } catch (error) {
      toast.error('Errore aggiornamento voce');
      console.error(error);
    }
  };

  const deleteEntry = async (entryId: string) => {
    try {
      await invoke('delete_glossary_entry', { gameId, entryId });
      await loadGlossary();
      toast.success('Voce eliminata');
    } catch (error) {
      toast.error('Errore eliminazione voce');
      console.error(error);
    }
  };

  const exportGlossary = async () => {
    try {
      const json = await invoke<string>('export_glossary', { gameId });
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glossary_${gameName.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Glossario esportato!');
    } catch (error) {
      toast.error('Errore esportazione');
      console.error(error);
    }
  };

  const importGlossary = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await invoke<GameGlossary>('import_glossary', { jsonContent: text });
      setGlossary(result);
      onGlossaryChange?.(result);
      toast.success(`Glossario importato: ${result.entries.length} voci`);
    } catch (error) {
      toast.error('Errore importazione');
      console.error(error);
    }
  };

  const updateMetadata = async (newMetadata: GlossaryMetadata) => {
    if (!glossary) return;
    
    try {
      await invoke('update_glossary_metadata', {
        gameId,
        genre: newMetadata.genre,
        tone: newMetadata.tone,
        setting: newMetadata.setting,
        doNotTranslate: newMetadata.doNotTranslate,
        notes: newMetadata.notes
      });
      
      // Aggiorna lo stato locale
      const updatedGlossary = {
        ...glossary,
        metadata: newMetadata
      };
      setGlossary(updatedGlossary);
      onGlossaryChange?.(updatedGlossary);
    } catch (error) {
      console.error('Errore aggiornamento metadata:', error);
    }
  };

  // Filtra voci per ricerca
  const filteredEntries = glossary?.entries.filter(entry =>
    entry.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.translation.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Caricamento glossario...
        </CardContent>
      </Card>
    );
  }

  if (!glossary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            Glossario di Traduzione
          </CardTitle>
          <CardDescription>
            Crea un glossario per mantenere coerenza nelle traduzioni
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={createGlossary} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Crea Glossario per {gameName}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              Glossario: {glossary.gameName}
            </CardTitle>
            <CardDescription>
              {glossary.entries.length} termini • {glossary.sourceLanguage.toUpperCase()} → {glossary.targetLanguage.toUpperCase()}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMetadataDialog(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportGlossary}>
              <Download className="h-4 w-4" />
            </Button>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="h-4 w-4" /></span>
              </Button>
              <input type="file" accept=".json" className="hidden" onChange={importGlossary} />
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barra ricerca e aggiungi */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca termine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aggiungi Termine</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Originale ({glossary.sourceLanguage.toUpperCase()})</Label>
                    <Input
                      value={newEntry.original}
                      onChange={(e) => setNewEntry({ ...newEntry, original: e.target.value })}
                      placeholder="es. Health Points"
                    />
                  </div>
                  <div>
                    <Label>Traduzione ({glossary.targetLanguage.toUpperCase()})</Label>
                    <Input
                      value={newEntry.translation}
                      onChange={(e) => setNewEntry({ ...newEntry, translation: e.target.value })}
                      placeholder="es. Punti Vita"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newEntry.caseSensitive}
                    onCheckedChange={(checked) => setNewEntry({ ...newEntry, caseSensitive: checked })}
                  />
                  <Label>Case sensitive</Label>
                </div>
                <div>
                  <Label>Contesto</Label>
                  <Select
                    value={newEntry.context}
                    onValueChange={(value) => setNewEntry({ ...newEntry, context: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona contesto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {GLOSSARY_CONTEXTS.map(ctx => (
                        <SelectItem key={ctx} value={ctx}>{ctx}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                    placeholder="Note opzionali..."
                    rows={2}
                  />
                </div>
                <Button onClick={addEntry} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Salva
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista termini */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'Nessun risultato' : 'Nessun termine nel glossario'}
              </div>
            ) : (
              filteredEntries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.original}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-primary">{entry.translation}</span>
                      {entry.caseSensitive && (
                        <Badge variant="outline" className="text-xs">Aa</Badge>
                      )}
                      {entry.context && (
                        <Badge variant="secondary" className="text-xs">{entry.context}</Badge>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEntry(entry)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEntry(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Context Editor */}
        <GameContextEditor
          metadata={glossary.metadata}
          onMetadataChange={updateMetadata}
        />
      </CardContent>

      {/* Dialog modifica voce */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Termine</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Originale</Label>
                  <Input
                    value={editingEntry.original}
                    onChange={(e) => setEditingEntry({ ...editingEntry, original: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Traduzione</Label>
                  <Input
                    value={editingEntry.translation}
                    onChange={(e) => setEditingEntry({ ...editingEntry, translation: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingEntry.caseSensitive}
                  onCheckedChange={(checked) => setEditingEntry({ ...editingEntry, caseSensitive: checked })}
                />
                <Label>Case sensitive</Label>
              </div>
              <Button onClick={updateEntry} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Salva Modifiche
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
