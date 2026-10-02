'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  MessageSquareText, 
  UserCircle, 
  Sparkles,
  Save,
  RotateCcw,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/lib/i18n';

interface CustomPromptSettings {
  enabled: boolean;
  persona: string;
  tone: string;
  customPrompt: string;
}

// Letti da withStoredCustomPrompt (lib/ai/ai-translate-direct.ts) all'ingresso
// della catena di traduzione. Fino al 01/10/2026 questa chiave non la leggeva
// nessuno, e qui c'era anche un blocco «DeepL Voice API» (voce TTS, preserva
// voce) che non arrivava a nessun audio: tolto.
const DEFAULT_SETTINGS: CustomPromptSettings = {
  enabled: false,
  persona: '',
  tone: '',
  customPrompt: '',
};

const PERSONA_PRESETS = [
  { value: '', label: 'Nessuna persona' },
  { value: 'a wise old wizard', label: 'Mago saggio' },
  { value: 'a medieval knight', label: 'Cavaliere medievale' },
  { value: 'a futuristic AI', label: 'AI futuristica' },
  { value: 'a pirate captain', label: 'Capitano pirata' },
  { value: 'a noble lady', label: 'Dama nobile' },
  { value: 'a street-smart kid', label: 'Ragazzo di strada' },
  { value: 'a sci-fi captain', label: 'Capitano sci-fi' },
  { value: 'a horror narrator', label: 'Narratore horror' },
];

const TONE_PRESETS = [
  { value: '', label: 'Nessun tono specifico' },
  { value: 'formal', label: 'Formale' },
  { value: 'casual', label: 'Casuale' },
  { value: 'humorous', label: 'Umoristico' },
  { value: 'sarcastic', label: 'Sarcastico' },
  { value: 'mysterious', label: 'Misterioso' },
  { value: 'epic', label: 'Epico' },
  { value: 'dark', label: 'Dark / Sinister' },
  { value: 'romantic', label: 'Romantico' },
  { value: 'technical', label: 'Tecnico' },
  { value: 'childish', label: 'Infantile' },
];

export function CustomPromptSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<CustomPromptSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('gs_custom_prompt_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('gs_custom_prompt_settings', JSON.stringify(settings));
    setSaved(true);
    toast.success(t('customPromptSettings.settingsSaved'));
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('gs_custom_prompt_settings');
    toast.success(t('customPromptSettings.settingsReset'));
  };

  const updateSetting = <K extends keyof CustomPromptSettings>(
    key: K,
    value: CustomPromptSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="p-4">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="h-4 w-4 text-purple-400" />
          {t('customPromptSettings.customPrompt')}<Badge variant="outline" className="text-xs ml-2">{t('customPromptSettings.newBadge')}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {t('customPromptSettings.subtitle')}</p>
      </CardHeader>
      
      <CardContent className="p-0 space-y-4">
        {/* Abilitazione Custom Prompt */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <div>
              <span className="text-sm font-medium">{t('customPromptSettings.enableCustomPrompt')}</span>
              <p className="text-xs text-muted-foreground">
                {t('customPromptSettings.enableDescCloud')}</p>
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSetting('enabled', checked)}
          />
        </div>

        {settings.enabled && (
          <>
            <Separator />
            
            {/* Persona */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5 text-cyan-400" />
                {t('customPromptSettings.personaRole')}</Label>
              <Select
                value={settings.persona}
                onValueChange={(value) => updateSetting('persona', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={t('customPromptSettings.personaPh')} />
                </SelectTrigger>
                <SelectContent>
                  {PERSONA_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('customPromptSettings.personaDesc')}</p>
            </div>

            {/* Tono */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-pink-400" />
                {t('customPromptSettings.toneStyle')}</Label>
              <Select
                value={settings.tone}
                onValueChange={(value) => updateSetting('tone', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={t('customPromptSettings.tonePh')} />
                </SelectTrigger>
                <SelectContent>
                  {TONE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Prompt libero */}
            <div className="space-y-2">
              <Label className="text-xs">{t('customPromptSettings.customPrompt')}</Label>
              <Textarea
                placeholder={t('customPromptSettings.customPromptPh')}
                value={settings.customPrompt}
                onChange={(e) => updateSetting('customPrompt', e.target.value)}
                className="text-sm min-h-[80px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {t('customPromptSettings.customPromptDesc')}</p>
            </div>
          </>
        )}

        <Separator />

        {/* Preview */}
        {(settings.persona || settings.tone || settings.customPrompt) && (
          <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
            <p className="text-xs font-medium text-slate-300 mb-2">{t('customPromptSettings.preview')}</p>
            <p className="text-xs text-slate-400 italic">
              {settings.persona && `Persona: "${settings.persona}"`}
              {settings.persona && settings.tone && ' · '}
              {settings.tone && `Tono: "${settings.tone}"`}
              {(settings.persona || settings.tone) && settings.customPrompt && ' · '}
              {settings.customPrompt && `Custom: "${settings.customPrompt.substring(0, 50)}${settings.customPrompt.length > 50 ? '...' : ''}"`}
            </p>
          </div>
        )}

        {/* Azioni */}
        <div className="flex items-center gap-2 pt-2">
          <Button 
            size="sm" 
            onClick={handleSave}
            className="gap-1.5"
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? 'Salvato!' : 'Salva'}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('customPromptSettings.reset')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { DEFAULT_SETTINGS };
export type { CustomPromptSettings as CustomPromptSettingsType };

