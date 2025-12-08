'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Settings,
  Users,
  Plus,
  Trash2,
  ChevronDown,
  Sparkles,
  Globe,
  MessageSquare
} from 'lucide-react';
import { 
  GlossaryMetadata, 
  GameCharacter,
  GLOSSARY_TONES, 
  GAME_GENRES 
} from '@/types/glossary';

// Ambientazioni predefinite
const GAME_SETTINGS = [
  'Fantasy Medievale',
  'Sci-Fi Futuristico',
  'Post-Apocalittico',
  'Horror Gotico',
  'Moderno Realistico',
  'Steampunk',
  'Cyberpunk',
  'Storico',
  'Mitologico',
  'Altro'
] as const;

interface GameContextEditorProps {
  metadata: GlossaryMetadata;
  onMetadataChange: (metadata: GlossaryMetadata) => void;
  disabled?: boolean;
}

export function GameContextEditor({
  metadata,
  onMetadataChange,
  disabled = false
}: GameContextEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<GameCharacter | null>(null);
  const [newDoNotTranslate, setNewDoNotTranslate] = useState('');

  // Form per nuovo personaggio
  const [characterForm, setCharacterForm] = useState<GameCharacter>({
    name: '',
    description: '',
    personality: '',
    speechStyle: '',
    gender: 'unknown',
    role: ''
  });

  const handleMetadataChange = (key: keyof GlossaryMetadata, value: any) => {
    onMetadataChange({
      ...metadata,
      [key]: value
    });
  };

  const addCharacter = () => {
    if (!characterForm.name) return;
    
    const characters = metadata.characters || [];
    onMetadataChange({
      ...metadata,
      characters: [...characters, characterForm]
    });
    
    setCharacterForm({
      name: '',
      description: '',
      personality: '',
      speechStyle: '',
      gender: 'unknown',
      role: ''
    });
    setShowCharacterDialog(false);
  };

  const removeCharacter = (name: string) => {
    const characters = metadata.characters || [];
    onMetadataChange({
      ...metadata,
      characters: characters.filter(c => c.name !== name)
    });
  };

  const addDoNotTranslate = () => {
    if (!newDoNotTranslate.trim()) return;
    
    const current = metadata.doNotTranslate || [];
    if (!current.includes(newDoNotTranslate.trim())) {
      onMetadataChange({
        ...metadata,
        doNotTranslate: [...current, newDoNotTranslate.trim()]
      });
    }
    setNewDoNotTranslate('');
  };

  const removeDoNotTranslate = (term: string) => {
    onMetadataChange({
      ...metadata,
      doNotTranslate: (metadata.doNotTranslate || []).filter(t => t !== term)
    });
  };

  // Genera il prompt di contesto per l'IA
  const generateContextPrompt = (): string => {
    const parts: string[] = [];
    
    if (metadata.genre) {
      parts.push(`Genere: ${metadata.genre}`);
    }
    if (metadata.setting) {
      parts.push(`Ambientazione: ${metadata.setting}`);
    }
    if (metadata.tone) {
      parts.push(`Tono: ${metadata.tone}`);
    }
    if (metadata.worldContext) {
      parts.push(`Contesto: ${metadata.worldContext}`);
    }
    if (metadata.characters && metadata.characters.length > 0) {
      const charDescs = metadata.characters.map(c => {
        let desc = c.name;
        if (c.personality) desc += ` (${c.personality})`;
        if (c.speechStyle) desc += ` - parla in modo ${c.speechStyle}`;
        return desc;
      });
      parts.push(`Personaggi: ${charDescs.join('; ')}`);
    }
    if (metadata.doNotTranslate && metadata.doNotTranslate.length > 0) {
      parts.push(`NON tradurre mai: ${metadata.doNotTranslate.join(', ')}`);
    }
    
    return parts.join('\n');
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  Contesto del Gioco
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Aiuta l'IA a capire il contesto per traduzioni migliori
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {metadata.genre && <Badge variant="secondary">{metadata.genre}</Badge>}
                {metadata.tone && <Badge variant="outline">{metadata.tone}</Badge>}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Genere, Tono, Ambientazione */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Genere</Label>
                <Select
                  value={metadata.genre || ''}
                  onValueChange={(v) => handleMetadataChange('genre', v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GAME_GENRES.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs">Tono</Label>
                <Select
                  value={metadata.tone || ''}
                  onValueChange={(v) => handleMetadataChange('tone', v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GLOSSARY_TONES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs">Ambientazione</Label>
                <Select
                  value={metadata.setting || ''}
                  onValueChange={(v) => handleMetadataChange('setting', v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GAME_SETTINGS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contesto del mondo */}
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Contesto del Mondo
              </Label>
              <Textarea
                value={metadata.worldContext || ''}
                onChange={(e) => handleMetadataChange('worldContext', e.target.value)}
                placeholder="Descrivi brevemente il mondo di gioco, la storia, elementi importanti..."
                className="text-xs h-16 resize-none"
                disabled={disabled}
              />
            </div>

            {/* Personaggi */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Personaggi ({metadata.characters?.length || 0})
                </Label>
                <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-xs" disabled={disabled}>
                      <Plus className="h-3 w-3 mr-1" />
                      Aggiungi
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Aggiungi Personaggio</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Nome *</Label>
                        <Input
                          value={characterForm.name}
                          onChange={(e) => setCharacterForm({...characterForm, name: e.target.value})}
                          placeholder="es. Commander Shepard"
                        />
                      </div>
                      <div>
                        <Label>Ruolo</Label>
                        <Input
                          value={characterForm.role || ''}
                          onChange={(e) => setCharacterForm({...characterForm, role: e.target.value})}
                          placeholder="es. Protagonista, Antagonista, NPC"
                        />
                      </div>
                      <div>
                        <Label>Personalità</Label>
                        <Input
                          value={characterForm.personality || ''}
                          onChange={(e) => setCharacterForm({...characterForm, personality: e.target.value})}
                          placeholder="es. sarcastico, serio, ottimista"
                        />
                      </div>
                      <div>
                        <Label>Stile di parlata</Label>
                        <Input
                          value={characterForm.speechStyle || ''}
                          onChange={(e) => setCharacterForm({...characterForm, speechStyle: e.target.value})}
                          placeholder="es. formale, slang, arcaico, tecnico"
                        />
                      </div>
                      <div>
                        <Label>Genere</Label>
                        <Select
                          value={characterForm.gender}
                          onValueChange={(v: any) => setCharacterForm({...characterForm, gender: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Maschile</SelectItem>
                            <SelectItem value="female">Femminile</SelectItem>
                            <SelectItem value="neutral">Neutro</SelectItem>
                            <SelectItem value="unknown">Non specificato</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={addCharacter} className="w-full">
                        Aggiungi Personaggio
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              {metadata.characters && metadata.characters.length > 0 ? (
                <div className="space-y-1">
                  {metadata.characters.map((char, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                      <div>
                        <span className="font-medium">{char.name}</span>
                        {char.role && <span className="text-muted-foreground ml-1">({char.role})</span>}
                        {char.personality && <span className="text-muted-foreground ml-1">- {char.personality}</span>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => removeCharacter(char.name)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nessun personaggio definito
                </p>
              )}
            </div>

            {/* Termini da non tradurre */}
            <div>
              <Label className="text-xs flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Non tradurre mai
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newDoNotTranslate}
                  onChange={(e) => setNewDoNotTranslate(e.target.value)}
                  placeholder="es. Mana, HP, XP..."
                  className="h-8 text-xs"
                  disabled={disabled}
                  onKeyDown={(e) => e.key === 'Enter' && addDoNotTranslate()}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={addDoNotTranslate}
                  disabled={disabled}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {metadata.doNotTranslate && metadata.doNotTranslate.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {metadata.doNotTranslate.map((term, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {term}
                      <button
                        onClick={() => removeDoNotTranslate(term)}
                        className="ml-1 hover:text-destructive"
                        disabled={disabled}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Preview del contesto generato */}
            {(metadata.genre || metadata.tone || metadata.setting || metadata.characters?.length) && (
              <div className="p-2 bg-primary/5 rounded border border-primary/20">
                <Label className="text-xs flex items-center gap-1 text-primary">
                  <Sparkles className="h-3 w-3" />
                  Contesto per l'IA
                </Label>
                <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap">
                  {generateContextPrompt()}
                </pre>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
