'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Edit2,
  Search,
  Download,
  Upload,
  Check,
  X,
  Globe,
  Gamepad2,
} from 'lucide-react';
import { 
  glossaryManager, 
  Glossary, 
  GlossaryEntry, 
  GLOSSARY_CATEGORIES 
} from '@/lib/glossary';
import { toast } from 'sonner';

interface GlossaryManagerProps {
  gameId?: string;
  gameName?: string;
  compact?: boolean;
}

export function GlossaryManager({ gameId, gameName, compact = false }: GlossaryManagerProps) {
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [selectedGlossary, setSelectedGlossary] = useState<Glossary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GlossaryEntry | null>(null);
  const [newEntry, setNewEntry] = useState({
    source: '',
    target: '',
    category: 'other',
    caseSensitive: false,
    wholeWord: true,
  });

  useEffect(() => {
    glossaryManager.init().then(() => {
      loadGlossaries();
    });
  }, [gameId]);

  const loadGlossaries = () => {
    const all = glossaryManager.getAllGlossaries();
    // Filter by game if specified
    const filtered = gameId 
      ? all.filter(g => !g.gameId || g.gameId === gameId)
      : all;
    setGlossaries(filtered);
    
    // Select first available glossary
    if (filtered.length > 0 && !selectedGlossary) {
      setSelectedGlossary(filtered[0]);
    }
  };

  const handleCreateGlossary = () => {
    const newGlossary = glossaryManager.createGlossary({
      name: gameId ? `Glossary ${gameName || 'Game'}` : 'New Glossary',
      gameId: gameId,
      isActive: true,
    });
    loadGlossaries();
    setSelectedGlossary(newGlossary);
    toast.success('Glossary created');
  };

  const handleToggleGlossary = (glossaryId: string, active: boolean) => {
    glossaryManager.updateGlossary(glossaryId, { isActive: active });
    loadGlossaries();
  };

  const handleDeleteGlossary = (glossaryId: string) => {
    if (confirm('Delete this glossary?')) {
      glossaryManager.deleteGlossary(glossaryId);
      loadGlossaries();
      setSelectedGlossary(null);
      toast.success('Glossary deleted');
    }
  };

  const handleAddEntry = () => {
    if (!selectedGlossary || !newEntry.source.trim()) return;
    
    glossaryManager.addEntry(selectedGlossary.id, {
      source: newEntry.source.trim(),
      target: newEntry.target.trim(),
      category: newEntry.category,
      caseSensitive: newEntry.caseSensitive,
      wholeWord: newEntry.wholeWord,
    });
    
    setNewEntry({ source: '', target: '', category: 'other', caseSensitive: false, wholeWord: true });
    setIsAddingEntry(false);
    loadGlossaries();
    
    // Update selectedGlossary
    const updated = glossaryManager.getGlossary(selectedGlossary.id);
    if (updated) setSelectedGlossary(updated);
    
    toast.success('Term added');
  };

  const handleUpdateEntry = () => {
    if (!selectedGlossary || !editingEntry) return;
    
    glossaryManager.updateEntry(selectedGlossary.id, editingEntry.id, editingEntry);
    setEditingEntry(null);
    
    const updated = glossaryManager.getGlossary(selectedGlossary.id);
    if (updated) setSelectedGlossary(updated);
    
    toast.success('Term updated');
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!selectedGlossary) return;
    
    glossaryManager.deleteEntry(selectedGlossary.id, entryId);
    const updated = glossaryManager.getGlossary(selectedGlossary.id);
    if (updated) setSelectedGlossary(updated);
    
    toast.success('Term removed');
  };

  const handleExport = () => {
    if (!selectedGlossary) return;
    
    const data = glossaryManager.exportGlossary(selectedGlossary.id);
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glossary_${selectedGlossary.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Glossary exported');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const imported = glossaryManager.importGlossary(content);
      if (imported) {
        loadGlossaries();
        setSelectedGlossary(imported);
        toast.success('Glossary imported');
      } else {
        toast.error('Import error');
      }
    };
    reader.readAsText(file);
  };

  const filteredEntries = selectedGlossary?.entries.filter(entry =>
    entry.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.target.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const stats = glossaryManager.getStats();

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium">Glossary</span>
            <Badge variant="outline" className="text-[10px]">{stats.totalEntries} terms</Badge>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Edit2 className="h-3 w-3 mr-1" />
                Manage
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Glossary Management</DialogTitle>
              </DialogHeader>
              <GlossaryManagerFull gameId={gameId} gameName={gameName} />
            </DialogContent>
          </Dialog>
        </div>
        
        {selectedGlossary && selectedGlossary.entries.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedGlossary.entries.slice(0, 5).map(entry => (
              <Badge key={entry.id} variant="secondary" className="text-[10px]">
                {entry.source} → {entry.target || '∅'}
              </Badge>
            ))}
            {selectedGlossary.entries.length > 5 && (
              <Badge variant="outline" className="text-[10px]">
                +{selectedGlossary.entries.length - 5}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return <GlossaryManagerFull gameId={gameId} gameName={gameName} />;
}

function GlossaryManagerFull({ gameId, gameName }: { gameId?: string; gameName?: string }) {
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [selectedGlossary, setSelectedGlossary] = useState<Glossary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GlossaryEntry | null>(null);
  const [newEntry, setNewEntry] = useState({
    source: '',
    target: '',
    category: 'other',
    caseSensitive: false,
    wholeWord: true,
  });

  useEffect(() => {
    glossaryManager.init().then(() => {
      loadGlossaries();
    });
  }, [gameId]);

  const loadGlossaries = () => {
    const all = glossaryManager.getAllGlossaries();
    const filtered = gameId 
      ? all.filter(g => !g.gameId || g.gameId === gameId)
      : all;
    setGlossaries(filtered);
    
    if (filtered.length > 0 && !selectedGlossary) {
      setSelectedGlossary(filtered[0]);
    }
  };

  const handleCreateGlossary = () => {
    const newGlossary = glossaryManager.createGlossary({
      name: gameId ? `Glossary ${gameName || 'Game'}` : 'New Glossary',
      gameId: gameId,
      isActive: true,
    });
    loadGlossaries();
    setSelectedGlossary(newGlossary);
    toast.success('Glossary created');
  };

  const handleAddEntry = () => {
    if (!selectedGlossary || !newEntry.source.trim()) return;
    
    glossaryManager.addEntry(selectedGlossary.id, {
      source: newEntry.source.trim(),
      target: newEntry.target.trim(),
      category: newEntry.category,
      caseSensitive: newEntry.caseSensitive,
      wholeWord: newEntry.wholeWord,
    });
    
    setNewEntry({ source: '', target: '', category: 'other', caseSensitive: false, wholeWord: true });
    setIsAddingEntry(false);
    
    const updated = glossaryManager.getGlossary(selectedGlossary.id);
    if (updated) setSelectedGlossary(updated);
    loadGlossaries();
    
    toast.success('Term added');
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!selectedGlossary) return;
    
    glossaryManager.deleteEntry(selectedGlossary.id, entryId);
    const updated = glossaryManager.getGlossary(selectedGlossary.id);
    if (updated) setSelectedGlossary(updated);
    
    toast.success('Term removed');
  };

  const handleExport = () => {
    if (!selectedGlossary) return;
    
    const data = glossaryManager.exportGlossary(selectedGlossary.id);
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glossary_${selectedGlossary.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Glossary exported');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const imported = glossaryManager.importGlossary(content);
      if (imported) {
        loadGlossaries();
        setSelectedGlossary(imported);
        toast.success('Glossary imported');
      } else {
        toast.error('Import error');
      }
    };
    reader.readAsText(file);
  };

  const filteredEntries = selectedGlossary?.entries.filter(entry =>
    entry.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.target.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select 
            value={selectedGlossary?.id || ''} 
            onValueChange={(id) => setSelectedGlossary(glossaries.find(g => g.id === id) || null)}
          >
            <SelectTrigger className="w-[200px] h-8">
              <SelectValue placeholder="Select glossary" />
            </SelectTrigger>
            <SelectContent>
              {glossaries.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  <div className="flex items-center gap-2">
                    {g.gameId ? <Gamepad2 className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    <span>{g.name}</span>
                    <Badge variant="outline" className="text-[9px] ml-1">{g.entries.length}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={handleCreateGlossary} className="h-8">
            <Plus className="h-3 w-3 mr-1" />
            New
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!selectedGlossary} className="h-8">
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <label>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            <Button variant="outline" size="sm" asChild className="h-8 cursor-pointer">
              <span>
                <Upload className="h-3 w-3 mr-1" />
                Import
              </span>
            </Button>
          </label>
        </div>
      </div>

      {selectedGlossary && (
        <>
          {/* Search + Add */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search terms..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button size="sm" onClick={() => setIsAddingEntry(true)} className="h-8">
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

          {/* Add Entry Form */}
          {isAddingEntry && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Original term</Label>
                    <Input 
                      value={newEntry.source}
                      onChange={(e) => setNewEntry({ ...newEntry, source: e.target.value })}
                      placeholder="e.g. HP, Mana..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Translation (empty = do not translate)</Label>
                    <Input 
                      value={newEntry.target}
                      onChange={(e) => setNewEntry({ ...newEntry, target: e.target.value })}
                      placeholder="e.g. PV, Mana..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Select 
                    value={newEntry.category} 
                    onValueChange={(v) => setNewEntry({ ...newEntry, category: v })}
                  >
                    <SelectTrigger className="w-[150px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GLOSSARY_CATEGORIES.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={newEntry.caseSensitive}
                      onCheckedChange={(c) => setNewEntry({ ...newEntry, caseSensitive: c })}
                    />
                    <Label className="text-xs">Case sensitive</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={newEntry.wholeWord}
                      onCheckedChange={(c) => setNewEntry({ ...newEntry, wholeWord: c })}
                    />
                    <Label className="text-xs">Whole word</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingEntry(false)}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddEntry} disabled={!newEntry.source.trim()}>
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entries List */}
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {searchQuery ? 'No results' : 'No terms in glossary'}
                </div>
              ) : (
                filteredEntries.map(entry => {
                  const category = GLOSSARY_CATEGORIES.find(c => c.id === entry.category);
                  return (
                    <div 
                      key={entry.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 border border-slate-800/50 hover:border-slate-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{category?.icon || '📝'}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{entry.source}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-sm text-green-400">
                              {entry.target || <span className="italic text-orange-400">do not translate</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {entry.caseSensitive && <Badge variant="outline" className="text-[9px] px-1">Aa</Badge>}
                            {entry.wholeWord && <Badge variant="outline" className="text-[9px] px-1">Word</Badge>}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

export default GlossaryManager;



