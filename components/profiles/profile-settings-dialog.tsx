'use client';

import { useState, useEffect } from 'react';
import { useProfileAuth } from '@/lib/profile-auth';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Settings, 
  Bell, 
  Palette, 
  LayoutGrid, 
  Clock,
  Save,
  RotateCcw,
  User,
  Shield,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { ThemeSelector } from '@/components/ui/theme-toggle';
import { DEFAULT_PROFILE_SETTINGS, type ProfileSettings } from '@/types/profiles';

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  const { currentProfile } = useProfileAuth();
  const { settings, updateSettings } = useProfileSettings();
  
  const [localSettings, setLocalSettings] = useState<ProfileSettings>(
    settings || DEFAULT_PROFILE_SETTINGS
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      toast.success('Settings saved');
      onOpenChange(false);
    } catch (error) {
      toast.error('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_PROFILE_SETTINGS);
    toast.info('Settings reset to default values');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        {/* Accessibilità - DialogTitle nascosto */}
        <VisuallyHidden>
          <DialogTitle>Profile Settings</DialogTitle>
        </VisuallyHidden>
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-t-lg border-b border-purple-500/20 bg-gradient-to-r from-purple-950/80 via-violet-950/60 to-pink-950/80 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/20 rounded-full blur-3xl" />
          
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/30">
              <User className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                Profile Settings
              </h2>
              <p className="text-sm text-purple-200/60 mt-0.5">
                Customize {currentProfile?.name}
              </p>
            </div>
          </div>
          
          {/* Quick stats */}
          <div className="relative flex gap-4 mt-4 pt-3 border-t border-purple-500/20">
            <div className="flex items-center gap-1.5 text-xs text-purple-300/80">
              <Shield className="h-3.5 w-3.5" />
              <span>Active session</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-pink-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Custom theme</span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Theme */}
          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-300">
                <Palette className="h-4 w-4" />
                Tema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ThemeSelector />
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-300">
                <Bell className="h-4 w-4" />
                Notifiche
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Notifiche desktop</Label>
                <Switch
                  checked={localSettings.notifications.desktop_enabled}
                  onCheckedChange={(checked) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, desktop_enabled: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Suoni</Label>
                <Switch
                  checked={localSettings.notifications.sound_enabled}
                  onCheckedChange={(checked) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, sound_enabled: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Nuovi games</Label>
                <Switch
                  checked={localSettings.notifications.new_games}
                  onCheckedChange={(checked) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, new_games: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Aggiornamenti</Label>
                <Switch
                  checked={localSettings.notifications.updates}
                  onCheckedChange={(checked) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, updates: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Offerte</Label>
                <Switch
                  checked={localSettings.notifications.deals}
                  onCheckedChange={(checked) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, deals: checked }
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Library */}
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-300">
                <LayoutGrid className="h-4 w-4" />
                library
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Vista predefinita</Label>
                <Select
                  value={localSettings.game_library.default_view}
                  onValueChange={(value: 'grid' | 'list') => 
                    setLocalSettings(prev => ({
                      ...prev,
                      game_library: { ...prev.game_library, default_view: value }
                    }))
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Griglia</SelectItem>
                    <SelectItem value="list">Lista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Mostra games nascosti</Label>
                <Switch
                  checked={localSettings.game_library.show_hidden}
                  onCheckedChange={(checked) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      game_library: { ...prev.game_library, show_hidden: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">update automatico</Label>
                <Switch
                  checked={localSettings.game_library.auto_refresh}
                  onCheckedChange={(checked) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      game_library: { ...prev.game_library, auto_refresh: checked }
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Session */}
          <Card className="border-sky-500/20 bg-sky-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-sky-300">
                <Clock className="h-4 w-4" />
                Sessione
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">
                  Timeout sessione: {localSettings.security.session_timeout} minuti
                </Label>
                <Slider
                  value={[localSettings.security.session_timeout]}
                  onValueChange={(value) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, session_timeout: value[0] }
                    }))
                  }
                  min={15}
                  max={480}
                  step={15}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Login automatico</Label>
                <Switch
                  checked={localSettings.auto_login}
                  onCheckedChange={(checked) => 
                    setLocalSettings(prev => ({
                      ...prev,
                      auto_login: checked
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-border/50">
            <Button variant="outline" onClick={handleReset} className="flex-1 border-purple-500/30 hover:bg-purple-500/10">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



