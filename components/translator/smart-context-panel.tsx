'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, Users, BookOpen, Sparkles, Plus, X, Check,
  ChevronDown, ChevronRight, Settings, Download,
  Lightbulb, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  smartContext, 
  CharacterProfile,
  GameContext
} from '@/lib/smart-context';
import { useTranslation } from '@/lib/i18n';

interface SmartContextPanelProps {
  gameId?: string;
  gameName?: string;
  onContextChange?: (context: GameContext | null) => void;
  compact?: boolean;
}

export function SmartContextPanel({
  gameId, 
  gameName, 
  onContextChange,
  compact = false 
}: SmartContextPanelProps) {
  const { t } = useTranslation();
  const [context, setContext] = useState<GameContext | null>(null);
  const [isOpen, setIsOpen] = useState(!compact);
  const [activeTab, setActiveTab] = useState<'characters' | 'terms' | 'settings'>('characters');
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [showAddTerm, setShowAddTerm] = useState(false);

  // Form states
  const [newCharacter, setNewCharacter] = useState<Partial<CharacterProfile>>({
    name: '',
    aliases: [],
    speechStyle: 'neutral',
    personality: '',
    catchphrases: [],
    notes: '',
  });
  const [newTerm, setNewTerm] = useState({ original: '', translation: '', context: '' });
  const [aliasInput, setAliasInput] = useState('');

  useEffect(() => {
    if (gameId) {
      smartContext.setCurrentGame(gameId);
      let ctx = smartContext.getContext(gameId);
      
      if (!ctx && gameName) {
        ctx = smartContext.createContext(gameId, gameName);
      }
      
      setContext(ctx);
      onContextChange?.(ctx);
    }
  }, [gameId, gameName, onContextChange]);

  const refreshContext = () => {
    const ctx = smartContext.getCurrentContext();
    setContext(ctx);
    onContextChange?.(ctx);
  };

  const handleAddCharacter = () => {
    if (!newCharacter.name) return;
    
    smartContext.addCharacter({
      name: newCharacter.name,
      aliases: newCharacter.aliases || [],
      speechStyle: newCharacter.speechStyle || 'neutral',
      personality: newCharacter.personality || '',
      catchphrases: newCharacter.catchphrases || [],
      translatedName: newCharacter.translatedName,
      notes: newCharacter.notes || '',
    });
    
    setNewCharacter({
      name: '',
      aliases: [],
      speechStyle: 'neutral',
      personality: '',
      catchphrases: [],
      notes: '',
    });
    setShowAddCharacter(false);
    refreshContext();
  };

  const handleAddTerm = () => {
    if (!newTerm.original || !newTerm.translation) return;
    
    smartContext.addTerm(newTerm.original, newTerm.translation, newTerm.context);
    setNewTerm({ original: '', translation: '', context: '' });
    setShowAddTerm(false);
    refreshContext();
  };

  const handleApproveTerm = (original: string) => {
    smartContext.approveTerm(original);
    refreshContext();
  };

  const addAlias = () => {
    if (!aliasInput.trim()) return;
    setNewCharacter(prev => ({
      ...prev,
      aliases: [...(prev.aliases || []), aliasInput.trim()]
    }));
    setAliasInput('');
  };

  const removeAlias = (index: number) => {
    setNewCharacter(prev => ({
      ...prev,
      aliases: prev.aliases?.filter((_, i) => i !== index) || []
    }));
  };

  const exportContext = () => {
    if (!gameId) return;
    const json = smartContext.exportContext(gameId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `context_${gameId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!context) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4 text-center text-gray-500">
          <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('smartContextPanelComp.selezionaUnGiocoPerAttivareSma')}</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="bg-card/50 border-border/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="p-3 cursor-pointer hover:bg-purple-500/10 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">{t('smartContextPanelComp.smartContext')}</span>
                  <Badge variant="outline" className="text-2xs">
                    {context.stats.learnings} apprendimenti
                  </Badge>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="flex gap-1">
                <Badge variant="outline" className="text-2xs">
                  <Users className="h-3 w-3 mr-1" />
                  {context.characters.length} personaggi
                </Badge>
                <Badge variant="outline" className="text-2xs">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {context.terms.length} termini
                </Badge>
              </div>
              
              {context.characters.length > 0 && (
                <div className="text-2xs text-gray-500">
                  Personaggi: {context.characters.slice(0, 3).map(c => c.name).join(', ')}
                  {context.characters.length > 3 && ` +${context.characters.length - 3}`}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Brain className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base text-purple-300">{t('smartContextPanelComp.smartContext')}</CardTitle>
              <p className="text-2xs text-gray-500">{context.gameName}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={exportContext} className="h-7 px-2">
              <Download className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="xs" className="px-2">
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="text-2xs">
            <Sparkles className="h-3 w-3 mr-1" />
            {context.stats.learnings} apprendimenti
          </Badge>
          <Badge variant="outline" className="text-2xs">
            {context.stats.translatedStrings} traduzioni
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        {/* Tabs */}
        <div className="flex gap-1 mb-3 bg-muted/50 rounded-lg p-1">
          <Button
            variant={activeTab === 'characters' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('characters')}
            className="flex-1 h-7 text-xs"
          >
            <Users className="h-3 w-3 mr-1" />
            Personaggi ({context.characters.length})
          </Button>
          <Button
            variant={activeTab === 'terms' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('terms')}
            className="flex-1 h-7 text-xs"
          >
            <BookOpen className="h-3 w-3 mr-1" />
            Glossario ({context.terms.length})
          </Button>
        </div>

        <ScrollArea className="h-[250px]">
          {/* Characters Tab */}
          {activeTab === 'characters' && (
            <div className="space-y-2">
              {context.characters.map((char, i) => (
                <div key={i} className="p-2 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3 text-purple-400" />
                      <span className="text-sm font-medium">{char.name}</span>
                      {char.translatedName && (
                        <span className="text-xs text-gray-500">→ {char.translatedName}</span>
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-2xs ${
                        char.speechStyle === 'formal' ? 'border-blue-500/30 text-blue-400' :
                        char.speechStyle === 'informal' ? 'border-green-500/30 text-green-400' :
                        char.speechStyle === 'archaic' ? 'border-amber-500/30 text-amber-400' :
                        'border-gray-500/30 text-gray-400'
                      }`}
                    >
                      {char.speechStyle}
                    </Badge>
                  </div>
                  {char.personality && (
                    <p className="text-2xs text-gray-500 mt-1">{char.personality}</p>
                  )}
                  {char.aliases.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {char.aliases.map((alias, j) => (
                        <Badge key={j} variant="outline" className="text-micro h-4">
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Add Character Button */}
              <Dialog open={showAddCharacter} onOpenChange={setShowAddCharacter}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full border-dashed">
                    <Plus className="h-3 w-3 mr-1" />
                    Aggiungi Personaggio
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-400" />
                      Nuovo Personaggio
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.nome')}</label>
                      <Input
                        value={newCharacter.name}
                        onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                        placeholder="es. Commander Shepard"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.nomeTradottoOpzionale')}</label>
                      <Input
                        value={newCharacter.translatedName || ''}
                        onChange={(e) => setNewCharacter({ ...newCharacter, translatedName: e.target.value })}
                        placeholder="es. Comandante Shepard"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.stileDiDialogo')}</label>
                      <Select 
                        value={newCharacter.speechStyle} 
                        onValueChange={(v) => setNewCharacter({ ...newCharacter, speechStyle: v as "formal" | "informal" | "neutral" | "archaic" | "modern" | "slang" })}
                      >
                        <SelectTrigger className="bg-muted/50 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formal">{t('smartContextPanelComp.formaleLei')}</SelectItem>
                          <SelectItem value="informal">{t('smartContextPanelComp.informaleTu')}</SelectItem>
                          <SelectItem value="archaic">{t('smartContextPanelComp.arcaicoVoi')}</SelectItem>
                          <SelectItem value="modern">{t('smartContextPanelComp.moderno')}</SelectItem>
                          <SelectItem value="slang">{t('smartContextPanelComp.slang')}</SelectItem>
                          <SelectItem value="neutral">{t('smartContextPanelComp.neutro')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.personalità')}</label>
                      <Input
                        value={newCharacter.personality || ''}
                        onChange={(e) => setNewCharacter({ ...newCharacter, personality: e.target.value })}
                        placeholder="es. Serio, leader, militare"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.aliasSoprannomi')}</label>
                      <div className="flex gap-2">
                        <Input
                          value={aliasInput}
                          onChange={(e) => setAliasInput(e.target.value)}
                          placeholder="es. Shep"
                          className="bg-muted/50 border-border"
                          onKeyPress={(e) => e.key === 'Enter' && addAlias()}
                        />
                        <Button size="sm" onClick={addAlias}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {newCharacter.aliases && newCharacter.aliases.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {newCharacter.aliases.map((alias, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {alias}
                              <button onClick={() => removeAlias(i)} className="ml-1">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.note')}</label>
                      <Textarea
                        value={newCharacter.notes || ''}
                        onChange={(e) => setNewCharacter({ ...newCharacter, notes: e.target.value })}
                        placeholder="Note aggiuntive sulla traduzione..."
                        className="bg-slate-800 border-slate-600 h-20"
                      />
                    </div>
                    <Button onClick={handleAddCharacter} className="w-full bg-purple-600 hover:bg-purple-700">
                      <Check className="h-4 w-4 mr-2" />
                      Aggiungi Personaggio
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Terms Tab */}
          {activeTab === 'terms' && (
            <div className="space-y-2">
              {context.terms.map((term, i) => (
                <div key={i} className="p-2 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{term.original}</span>
                      <span className="text-gray-500">→</span>
                      <span className="text-sm text-purple-300">{term.translation}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-micro h-4">
                        ×{term.frequency}
                      </Badge>
                      {term.approved ? (
                        <Badge className="text-micro h-4 bg-green-600">
                          <Check className="h-2 w-2" />
                        </Badge>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 px-1"
                          onClick={() => handleApproveTerm(term.original)}
                        >
                          <Check className="h-3 w-3 text-green-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {term.context && (
                    <p className="text-2xs text-gray-500 mt-1">{term.context}</p>
                  )}
                </div>
              ))}

              {/* Add Term Button */}
              <Dialog open={showAddTerm} onOpenChange={setShowAddTerm}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full border-dashed">
                    <Plus className="h-3 w-3 mr-1" />
                    Aggiungi Termine
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-purple-400" />
                      Nuovo Termine
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.originale')}</label>
                      <Input
                        value={newTerm.original}
                        onChange={(e) => setNewTerm({ ...newTerm, original: e.target.value })}
                        placeholder="es. Health Potion"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.traduzione')}</label>
                      <Input
                        value={newTerm.translation}
                        onChange={(e) => setNewTerm({ ...newTerm, translation: e.target.value })}
                        placeholder="es. Pozione di salute"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('smartContextPanelComp.contestoOpzionale')}</label>
                      <Input
                        value={newTerm.context}
                        onChange={(e) => setNewTerm({ ...newTerm, context: e.target.value })}
                        placeholder="es. Oggetto di inventario"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    <Button onClick={handleAddTerm} className="w-full bg-purple-600 hover:bg-purple-700">
                      <Check className="h-4 w-4 mr-2" />
                      Aggiungi Termine
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </ScrollArea>

        {/* AI Suggestion Hint */}
        <div className="mt-3 p-2 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-2xs text-purple-300/80">
              Smart Context apprende automaticamente mentre traduci. I personaggi e termini vengono rilevati dai dialoghi.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
