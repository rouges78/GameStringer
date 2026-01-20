'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  Swords,
  Crown,
  Baby,
  Bot,
  Skull,
  Coins,
  Wand2,
  Shield,
  Copy,
  Sparkles
} from 'lucide-react';
import { CHARACTER_PRESETS, type CharacterProfile } from '@/lib/translation-quality';

const PRESET_ICONS: Record<string, React.ElementType> = {
  pirate: Swords,
  noble: Crown,
  child: Baby,
  robot: Bot,
  warrior: Shield,
  merchant: Coins,
  wizard: Wand2,
  villain: Skull
};

const VOCABULARY_OPTIONS = [
  { value: 'moderno', label: 'Modern', description: 'Standard contemporary language' },
  { value: 'arcaico', label: 'Archaic', description: 'Ancient, medieval terms' },
  { value: 'slang', label: 'Slang', description: 'Colloquial, jargon language' },
  { value: 'tecnico', label: 'Technical', description: 'Scientific/technological terms' },
  { value: 'bambino', label: 'Child', description: 'Simple words, exclamations' }
];

const TONE_OPTIONS = [
  { value: 'formale', label: 'Formal', description: 'Formal, detached' },
  { value: 'informale', label: 'Informal', description: 'Casual, friendly' },
  { value: 'neutro', label: 'Neutral', description: 'No specific preference' }
];

interface CharacterProfileManagerProps {
  onSelectProfile?: (profile: CharacterProfile | null) => void;
  selectedProfileId?: string | null;
}

export function CharacterProfileManager({ 
  onSelectProfile, 
  selectedProfileId 
}: CharacterProfileManagerProps) {
  const [customProfiles, setCustomProfiles] = useState<CharacterProfile[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CharacterProfile | null>(null);
  const [newProfile, setNewProfile] = useState<Partial<CharacterProfile>>({
    name: '',
    personality: '',
    speechPatterns: [],
    vocabulary: 'moderno',
    tone: 'neutro',
    examples: []
  });
  const [newSpeechPattern, setNewSpeechPattern] = useState('');
  const [newExample, setNewExample] = useState({ source: '', translation: '' });

  // Load custom profiles from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gamestringer_character_profiles');
    if (saved) {
      try {
        setCustomProfiles(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load character profiles:', e);
      }
    }
  }, []);

  // Save custom profiles to localStorage
  const saveProfiles = (profiles: CharacterProfile[]) => {
    setCustomProfiles(profiles);
    localStorage.setItem('gamestringer_character_profiles', JSON.stringify(profiles));
  };

  const handleCreateProfile = () => {
    if (!newProfile.name || !newProfile.personality) return;

    const profile: CharacterProfile = {
      id: `custom_${Date.now()}`,
      name: newProfile.name,
      personality: newProfile.personality,
      speechPatterns: newProfile.speechPatterns || [],
      vocabulary: newProfile.vocabulary as CharacterProfile['vocabulary'],
      tone: newProfile.tone as CharacterProfile['tone'],
      examples: newProfile.examples || []
    };

    if (editingProfile) {
      // Update existing
      const updated = customProfiles.map(p => 
        p.id === editingProfile.id ? { ...profile, id: editingProfile.id } : p
      );
      saveProfiles(updated);
    } else {
      // Create new
      saveProfiles([...customProfiles, profile]);
    }

    resetForm();
    setIsCreateDialogOpen(false);
  };

  const handleDeleteProfile = (profileId: string) => {
    saveProfiles(customProfiles.filter(p => p.id !== profileId));
    if (selectedProfileId === profileId) {
      onSelectProfile?.(null);
    }
  };

  const handleEditProfile = (profile: CharacterProfile) => {
    setEditingProfile(profile);
    setNewProfile({
      name: profile.name,
      personality: profile.personality,
      speechPatterns: profile.speechPatterns || [],
      vocabulary: profile.vocabulary || 'moderno',
      tone: profile.tone || 'neutro',
      examples: profile.examples || []
    });
    setIsCreateDialogOpen(true);
  };

  const handleDuplicatePreset = (presetKey: string) => {
    const preset = CHARACTER_PRESETS[presetKey];
    if (!preset) return;

    setNewProfile({
      name: `${presetKey.charAt(0).toUpperCase() + presetKey.slice(1)} (Copy)`,
      personality: preset.personality,
      speechPatterns: preset.speechPatterns || [],
      vocabulary: preset.vocabulary || 'moderno',
      tone: preset.tone || 'neutro',
      examples: []
    });
    setEditingProfile(null);
    setIsCreateDialogOpen(true);
  };

  const resetForm = () => {
    setNewProfile({
      name: '',
      personality: '',
      speechPatterns: [],
      vocabulary: 'moderno',
      tone: 'neutro',
      examples: []
    });
    setEditingProfile(null);
    setNewSpeechPattern('');
    setNewExample({ source: '', translation: '' });
  };

  const addSpeechPattern = () => {
    if (newSpeechPattern.trim()) {
      setNewProfile(prev => ({
        ...prev,
        speechPatterns: [...(prev.speechPatterns || []), newSpeechPattern.trim()]
      }));
      setNewSpeechPattern('');
    }
  };

  const removeSpeechPattern = (index: number) => {
    setNewProfile(prev => ({
      ...prev,
      speechPatterns: (prev.speechPatterns || []).filter((_, i) => i !== index)
    }));
  };

  const addExample = () => {
    if (newExample.source.trim() && newExample.translation.trim()) {
      setNewProfile(prev => ({
        ...prev,
        examples: [...(prev.examples || []), { ...newExample }]
      }));
      setNewExample({ source: '', translation: '' });
    }
  };

  const removeExample = (index: number) => {
    setNewProfile(prev => ({
      ...prev,
      examples: (prev.examples || []).filter((_, i) => i !== index)
    }));
  };

  const handleSelectProfile = (profile: CharacterProfile) => {
    onSelectProfile?.(profile);
  };

  const handleSelectPreset = (presetKey: string) => {
    const preset = CHARACTER_PRESETS[presetKey];
    if (preset) {
      onSelectProfile?.({
        id: presetKey,
        name: presetKey.charAt(0).toUpperCase() + presetKey.slice(1),
        ...preset
      } as CharacterProfile);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold">Character Voice Profiles</h3>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-purple-500 hover:bg-purple-600">
              <Plus className="h-4 w-4 mr-1" />
              New Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? 'Edit Profile' : 'Create New Character Profile'}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-4 py-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Character Name</label>
                    <Input
                      value={newProfile.name || ''}
                      onChange={(e) => setNewProfile(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Captain Blackbeard"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Vocabulary</label>
                    <Select 
                      value={newProfile.vocabulary || 'moderno'} 
                      onValueChange={(v) => setNewProfile(prev => ({ ...prev, vocabulary: v as CharacterProfile['vocabulary'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOCABULARY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div>
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Personality */}
                <div>
                  <label className="text-sm font-medium">Personality and Description</label>
                  <Textarea
                    value={newProfile.personality || ''}
                    onChange={(e) => setNewProfile(prev => ({ ...prev, personality: e.target.value }))}
                    placeholder="Describe the character's personality, speaking style, distinctive traits..."
                    className="min-h-[80px]"
                  />
                </div>

                {/* Tone */}
                <div>
                  <label className="text-sm font-medium">Tone</label>
                  <div className="flex gap-2 mt-1">
                    {TONE_OPTIONS.map(opt => (
                      <Button
                        key={opt.value}
                        variant={newProfile.tone === opt.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNewProfile(prev => ({ ...prev, tone: opt.value as CharacterProfile['tone'] }))}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Speech Patterns */}
                <div>
                  <label className="text-sm font-medium">Speech Patterns (typical phrases)</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newSpeechPattern}
                      onChange={(e) => setNewSpeechPattern(e.target.value)}
                      placeholder="e.g. 'Arrr!' or 'By a thousand whales!'"
                      onKeyDown={(e) => e.key === 'Enter' && addSpeechPattern()}
                    />
                    <Button onClick={addSpeechPattern} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(newProfile.speechPatterns || []).map((pattern, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        "{pattern}"
                        <button onClick={() => removeSpeechPattern(i)} className="ml-1 hover:text-red-500">
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Examples */}
                <div>
                  <label className="text-sm font-medium">Translation Examples (optional)</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Add examples to help the AI understand the style
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={newExample.source}
                      onChange={(e) => setNewExample(prev => ({ ...prev, source: e.target.value }))}
                      placeholder="Original text"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={newExample.translation}
                        onChange={(e) => setNewExample(prev => ({ ...prev, translation: e.target.value }))}
                        placeholder="How it should translate"
                        onKeyDown={(e) => e.key === 'Enter' && addExample()}
                      />
                      <Button onClick={addExample} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {(newProfile.examples || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {(newProfile.examples || []).map((ex, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-muted p-2 rounded">
                          <span className="text-muted-foreground">"{ex.source}"</span>
                          <span>→</span>
                          <span className="font-medium">"{ex.translation}"</span>
                          <button 
                            onClick={() => removeExample(i)} 
                            className="ml-auto hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <Button 
                  onClick={handleCreateProfile} 
                  className="w-full"
                  disabled={!newProfile.name || !newProfile.personality}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingProfile ? 'Save Changes' : 'Create Profile'}
                </Button>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Preset Profiles */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Preset Profiles</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(CHARACTER_PRESETS).map(([key, preset]) => {
            const Icon = PRESET_ICONS[key] || Users;
            const isSelected = selectedProfileId === key;

            return (
              <Card 
                key={key}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-purple-500 bg-purple-500/5' : ''
                }`}
                onClick={() => handleSelectPreset(key)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-sm capitalize">{key}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicatePreset(key);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {preset.personality}
                  </p>
                  <div className="flex gap-1 mt-2">
                    <Badge variant="outline" className="text-[10px] px-1">
                      {preset.vocabulary || 'moderno'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1">
                      {preset.tone || 'neutro'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Custom Profiles */}
      {customProfiles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">I Tuoi Profili</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {customProfiles.map(profile => {
              const isSelected = selectedProfileId === profile.id;

              return (
                <Card 
                  key={profile.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-purple-500 bg-purple-500/5' : ''
                  }`}
                  onClick={() => handleSelectProfile(profile)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium text-sm">{profile.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProfile(profile);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(profile.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {profile.personality}
                    </p>
                    <div className="flex gap-1 mt-2">
                      <Badge variant="outline" className="text-[10px] px-1">
                        {profile.vocabulary || 'moderno'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1">
                        {profile.tone || 'neutro'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Profile Summary */}
      {selectedProfileId && (
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">
                  Active profile: {selectedProfileId}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSelectProfile?.(null)}
              >
                Deselect
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



