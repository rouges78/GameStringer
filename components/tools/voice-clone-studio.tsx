'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Mic, Play, Pause, Square, Upload, Download, Trash2, 
  Settings, Volume2, AudioLines, User, Plus, RefreshCw,
  Sparkles, Languages, Save, Copy, Check, AlertTriangle
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { 
  voiceCloneService, 
  VoiceProfile, 
  VOICE_PRESETS, 
  OPENAI_VOICES,
  SynthesisResult 
} from '@/lib/voice-clone';

export function VoiceCloneStudio() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('synthesize');
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<VoiceProfile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Synthesis state
  const [inputText, setInputText] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState<SynthesisResult | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'elevenlabs'>('openai');
  const [selectedVoice, setSelectedVoice] = useState('nova');
  
  // Voice settings
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [speed, setSpeed] = useState(1.0);
  
  // Clone state
  const [isCloning, setIsCloning] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [audioSamples, setAudioSamples] = useState<File[]>([]);
  
  // API Keys dialog
  const [showApiDialog, setShowApiDialog] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfiles(voiceCloneService.getProfiles());
  }, []);

  const handleSynthesize = async () => {
    if (!inputText.trim()) {
      toast.error(t('voiceClone.enterText'));
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const profile: VoiceProfile = {
        id: 'temp',
        name: selectedVoice,
        provider: selectedProvider,
        voiceId: selectedVoice,
        settings: {
          stability,
          similarityBoost: similarity,
          speed,
        },
        createdAt: new Date().toISOString(),
      };

      const result = await voiceCloneService.synthesize({
        text: inputText,
        voiceProfile: profile,
      });

      setGeneratedAudio(result);
      toast.success(t('voiceClone.generated'));
    } catch (error: any) {
      toast.error(error.message || t('voiceClone.error'));
    } finally {
      setIsGenerating(false);
      setProgress(100);
    }
  };

  const handlePlay = () => {
    if (!audioRef.current || !generatedAudio) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.src = generatedAudio.audioUrl;
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!generatedAudio) return;
    
    const link = document.createElement('a');
    link.href = generatedAudio.audioUrl;
    link.download = `voice_${Date.now()}.mp3`;
    link.click();
  };

  const handleCloneVoice = async () => {
    if (!cloneName.trim() || audioSamples.length === 0) {
      toast.error(t('voiceClone.fillRequired'));
      return;
    }

    setIsCloning(true);

    try {
      const profile = await voiceCloneService.cloneVoice({
        name: cloneName,
        description: cloneDescription,
        audioSamples,
        provider: 'elevenlabs',
      });

      setProfiles([...profiles, profile]);
      setCloneName('');
      setCloneDescription('');
      setAudioSamples([]);
      toast.success(t('voiceClone.cloned'));
    } catch (error: any) {
      toast.error(error.message || t('voiceClone.cloneError'));
    } finally {
      setIsCloning(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAudioSamples(Array.from(files));
    }
  };

  const handleSaveApiKeys = () => {
    if (openaiKey) voiceCloneService.setApiKey('openai', openaiKey);
    if (elevenLabsKey) voiceCloneService.setApiKey('elevenlabs', elevenLabsKey);
    setShowApiDialog(false);
    toast.success(t('voiceClone.keysSaved'));
  };

  const applyPreset = (presetName: string) => {
    const preset = VOICE_PRESETS[presetName];
    if (preset) {
      if (preset.stability !== undefined) setStability(preset.stability);
      if (preset.similarityBoost !== undefined) setSimilarity(preset.similarityBoost);
      if (preset.speed !== undefined) setSpeed(preset.speed);
      toast.success(t('voiceClone.presetApplied').replace('{name}', presetName));
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero Header - Stile blu come pagina Traduci */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <AudioLines className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {t('voiceClone.title')}
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('voiceClone.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Mic className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">TTS</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowApiDialog(true)}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white"
            >
              <Settings className="h-4 w-4 mr-1" />
              API Keys
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="synthesize">
            <Volume2 className="h-4 w-4 mr-1" />
            {t('voiceClone.synthesize')}
          </TabsTrigger>
          <TabsTrigger value="clone">
            <Mic className="h-4 w-4 mr-1" />
            {t('voiceClone.clone')}
          </TabsTrigger>
          <TabsTrigger value="profiles">
            <User className="h-4 w-4 mr-1" />
            {t('voiceClone.profiles')}
          </TabsTrigger>
        </TabsList>

        {/* Synthesize Tab */}
        <TabsContent value="synthesize" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Input */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('voiceClone.textInput')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={t('voiceClone.textPlaceholder')}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {inputText.length} {t('voiceClone.characters')}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSynthesize}
                      disabled={isGenerating || !inputText.trim()}
                      className="bg-violet-600 hover:bg-violet-500"
                    >
                      {isGenerating ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      {t('voiceClone.generate')}
                    </Button>
                  </div>
                </div>

                {isGenerating && (
                  <Progress value={progress} className="h-1" />
                )}

                {generatedAudio && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handlePlay}
                      className="h-10 w-10"
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <div className="h-8 bg-violet-500/20 rounded flex items-center px-2">
                        <div className="flex-1 h-1 bg-violet-500/30 rounded">
                          <div className="h-full w-0 bg-violet-500 rounded" />
                        </div>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={handleDownload}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('voiceClone.voiceSettings')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">{t('voiceClone.provider')}</Label>
                  <Select value={selectedProvider} onValueChange={(v: any) => setSelectedProvider(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI TTS</SelectItem>
                      <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t('voiceClone.voice')}</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_VOICES.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name} ({voice.style})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('voiceClone.stability')}</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(stability * 100)}%</span>
                  </div>
                  <Slider
                    value={[stability]}
                    onValueChange={([v]) => setStability(v)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">{t('voiceClone.speed')}</Label>
                    <span className="text-xs text-muted-foreground">{speed.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[speed]}
                    onValueChange={([v]) => setSpeed(v)}
                    min={0.5}
                    max={2}
                    step={0.1}
                  />
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-xs mb-2 block">{t('voiceClone.presets')}</Label>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(VOICE_PRESETS).map((preset) => (
                      <Badge
                        key={preset}
                        variant="outline"
                        className="cursor-pointer hover:bg-violet-500/20"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Clone Tab */}
        <TabsContent value="clone" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Mic className="h-4 w-4 text-violet-500" />
                {t('voiceClone.cloneTitle')}
              </CardTitle>
              <CardDescription>
                {t('voiceClone.cloneDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {t('voiceClone.cloneWarning')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('voiceClone.voiceName')}</Label>
                  <Input
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder={t('voiceClone.voiceNamePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('voiceClone.voiceDesc')}</Label>
                  <Input
                    value={cloneDescription}
                    onChange={(e) => setCloneDescription(e.target.value)}
                    placeholder={t('voiceClone.voiceDescPlaceholder')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('voiceClone.audioSamples')}</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-violet-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {audioSamples.length > 0
                      ? `${audioSamples.length} file selezionati`
                      : t('voiceClone.dropAudio')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP3, WAV, M4A (min 1 minuto totale)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <Button
                onClick={handleCloneVoice}
                disabled={isCloning || !cloneName.trim() || audioSamples.length === 0}
                className="w-full bg-violet-600 hover:bg-violet-500"
              >
                {isCloning ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                {t('voiceClone.createClone')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-violet-500" />
                {t('voiceClone.savedProfiles')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{t('voiceClone.noProfiles')}</p>
                  <p className="text-xs mt-1">{t('voiceClone.createFirst')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-violet-500/20">
                            <AudioLines className="h-4 w-4 text-violet-500" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{profile.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {profile.provider} • {new Date(profile.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedProfile(profile)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-400"
                            onClick={() => {
                              voiceCloneService.deleteProfile(profile.id);
                              setProfiles(profiles.filter(p => p.id !== profile.id));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* API Keys Dialog */}
      <Dialog open={showApiDialog} onOpenChange={setShowApiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Keys</DialogTitle>
            <DialogDescription>
              {t('voiceClone.apiKeysDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>OpenAI API Key</Label>
              <Input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label>ElevenLabs API Key</Label>
              <Input
                type="password"
                value={elevenLabsKey}
                onChange={(e) => setElevenLabsKey(e.target.value)}
                placeholder="..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiDialog(false)}>
              {t('voiceClone.cancel')}
            </Button>
            <Button onClick={handleSaveApiKeys}>
              <Save className="h-4 w-4 mr-1" />
              {t('voiceClone.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
