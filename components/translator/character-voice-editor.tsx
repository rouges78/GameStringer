'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { 
  User, Plus, Trash2, Save, Copy, Sparkles, 
  MessageSquare, Wand2, RefreshCw,
  Crown, Skull, Sword, Heart, Smile, Bot, BookOpen
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { 
  characterVoiceService, 
  CharacterProfile, 
  CharacterArchetype,
  ARCHETYPE_PRESETS 
} from '@/lib/ai/character-voice-ai';

const ARCHETYPE_ICONS: Record<CharacterArchetype, React.ReactNode> = {
  hero: <Sword className="h-4 w-4 text-noir-400" />,
  villain: <Skull className="h-4 w-4 text-red-400" />,
  mentor: <BookOpen className="h-4 w-4 text-amber-400" />,
  sidekick: <Smile className="h-4 w-4 text-green-400" />,
  love_interest: <Heart className="h-4 w-4 text-rouge-400" />,
  comic_relief: <Smile className="h-4 w-4 text-yellow-400" />,
  mysterious_stranger: <Sparkles className="h-4 w-4 text-rouge-400" />,
  noble: <Crown className="h-4 w-4 text-amber-400" />,
  pirate: <Sword className="h-4 w-4 text-orange-400" />,
  warrior: <Sword className="h-4 w-4 text-red-400" />,
  wizard: <Wand2 className="h-4 w-4 text-rouge-400" />,
  merchant: <Crown className="h-4 w-4 text-green-400" />,
  child: <Smile className="h-4 w-4 text-noir-400" />,
  robot: <Bot className="h-4 w-4 text-noir-400" />,
  monster: <Skull className="h-4 w-4 text-green-600" />,
  narrator: <BookOpen className="h-4 w-4 text-white" />,
  custom: <User className="h-4 w-4 text-noir-400" />
};

const ARCHETYPE_NAMES: Record<CharacterArchetype, string> = {
  hero: '🦸 Eroe',
  villain: '😈 Villain',
  mentor: '🧙 Mentore',
  sidekick: '🤝 Spalla',
  love_interest: '💕 Interesse Amoroso',
  comic_relief: '😄 Comico',
  mysterious_stranger: '🎭 Misterioso',
  noble: '👑 Nobile',
  pirate: '🏴‍☠️ Pirata',
  warrior: '⚔️ Guerriero',
  wizard: '🔮 Mago',
  merchant: '💰 Mercante',
  child: '👶 Bambino',
  robot: '🤖 Robot',
  monster: '👹 Mostro',
  narrator: '📖 Narratore',
  custom: '✏️ Personalizzato'
};

interface CharacterVoiceEditorProps {
  gameId?: string;
  onProfileSelect?: (profile: CharacterProfile) => void;
}

export function CharacterVoiceEditor({ gameId, onProfileSelect }: CharacterVoiceEditorProps) {
  const { t } = useTranslation();
  const { t: _t } = useTranslation();
  const [profiles, setProfiles] = useState<CharacterProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<CharacterProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testText, setTestText] = useState('Hello, my friend! How are you today?');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formArchetype, setFormArchetype] = useState<CharacterArchetype>('hero');
  const [formTraits, setFormTraits] = useState('');
  const [formMood, setFormMood] = useState<'cheerful' | 'serious' | 'mysterious' | 'aggressive' | 'calm' | 'nervous'>('calm');
  const [formAge, setFormAge] = useState<'child' | 'teen' | 'adult' | 'elderly'>('adult');
  const [formFormality, setFormFormality] = useState<'very_formal' | 'formal' | 'neutral' | 'informal' | 'very_informal'>('neutral');
  const [formVocabulary, setFormVocabulary] = useState<'archaic' | 'sophisticated' | 'standard' | 'simple' | 'slang' | 'technical'>('standard');
  const [formCatchphrases, setFormCatchphrases] = useState('');
  const [formFillerWords, setFormFillerWords] = useState('');
  const [formPreferredWords, setFormPreferredWords] = useState('');

  useEffect(() => {
    loadProfiles();
  }, [gameId]);

  const loadProfiles = () => {
    const allProfiles = characterVoiceService.getProfiles();
    setProfiles(gameId ? allProfiles.filter(p => p.gameId === gameId) : allProfiles);
  };

  const resetForm = () => {
    setFormName('');
    setFormArchetype('hero');
    setFormTraits('');
    setFormMood('calm');
    setFormAge('adult');
    setFormFormality('neutral');
    setFormVocabulary('standard');
    setFormCatchphrases('');
    setFormFillerWords('');
    setFormPreferredWords('');
  };

  const loadProfileToForm = (profile: CharacterProfile) => {
    setFormName(profile.name);
    setFormArchetype(profile.personality.archetype);
    setFormTraits(profile.personality.traits.join(', '));
    setFormMood(profile.personality.mood);
    setFormAge(profile.personality.age);
    setFormFormality(profile.speechStyle.formality);
    setFormVocabulary(profile.speechStyle.vocabulary);
    setFormCatchphrases(profile.patterns.catchphrases.join('\n'));
    setFormFillerWords(profile.patterns.fillerWords.join(', '));
    setFormPreferredWords(
      Object.entries(profile.patterns.preferredWords)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
    );
  };

  const handleCreate = () => {
    if (!formName.trim()) {
      toast.error(t('common.inserisciUnNomePerIlPersonaggio'));
      return;
    }

    const preferredWords: Record<string, string> = {};
    formPreferredWords.split('\n').forEach(line => {
      const [from, to] = line.split('=').map(s => s.trim());
      if (from && to) preferredWords[from] = to;
    });

    const profile = characterVoiceService.createProfile({
      name: formName,
      gameId,
      personality: {
        archetype: formArchetype,
        traits: formTraits.split(',').map(s => s.trim()).filter(Boolean),
        mood: formMood,
        age: formAge,
        gender: 'neutral'
      },
      speechStyle: {
        formality: formFormality,
        vocabulary: formVocabulary,
        sentenceLength: 'medium',
        punctuationStyle: 'standard'
      },
      patterns: {
        catchphrases: formCatchphrases.split('\n').filter(Boolean),
        fillerWords: formFillerWords.split(',').map(s => s.trim()).filter(Boolean),
        endingSuffixes: [],
        avoidWords: [],
        preferredWords
      },
      exampleDialogues: []
    });

    setProfiles([...profiles, profile]);
    setSelectedProfile(profile);
    setIsCreating(false);
    resetForm();
    toast.success(`Personaggio "${profile.name}" creato!`);
  };

  const handleDelete = (id: string) => {
    characterVoiceService.deleteProfile(id);
    setProfiles(profiles.filter(p => p.id !== id));
    if (selectedProfile?.id === id) {
      setSelectedProfile(null);
    }
    toast.success(t('common.personaggioEliminato'));
  };

  const handleTestTranslation = async () => {
    if (!selectedProfile || !testText.trim()) return;
    
    setIsTranslating(true);
    try {
      const result = await characterVoiceService.translateWithProfile(
        selectedProfile,
        testText,
        'it'
      );
      setTranslatedText(result.translated);
      toast.success(t('common.traduzioneCompletata'));
    } catch {
      toast.error(t('common.erroreNellaTraduzione'));
    } finally {
      setIsTranslating(false);
    }
  };

  const applyPreset = (archetype: CharacterArchetype) => {
    setFormArchetype(archetype);
    const preset = ARCHETYPE_PRESETS[archetype];
    if (preset.personality) {
      setFormTraits(preset.personality.traits?.join(', ') || '');
      setFormMood(preset.personality.mood || 'calm');
      setFormAge(preset.personality.age || 'adult');
    }
    if (preset.speechStyle) {
      setFormFormality(preset.speechStyle.formality || 'neutral');
      setFormVocabulary(preset.speechStyle.vocabulary || 'standard');
    }
    if (preset.patterns) {
      setFormCatchphrases(preset.patterns.catchphrases?.join('\n') || '');
      setFormFillerWords(preset.patterns.fillerWords?.join(', ') || '');
      setFormPreferredWords(
        Object.entries(preset.patterns.preferredWords || {})
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero Header - stile ai-translator */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-noir-600 via-noir-600 to-noir-600 animate-shimmer p-3 shadow-xl shadow-noir-900/50">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {t('characterVoiceEditor.title')}
              </h1>
              <p className="text-white/70 text-2xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('characterVoiceEditor.subtitle')}
              </p>
            </div>
          </div>
          
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                {t('characterVoiceEditor.newCharacter')}
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('common.creaNuovoPersonaggio')}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  {/* Nome e Archetipo */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('characterVoiceEditor.charName')}</Label>
                      <Input 
                        value={formName} 
                        onChange={e => setFormName(e.target.value)}
                        placeholder={t('characterVoiceEditor.charNamePlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('common.archetipo')}</Label>
                      <Select value={formArchetype} onValueChange={(v: CharacterArchetype) => applyPreset(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ARCHETYPE_NAMES).map(([key, name]) => (
                            <SelectItem key={key} value={key}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Personalità */}
                  <div className="space-y-2">
                    <Label>{t('characterVoiceEditor.traits')}</Label>
                    <Input 
                      value={formTraits} 
                      onChange={e => setFormTraits(e.target.value)}
                      placeholder={t('characterVoiceEditor.traitsPlaceholder')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('characterVoiceEditor.mood')}</Label>
                      <Select value={formMood} onValueChange={(v: string) => setFormMood(v as "mysterious" | "serious" | "cheerful" | "aggressive" | "calm" | "nervous")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cheerful">{t('characterVoiceEditor.moodHappy')}</SelectItem>
                          <SelectItem value="serious">{t('characterVoiceEditor.moodSerious')}</SelectItem>
                          <SelectItem value="mysterious">{t('characterVoiceEditor.moodMysterious')}</SelectItem>
                          <SelectItem value="aggressive">{t('characterVoiceEditor.moodAggressive')}</SelectItem>
                          <SelectItem value="calm">{t('characterVoiceEditor.moodCalm')}</SelectItem>
                          <SelectItem value="nervous">{t('characterVoiceEditor.moodNervous')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('characterVoiceEditor.age')}</Label>
                      <Select value={formAge} onValueChange={(v: string) => setFormAge(v as "child" | "teen" | "adult" | "elderly")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="child">{t('characterVoiceEditor.ageChild')}</SelectItem>
                          <SelectItem value="teen">{t('characterVoiceEditor.ageTeen')}</SelectItem>
                          <SelectItem value="adult">{t('characterVoiceEditor.ageAdult')}</SelectItem>
                          <SelectItem value="elderly">{t('characterVoiceEditor.ageElder')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Stile parlato */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('characterVoiceEditor.formality')}</Label>
                      <Select value={formFormality} onValueChange={(v: string) => setFormFormality(v as "formal" | "informal" | "neutral" | "very_formal" | "very_informal")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="very_formal">{t('characterVoiceEditor.formalityVeryFormal')}</SelectItem>
                          <SelectItem value="formal">{t('characterVoiceEditor.formalityFormal')}</SelectItem>
                          <SelectItem value="neutral">{t('characterVoiceEditor.formalityNeutral')}</SelectItem>
                          <SelectItem value="informal">{t('characterVoiceEditor.formalityInformal')}</SelectItem>
                          <SelectItem value="very_informal">{t('characterVoiceEditor.formalityVeryInformal')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('characterVoiceEditor.vocabulary')}</Label>
                      <Select value={formVocabulary} onValueChange={(v: string) => setFormVocabulary(v as "simple" | "archaic" | "sophisticated" | "standard" | "slang" | "technical")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="archaic">{t('characterVoiceEditor.vocabArchaic')}</SelectItem>
                          <SelectItem value="sophisticated">{t('characterVoiceEditor.vocabSophisticated')}</SelectItem>
                          <SelectItem value="standard">{t('characterVoiceEditor.vocabStandard')}</SelectItem>
                          <SelectItem value="simple">{t('characterVoiceEditor.vocabSimple')}</SelectItem>
                          <SelectItem value="slang">{t('characterVoiceEditor.vocabSlang')}</SelectItem>
                          <SelectItem value="technical">{t('characterVoiceEditor.vocabTechnical')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Pattern */}
                  <div className="space-y-2">
                    <Label>{t('characterVoiceEditor.typicalPhrases')}</Label>
                    <Textarea 
                      value={formCatchphrases}
                      onChange={e => setFormCatchphrases(e.target.value)}
                      placeholder={t('characterVoiceEditor.typicalPhrasesPlaceholder')}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('characterVoiceEditor.fillers')}</Label>
                    <Input 
                      value={formFillerWords}
                      onChange={e => setFormFillerWords(e.target.value)}
                      placeholder={t('characterVoiceEditor.fillersPlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('characterVoiceEditor.substitutions')}</Label>
                    <Textarea 
                      value={formPreferredWords}
                      onChange={e => setFormPreferredWords(e.target.value)}
                      placeholder={t('characterVoiceEditor.substitutionsPlaceholder')}
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsCreating(false); resetForm(); }}>
                    {t('characterVoiceEditor.cancel')}
                  </Button>
                  <Button onClick={handleCreate}>
                    <Save className="h-4 w-4 mr-2" />
                    {t('characterVoiceEditor.createCharacter')}
                  </Button>
                </DialogFooter>
              </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Lista personaggi */}
        <Card className="col-span-1 bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Personaggi ({profiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {profiles.length === 0 ? (
                <div className="text-center py-8 text-noir-500">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('common.nessunPersonaggio')}</p>
                  <p className="text-xs">{t('characterVoiceEditor.createFirst')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {profiles.map(profile => (
                    <div
                      key={profile.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedProfile?.id === profile.id 
                          ? 'bg-rouge-600/30 border border-rouge-500/50' 
                          : 'bg-white/5 hover:bg-white/10 border border-transparent'
                      }`}
                      onClick={() => {
                        setSelectedProfile(profile);
                        loadProfileToForm(profile);
                        onProfileSelect?.(profile);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {ARCHETYPE_ICONS[profile.personality.archetype]}
                        <span className="font-medium text-sm">{profile.name}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-2xs">
                          {ARCHETYPE_NAMES[profile.personality.archetype]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Dettagli e test */}
        <Card className="col-span-2 bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('characterVoiceEditor.testTranslation')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedProfile ? (
              <>
                {/* Info profilo */}
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {ARCHETYPE_ICONS[selectedProfile.personality.archetype]}
                      <span className="font-bold">{selectedProfile.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(selectedProfile.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedProfile.personality.traits.map((trait, i) => (
                      <Badge key={i} variant="outline" className="text-2xs">{trait}</Badge>
                    ))}
                  </div>
                  {selectedProfile.patterns.catchphrases.length > 0 && (
                    <p className="text-xs text-noir-400 mt-2 italic">
                      {'"'}{selectedProfile.patterns.catchphrases[0]}{'"'}
                    </p>
                  )}
                </div>

                {/* Test area */}
                <div className="space-y-2">
                  <Label className="text-xs">{t('characterVoiceEditor.originalText')}</Label>
                  <Textarea
                    value={testText}
                    onChange={e => setTestText(e.target.value)}
                    placeholder={t('characterVoiceEditor.originalTextPlaceholder')}
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleTestTranslation}
                  disabled={isTranslating}
                  className="w-full"
                >
                  {isTranslating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {t('characterVoiceEditor.translateWithPersonality')}
                </Button>

                {translatedText && (
                  <div className="space-y-2">
                    <Label className="text-xs">{t('characterVoiceEditor.translation')}</Label>
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                      <p className="text-sm text-green-200">{translatedText}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(translatedText);
                        toast.success(t('common.copiato'));
                      }}
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      {t('characterVoiceEditor.copy')}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-noir-500">
                <User className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-sm">{t('common.selezionaUnPersonaggio')}</p>
                <p className="text-xs">per testare la traduzione con personalità</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

