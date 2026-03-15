'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Palette, 
  Sparkles, 
  Users, 
  Download, 
  Upload,
  Check,
  Star,
  Heart,
  Zap,
  Moon,
  Sun,
  Brush,
  RotateCcw,
  Save,
  Eye,
  Copy,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/lib/i18n';

interface CustomTheme {
  id: string;
  name: string;
  author: string;
  downloads: number;
  likes: number;
  preview: string;
  colors: ThemeColors;
  isOfficial?: boolean;
  isCommunity?: boolean;
}

interface ThemeColors {
  primary: string;
  accent: string;
  success: string;
  warning: string;
  destructive: string;
  sidebar: string;
  headerGradient: string;
}

interface ThemeCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Temi predefiniti
const PRESET_THEMES: CustomTheme[] = [
  {
    id: 'default-blue',
    name: 'GameStringer Blue',
    author: 'Official',
    downloads: 15420,
    likes: 892,
    preview: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    isOfficial: true,
    colors: {
      primary: '#3b82f6',
      accent: '#6366f1',
      success: '#10b981',
      warning: '#f59e0b',
      destructive: '#ef4444',
      sidebar: '#0a0a12',
      headerGradient: 'from-blue-600 via-indigo-600 to-violet-600'
    }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077',
    author: 'NightCity_Dev',
    downloads: 8932,
    likes: 654,
    preview: 'linear-gradient(135deg, #f9f002, #ff00ff)',
    isCommunity: true,
    colors: {
      primary: '#f9f002',
      accent: '#ff00ff',
      success: '#00ff9f',
      warning: '#ff6b00',
      destructive: '#ff0055',
      sidebar: '#0d0d1a',
      headerGradient: 'from-yellow-400 via-pink-500 to-purple-600'
    }
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    author: 'GreenThumb',
    downloads: 5621,
    likes: 423,
    preview: 'linear-gradient(135deg, #10b981, #059669)',
    isCommunity: true,
    colors: {
      primary: '#10b981',
      accent: '#059669',
      success: '#22c55e',
      warning: '#eab308',
      destructive: '#dc2626',
      sidebar: '#052e16',
      headerGradient: 'from-emerald-600 via-green-600 to-teal-600'
    }
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Vibes',
    author: 'SunsetLover',
    downloads: 4218,
    likes: 312,
    preview: 'linear-gradient(135deg, #f97316, #ea580c)',
    isCommunity: true,
    colors: {
      primary: '#f97316',
      accent: '#ea580c',
      success: '#84cc16',
      warning: '#facc15',
      destructive: '#dc2626',
      sidebar: '#1c1917',
      headerGradient: 'from-orange-500 via-amber-500 to-yellow-500'
    }
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    author: 'Elegance',
    downloads: 6789,
    likes: 521,
    preview: 'linear-gradient(135deg, #f43f5e, #ec4899)',
    isCommunity: true,
    colors: {
      primary: '#f43f5e',
      accent: '#ec4899',
      success: '#14b8a6',
      warning: '#f59e0b',
      destructive: '#be123c',
      sidebar: '#1a0a10',
      headerGradient: 'from-rose-500 via-pink-500 to-fuchsia-500'
    }
  },
  {
    id: 'arctic-ice',
    name: 'Arctic Ice',
    author: 'FrostByte',
    downloads: 3542,
    likes: 287,
    preview: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
    isCommunity: true,
    colors: {
      primary: '#06b6d4',
      accent: '#0ea5e9',
      success: '#22d3ee',
      warning: '#fbbf24',
      destructive: '#f43f5e',
      sidebar: '#042f2e',
      headerGradient: 'from-cyan-500 via-sky-500 to-blue-500'
    }
  },
  {
    id: 'purple-haze',
    name: 'Purple Haze',
    author: 'PsychedelicDev',
    downloads: 7123,
    likes: 489,
    preview: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
    isCommunity: true,
    colors: {
      primary: '#8b5cf6',
      accent: '#a855f7',
      success: '#22c55e',
      warning: '#f59e0b',
      destructive: '#ef4444',
      sidebar: '#1e1033',
      headerGradient: 'from-violet-600 via-purple-600 to-fuchsia-600'
    }
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    author: 'MinimalDev',
    downloads: 2891,
    likes: 198,
    preview: 'linear-gradient(135deg, #71717a, #52525b)',
    isCommunity: true,
    colors: {
      primary: '#71717a',
      accent: '#a1a1aa',
      success: '#84cc16',
      warning: '#fbbf24',
      destructive: '#ef4444',
      sidebar: '#18181b',
      headerGradient: 'from-zinc-600 via-gray-600 to-slate-600'
    }
  }
];

const DEFAULT_COLORS: ThemeColors = PRESET_THEMES[0].colors;

export function ThemeCustomizer({ open, onOpenChange }: ThemeCustomizerProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('presets');
  const [selectedTheme, setSelectedTheme] = useState<CustomTheme | null>(null);
  const [customColors, setCustomColors] = useState<ThemeColors>(DEFAULT_COLORS);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [savedThemes, setSavedThemes] = useState<CustomTheme[]>([]);

  // Carica tema salvato
  useEffect(() => {
    const saved = localStorage.getItem('gamestringer-custom-theme');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCustomColors(parsed.colors || DEFAULT_COLORS);
        setSelectedTheme(parsed);
      } catch {
        // Ignora errori di parsing
      }
    }
    
    // Carica temi salvati dall'utente
    const userThemes = localStorage.getItem('gamestringer-user-themes');
    if (userThemes) {
      try {
        setSavedThemes(JSON.parse(userThemes));
      } catch {
        // Ignora
      }
    }
  }, []);

  // Applica preview colori
  useEffect(() => {
    if (isPreviewActive && customColors) {
      applyThemeColors(customColors);
    }
  }, [customColors, isPreviewActive]);

  const applyThemeColors = (colors: ThemeColors) => {
    const root = document.documentElement;
    
    // Converti hex in HSL per le variabili CSS
    const hexToHsl = (hex: string): string => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    // Applica le variabili CSS
    root.style.setProperty('--primary', hexToHsl(colors.primary));
    root.style.setProperty('--accent', hexToHsl(colors.accent));
    root.style.setProperty('--success', hexToHsl(colors.success));
    root.style.setProperty('--destructive', hexToHsl(colors.destructive));
    
    // Salva il gradient per l'header
    root.style.setProperty('--header-gradient', colors.headerGradient);
  };

  const resetColors = () => {
    setCustomColors(DEFAULT_COLORS);
    setSelectedTheme(null);
    
    // Rimuovi variabili custom
    const root = document.documentElement;
    root.style.removeProperty('--primary');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--success');
    root.style.removeProperty('--destructive');
    root.style.removeProperty('--header-gradient');
    
    localStorage.removeItem('gamestringer-custom-theme');
    toast.success('Tema resettato ai valori predefiniti');
  };

  const applyTheme = (themeData: CustomTheme) => {
    setSelectedTheme(themeData);
    setCustomColors(themeData.colors);
    applyThemeColors(themeData.colors);
    
    localStorage.setItem('gamestringer-custom-theme', JSON.stringify(themeData));
    toast.success(`Tema "${themeData.name}" applicato!`);
  };

  const saveCustomTheme = () => {
    const newTheme: CustomTheme = {
      id: `custom-${Date.now()}`,
      name: 'Il mio tema',
      author: 'Tu',
      downloads: 0,
      likes: 0,
      preview: `linear-gradient(135deg, ${customColors.primary}, ${customColors.accent})`,
      colors: customColors
    };

    const updated = [...savedThemes, newTheme];
    setSavedThemes(updated);
    localStorage.setItem('gamestringer-user-themes', JSON.stringify(updated));
    localStorage.setItem('gamestringer-custom-theme', JSON.stringify(newTheme));
    
    toast.success('Tema personalizzato salvato!');
  };

  const exportTheme = () => {
    const themeData = {
      name: selectedTheme?.name || 'Custom Theme',
      colors: customColors,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gamestringer-theme-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Tema esportato!');
  };

  const importTheme = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.colors) {
          setCustomColors(data.colors);
          applyThemeColors(data.colors);
          toast.success('Tema importato!');
        }
      } catch {
        toast.error('Errore importazione tema');
      }
    };
    input.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[75vh] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('themeCustomizerComp.personalizzaTema')}</DialogTitle>
          <DialogDescription>{t('themeCustomizerComp.scegliOCreaIlTuoTemaPersonaliz')}</DialogDescription>
        </DialogHeader>
        
        {/* Hero Header */}
        <div 
          className="relative overflow-hidden rounded-t-lg border-b p-6"
          style={{ 
            background: selectedTheme?.preview || `linear-gradient(135deg, ${customColors.primary}, ${customColors.accent})`
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
                <Palette className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Personalizza Tema
                </h2>
                <p className="text-sm text-white/70 mt-0.5">
                  {selectedTheme?.name || 'Scegli o crea il tuo tema'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={importTheme}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Upload className="h-4 w-4 mr-1" />
                Importa
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportTheme}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Download className="h-4 w-4 mr-1" />
                Esporta
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-4 pt-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="presets" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Temi Predefiniti
              </TabsTrigger>
              <TabsTrigger value="community" className="gap-2">
                <Users className="h-4 w-4" />
                Community
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-2">
                <Brush className="h-4 w-4" />
                Personalizza
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[350px] px-4 pb-4">
            {/* PRESET THEMES */}
            <TabsContent value="presets" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                {PRESET_THEMES.filter(t => t.isOfficial).map((themeItem) => (
                  <ThemeCard 
                    key={themeItem.id} 
                    theme={themeItem} 
                    isSelected={selectedTheme?.id === themeItem.id}
                    onSelect={() => applyTheme(themeItem)}
                  />
                ))}
              </div>
              
              <Separator className="my-6" />
              
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Temi Popolari
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {PRESET_THEMES.filter(t => t.isCommunity).slice(0, 4).map((themeItem) => (
                  <ThemeCard 
                    key={themeItem.id} 
                    theme={themeItem} 
                    isSelected={selectedTheme?.id === themeItem.id}
                    onSelect={() => applyTheme(themeItem)}
                  />
                ))}
              </div>
            </TabsContent>

            {/* COMMUNITY THEMES */}
            <TabsContent value="community" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                {PRESET_THEMES.filter(t => t.isCommunity).map((themeItem) => (
                  <ThemeCard 
                    key={themeItem.id} 
                    theme={themeItem} 
                    isSelected={selectedTheme?.id === themeItem.id}
                    onSelect={() => applyTheme(themeItem)}
                    showStats
                  />
                ))}
              </div>
              
              {savedThemes.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h3 className="text-sm font-semibold mb-4">{t('themeCustomizerComp.iTuoiTemiSalvati')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {savedThemes.map((themeItem) => (
                      <ThemeCard 
                        key={themeItem.id} 
                        theme={themeItem} 
                        isSelected={selectedTheme?.id === themeItem.id}
                        onSelect={() => applyTheme(themeItem)}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* CUSTOM EDITOR */}
            <TabsContent value="custom" className="mt-4 space-y-6">
              {/* Preview Toggle */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Anteprima Live
                    </CardTitle>
                    <Switch 
                      checked={isPreviewActive}
                      onCheckedChange={setIsPreviewActive}
                    />
                  </div>
                  <CardDescription className="text-xs">
                    Attiva per vedere le modifiche in tempo reale
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Color Pickers */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Colori Principali
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ColorPicker 
                    label="Colore Primario"
                    value={customColors.primary}
                    onChange={(v) => setCustomColors(prev => ({ ...prev, primary: v }))}
                  />
                  <ColorPicker 
                    label="Colore Accent"
                    value={customColors.accent}
                    onChange={(v) => setCustomColors(prev => ({ ...prev, accent: v }))}
                  />
                  <ColorPicker 
                    label="Successo"
                    value={customColors.success}
                    onChange={(v) => setCustomColors(prev => ({ ...prev, success: v }))}
                  />
                  <ColorPicker 
                    label="Avviso"
                    value={customColors.warning}
                    onChange={(v) => setCustomColors(prev => ({ ...prev, warning: v }))}
                  />
                  <ColorPicker 
                    label="Errore"
                    value={customColors.destructive}
                    onChange={(v) => setCustomColors(prev => ({ ...prev, destructive: v }))}
                  />
                </CardContent>
              </Card>

              {/* Preview Box */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t('themeCustomizerComp.anteprima')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="h-24 rounded-lg flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${customColors.primary}, ${customColors.accent})`
                    }}
                  >
                    <div className="flex gap-2">
                      <div 
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: customColors.success }}
                      />
                      <div 
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: customColors.warning }}
                      />
                      <div 
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: customColors.destructive }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetColors} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={saveCustomTheme} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Salva Tema
                </Button>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Componente Card Tema
function ThemeCard({ 
  theme, 
  isSelected, 
  onSelect,
  showStats = false 
}: { 
  theme: CustomTheme; 
  isSelected: boolean;
  onSelect: () => void;
  showStats?: boolean;
}) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:scale-[1.02] ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <div 
        className="h-14 rounded-t-lg relative overflow-hidden"
        style={{ background: theme.preview }}
      >
        {isSelected && (
          <div className="absolute top-2 right-2 bg-white rounded-full p-1">
            <Check className="h-4 w-4 text-green-600" />
          </div>
        )}
        {theme.isOfficial && (
          <Badge className="absolute top-2 left-2 bg-blue-500/90">
            <Zap className="h-3 w-3 mr-1" />
            Official
          </Badge>
        )}
      </div>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">{theme.name}</h4>
            <p className="text-xs text-muted-foreground">by {theme.author}</p>
          </div>
          {showStats && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {theme.downloads.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {theme.likes}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente Color Picker
function ColorPicker({ 
  label, 
  value, 
  onChange 
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div 
        className="w-10 h-10 rounded-lg border-2 border-border cursor-pointer relative overflow-hidden"
        style={{ backgroundColor: value }}
      >
        <input 
          type="color" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>
      <div className="flex-1">
        <Label className="text-sm">{label}</Label>
        <Input 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs font-mono mt-1"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
