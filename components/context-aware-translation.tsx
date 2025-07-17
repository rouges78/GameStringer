'use client';

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Languages, 
  Gamepad2, 
  Target, 
  Zap,
  Settings,
  Save,
  RefreshCw,
  Copy,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface GameContext {
  gameTitle: string;
  genre: string;
  setting: string; // fantasy, sci-fi, modern, etc.
  characters: string[];
  locations: string[];
  terminology: Record<string, string>;
  culturalContext: string;
}

interface TranslationContext {
  textType: 'dialogue' | 'ui' | 'item' | 'quest' | 'lore' | 'system';
  speaker?: string;
  location?: string;
  situation?: string;
  emotionalTone?: string;
  formality?: 'formal' | 'informal' | 'neutral';
}

interface ContextTranslation {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  context: TranslationContext;
  gameContext: GameContext;
  confidence: number;
  alternatives: string[];
  timestamp: Date;
}

interface ContextAwareTranslationProps {
  gameContext?: GameContext;
  onTranslationComplete: (translation: ContextTranslation) => void;
  className?: string;
}

const gameGenres = [
  'RPG', 'Action', 'Adventure', 'Strategy', 'Simulation', 'Sports', 'Racing', 'Puzzle', 'Horror', 'Sci-Fi'
];

const textTypes = [
  { value: 'dialogue', label: 'Dialogo', icon: '💬' },
  { value: 'ui', label: 'Interfaccia', icon: '🖥️' },
  { value: 'item', label: 'Oggetto', icon: '🎒' },
  { value: 'quest', label: 'Missione', icon: '📜' },
  { value: 'lore', label: 'Storia', icon: '📚' },
  { value: 'system', label: 'Sistema', icon: '⚙️' }
];

const emotionalTones = [
  'neutrale', 'amichevole', 'aggressivo', 'misterioso', 'epico', 'comico', 'drammatico', 'romantico'
];

const ContextAwareTranslation: React.FC<ContextAwareTranslationProps> = ({
  gameContext: initialGameContext,
  onTranslationComplete,
  className
}) => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [translations, setTranslations] = useState<ContextTranslation[]>([]);
  
  const [gameContext, setGameContext] = useState<GameContext>(
    initialGameContext || {
      gameTitle: 'GameStringer Demo',
      genre: 'RPG',
      setting: 'fantasy',
      characters: ['Eroe', 'Mago', 'Guerriero', 'Ladro'],
      locations: ['Villaggio', 'Castello', 'Foresta', 'Dungeon'],
      terminology: {
        'HP': 'Punti Vita',
        'MP': 'Punti Mana',
        'XP': 'Esperienza',
        'Guild': 'Gilda'
      },
      culturalContext: 'medievale fantasy'
    }
  );

  const [translationContext, setTranslationContext] = useState<TranslationContext>({
    textType: 'dialogue',
    formality: 'neutral'
  });

  const [settings, setSettings] = useState({
    useGameTerminology: true,
    preserveFormatting: true,
    adaptCulturalReferences: true,
    maintainTone: true,
    contextSensitivity: 80,
    creativityLevel: 60
  });

  // Simula traduzione contestuale
  const performContextTranslation = async (text: string): Promise<ContextTranslation> => {
    setIsTranslating(true);
    
    // Simula elaborazione
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Logica di traduzione contestuale simulata
    let translatedText = text;
    const alternatives: string[] = [];

    // Applica terminologia di gioco
    if (settings.useGameTerminology) {
      Object.entries(gameContext.terminology).forEach(([term, translation]) => {
        translatedText = translatedText.replace(new RegExp(term, 'gi'), translation);
      });
    }

    // Adatta il tono basato sul contesto
    if (translationContext.textType === 'dialogue' && translationContext.emotionalTone) {
      switch (translationContext.emotionalTone) {
        case 'epico':
          translatedText = translatedText.replace(/\./g, '!');
          alternatives.push(translatedText.replace(/tu/gi, 'voi'));
          break;
        case 'amichevole':
          translatedText = translatedText.replace(/\b(ciao|salve)\b/gi, 'ehi');
          break;
        case 'misterioso':
          translatedText = translatedText + '...';
          break;
      }
    }

    // Esempi di traduzione basati sul tipo di testo
    const contextExamples: Record<string, string> = {
      dialogue: `"${translatedText}" - Traduzione adattata per dialogo di ${translationContext.speaker || 'personaggio'}`,
      ui: `${translatedText} - Interfaccia ottimizzata per ${gameContext.genre}`,
      item: `${translatedText} - Descrizione oggetto in stile ${gameContext.setting}`,
      quest: `${translatedText} - Missione nel mondo di ${gameContext.gameTitle}`,
      lore: `${translatedText} - Storia ambientata in ${gameContext.culturalContext}`,
      system: `${translatedText} - Messaggio di sistema`
    };

    const finalTranslation = contextExamples[translationContext.textType] || translatedText;
    
    // Genera alternative
    alternatives.push(
      translatedText.replace(/\b(il|la|lo)\b/gi, 'questo/a'),
      translatedText.replace(/\b(molto|tanto)\b/gi, 'estremamente'),
      translatedText + ' [Versione formale]'
    );

    const translation: ContextTranslation = {
      id: `ctx-translation-${Date.now()}`,
      originalText: text,
      translatedText: finalTranslation,
      sourceLanguage: 'en',
      targetLanguage,
      context: translationContext,
      gameContext,
      confidence: 85 + Math.random() * 10,
      alternatives: alternatives.slice(0, 3),
      timestamp: new Date()
    };

    setIsTranslating(false);
    return translation;
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      toast.error('Inserisci del testo da tradurre');
      return;
    }

    try {
      const translation = await performContextTranslation(inputText);
      setTranslatedText(translation.translatedText);
      setTranslations(prev => [translation, ...prev]);
      onTranslationComplete(translation);
      toast.success('Traduzione contestuale completata');
    } catch (error) {
      console.error('Errore traduzione:', error);
      toast.error('Errore nella traduzione');
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Testo copiato');
  };

  const exportTranslations = () => {
    const data = JSON.stringify(translations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traduzioni-${gameContext.gameTitle}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Traduzione Contestuale
          </h2>
          <p className="text-muted-foreground">
            Traduzioni intelligenti basate sul contesto di gioco
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportTranslations}>
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurazione Contesto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Contesto di Gioco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Titolo Gioco</Label>
              <input
                type="text"
                value={gameContext.gameTitle}
                onChange={(e) => setGameContext(prev => ({ ...prev, gameTitle: e.target.value }))}
                className="w-full p-2 border rounded"
              />
            </div>

            <div className="space-y-2">
              <Label>Genere</Label>
              <Select 
                value={gameContext.genre} 
                onValueChange={(value) => setGameContext(prev => ({ ...prev, genre: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gameGenres.map(genre => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ambientazione</Label>
              <input
                type="text"
                value={gameContext.setting}
                onChange={(e) => setGameContext(prev => ({ ...prev, setting: e.target.value }))}
                className="w-full p-2 border rounded"
                placeholder="es. fantasy medievale, sci-fi futuristico"
              />
            </div>
          </CardContent>
        </Card>

        {/* Configurazione Traduzione */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Contesto Traduzione
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo di Testo</Label>
              <Select 
                value={translationContext.textType} 
                onValueChange={(value: any) => setTranslationContext(prev => ({ ...prev, textType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {textTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tono Emotivo</Label>
              <Select 
                value={translationContext.emotionalTone || ''} 
                onValueChange={(value) => setTranslationContext(prev => ({ ...prev, emotionalTone: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tono" />
                </SelectTrigger>
                <SelectContent>
                  {emotionalTones.map(tone => (
                    <SelectItem key={tone} value={tone}>{tone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Formalità</Label>
              <Select 
                value={translationContext.formality || 'neutral'} 
                onValueChange={(value: any) => setTranslationContext(prev => ({ ...prev, formality: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formale</SelectItem>
                  <SelectItem value="neutral">Neutrale</SelectItem>
                  <SelectItem value="informal">Informale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traduttore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Traduttore Contestuale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Testo da Tradurre</Label>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Inserisci il testo da tradurre..."
              className="min-h-[100px]"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={handleTranslate}
              disabled={isTranslating || !inputText.trim()}
              className="flex-1"
            >
              {isTranslating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Traduzione in corso...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Traduci con Contesto
                </>
              )}
            </Button>

            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                <SelectItem value="en">🇺🇸 Inglese</SelectItem>
                <SelectItem value="es">🇪🇸 Spagnolo</SelectItem>
                <SelectItem value="fr">🇫🇷 Francese</SelectItem>
                <SelectItem value="de">🇩🇪 Tedesco</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {translatedText && (
            <div className="space-y-2">
              <Label>Traduzione Contestuale</Label>
              <div className="relative">
                <Textarea
                  value={translatedText}
                  readOnly
                  className="min-h-[100px] font-medium"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyText(translatedText)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impostazioni */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Impostazioni Avanzate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label>Usa Terminologia di Gioco</Label>
              <Switch
                checked={settings.useGameTerminology}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, useGameTerminology: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Preserva Formattazione</Label>
              <Switch
                checked={settings.preserveFormatting}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, preserveFormatting: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Adatta Riferimenti Culturali</Label>
              <Switch
                checked={settings.adaptCulturalReferences}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, adaptCulturalReferences: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Mantieni Tono</Label>
              <Switch
                checked={settings.maintainTone}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, maintainTone: checked }))}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sensibilità Contesto: {settings.contextSensitivity}%</Label>
              <Slider
                value={[settings.contextSensitivity]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, contextSensitivity: value }))}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Livello Creatività: {settings.creativityLevel}%</Label>
              <Slider
                value={[settings.creativityLevel]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, creativityLevel: value }))}
                max={100}
                step={5}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cronologia Traduzioni */}
      <Card>
        <CardHeader>
          <CardTitle>Cronologia Traduzioni ({translations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {translations.map((translation) => (
              <div key={translation.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {textTypes.find(t => t.value === translation.context.textType)?.icon}{' '}
                      {textTypes.find(t => t.value === translation.context.textType)?.label}
                    </Badge>
                    <Badge variant="secondary">
                      {translation.confidence.toFixed(1)}% confidenza
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {translation.timestamp.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Originale</Label>
                    <p className="text-sm bg-muted p-2 rounded">{translation.originalText}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Traduzione</Label>
                    <p className="text-sm bg-primary/10 p-2 rounded font-medium">{translation.translatedText}</p>
                  </div>
                </div>

                {translation.alternatives.length > 0 && (
                  <div>
                    <Label className="text-xs">Alternative</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {translation.alternatives.map((alt, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs cursor-pointer" onClick={() => copyText(alt)}>
                          {alt.length > 30 ? alt.substring(0, 30) + '...' : alt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContextAwareTranslation;
