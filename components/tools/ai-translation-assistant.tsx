'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, 
  Cpu, 
  Cloud, 
  Zap, 
  Settings2, 
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  BookOpen,
  MessageSquare,
  Gamepad2,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
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
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { 
  aiTranslationService, 
  type AIProvider, 
  type GameTranslationContext,
  type AITranslationResult 
} from '@/lib/ai-translation-service';

const genres = [
  { value: 'rpg', label: 'RPG', icon: '⚔️' },
  { value: 'action', label: 'Action', icon: '💥' },
  { value: 'horror', label: 'Horror', icon: '👻' },
  { value: 'adventure', label: 'Adventure', icon: '🗺️' },
  { value: 'strategy', label: 'Strategy', icon: '♟️' },
  { value: 'simulation', label: 'Simulation', icon: '🏗️' },
  { value: 'puzzle', label: 'Puzzle', icon: '🧩' },
  { value: 'visual_novel', label: 'Visual Novel', icon: '📖' },
];

const tones = [
  { value: 'serious', label: 'Serious' },
  { value: 'comedic', label: 'Comedic' },
  { value: 'dark', label: 'Dark' },
  { value: 'epic', label: 'Epic' },
  { value: 'casual', label: 'Casual' },
  { value: 'mysterious', label: 'Mysterious' },
];

const textTypes = [
  { value: 'dialogue', label: 'Dialogue', icon: '💬' },
  { value: 'ui', label: 'UI', icon: '🖥️' },
  { value: 'item', label: 'Item', icon: '🎒' },
  { value: 'quest', label: 'Quest', icon: '📜' },
  { value: 'lore', label: 'Lore', icon: '📚' },
  { value: 'system', label: 'System', icon: '⚙️' },
  { value: 'tutorial', label: 'Tutorial', icon: '📋' },
];

export function AITranslationAssistant() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('ollama');
  const [selectedModel, setSelectedModel] = useState<string>('llama3.2');
  const [isCheckingProviders, setIsCheckingProviders] = useState(true);
  
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [lastResult, setLastResult] = useState<AITranslationResult | null>(null);
  
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [textType, setTextType] = useState<string>('dialogue');
  const [speaker, setSpeaker] = useState('');
  const [maxLength, setMaxLength] = useState<number | undefined>(undefined);
  const [generateAlternatives, setGenerateAlternatives] = useState(false);
  
  const [showContext, setShowContext] = useState(false);
  const [gameContext, setGameContext] = useState<GameTranslationContext>({
    gameTitle: '',
    genre: 'rpg',
    setting: 'fantasy',
    tone: 'serious',
    era: 'medieval',
    targetAudience: 'all',
    glossary: {}
  });
  
  const [glossaryTerm, setGlossaryTerm] = useState('');
  const [glossaryTranslation, setGlossaryTranslation] = useState('');
  
  const [translationHistory, setTranslationHistory] = useState<Array<{
    source: string;
    translation: string;
    timestamp: Date;
    provider: string;
  }>>([]);

  useEffect(() => {
    checkProviders();
  }, []);

  const checkProviders = async () => {
    setIsCheckingProviders(true);
    try {
      const available = await aiTranslationService.getAvailableProviders();
      setProviders(available);
      
      const localProvider = available.find(p => p.type === 'local' && p.isAvailable);
      if (localProvider) {
        setSelectedProvider(localProvider.id);
        if (localProvider.models.length > 0) {
          setSelectedModel(localProvider.models[0]);
        }
      }
    } catch (error) {
      console.error('Error checking providers:', error);
    } finally {
      setIsCheckingProviders(false);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      toast.error('Enter text to translate');
      return;
    }

    const provider = providers.find(p => p.id === selectedProvider);
    if (!provider?.isAvailable && provider?.type === 'local') {
      toast.error(`${provider.name} is not available. Start it before translating.`);
      return;
    }

    setIsTranslating(true);
    setTranslatedText('');
    setAlternatives([]);

    try {
      aiTranslationService.setProvider(selectedProvider, selectedModel);
      
      const result = await aiTranslationService.translate({
        text: inputText,
        sourceLanguage,
        targetLanguage,
        context: gameContext.gameTitle ? gameContext : undefined,
        textType: textType as any,
        speaker: speaker || undefined,
        maxLength,
        alternatives: generateAlternatives ? 3 : undefined
      });

      setTranslatedText(result.translation);
      setAlternatives(result.alternatives);
      setLastResult(result);
      
      setTranslationHistory(prev => [{
        source: inputText,
        translation: result.translation,
        timestamp: new Date(),
        provider: `${result.provider}/${result.model}`
      }, ...prev].slice(0, 50));

      toast.success(`Translated in ${result.processingTime}ms`);
    } catch (error: any) {
      toast.error(error.message || 'Translation error');
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const addGlossaryTerm = () => {
    if (glossaryTerm && glossaryTranslation) {
      setGameContext(prev => ({
        ...prev,
        glossary: {
          ...prev.glossary,
          [glossaryTerm]: glossaryTranslation
        }
      }));
      setGlossaryTerm('');
      setGlossaryTranslation('');
      toast.success('Term added to glossary');
    }
  };

  const removeGlossaryTerm = (term: string) => {
    setGameContext(prev => {
      const newGlossary = { ...prev.glossary };
      delete newGlossary[term];
      return { ...prev, glossary: newGlossary };
    });
  };

  const localProviderAvailable = providers.some(p => p.type === 'local' && p.isAvailable);

  return (
    <div className="space-y-6">

      {/* Provider Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map(provider => (
          <Card 
            key={provider.id}
            className={`cursor-pointer transition-all ${
              selectedProvider === provider.id 
                ? 'ring-2 ring-primary' 
                : 'hover:border-primary/50'
            } ${!provider.isAvailable && provider.type === 'local' ? 'opacity-50' : ''}`}
            onClick={() => {
              if (provider.isAvailable || provider.type === 'cloud') {
                setSelectedProvider(provider.id);
                if (provider.models.length > 0) {
                  setSelectedModel(provider.models[0]);
                }
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {provider.type === 'local' ? (
                    <Cpu className="h-5 w-5 text-green-500" />
                  ) : (
                    <Cloud className="h-5 w-5 text-blue-500" />
                  )}
                  <span className="font-medium">{provider.name}</span>
                </div>
                <Badge variant={provider.isAvailable ? 'default' : 'secondary'}>
                  {provider.isAvailable ? t('aiTranslation.online') : t('aiTranslation.offline')}
                </Badge>
              </div>
              {provider.isAvailable && provider.models.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {provider.models.length} {t('aiTranslation.modelsAvailable')}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ollama Not Available Warning */}
      {!localProviderAvailable && !isCheckingProviders && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{t('aiTranslation.ollamaNotDetected')}</strong> {t('aiTranslation.ollamaInstallHint')}{' '}
            <a href="https://ollama.ai" target="_blank" rel="noopener" className="underline">
              ollama.ai
            </a>{' '}
            {t('aiTranslation.ollamaStartHint')} <code className="bg-muted px-1 rounded">ollama run llama3.2</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Translation Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Model Selection */}
          {providers.find(p => p.id === selectedProvider)?.models.length! > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Label className="whitespace-nowrap">{t('aiTranslation.model')}</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.find(p => p.id === selectedProvider)?.models.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Translation Input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('aiTranslation.textToTranslate')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('aiTranslation.sourceLanguage')}</Label>
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                      <SelectItem value="it">🇮🇹 Italian</SelectItem>
                      <SelectItem value="es">🇪🇸 Spanish</SelectItem>
                      <SelectItem value="fr">🇫🇷 French</SelectItem>
                      <SelectItem value="de">🇩🇪 German</SelectItem>
                      <SelectItem value="ja">🇯🇵 Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('aiTranslation.targetLanguage')}</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 Italian</SelectItem>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                      <SelectItem value="es">🇪🇸 Spanish</SelectItem>
                      <SelectItem value="fr">🇫🇷 French</SelectItem>
                      <SelectItem value="de">🇩🇪 German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('aiTranslation.textType')}</Label>
                  <Select value={textType} onValueChange={setTextType}>
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
                  <Label>{t('aiTranslation.character')}</Label>
                  <Input
                    value={speaker}
                    onChange={(e) => setSpeaker(e.target.value)}
                    placeholder={t('aiTranslation.characterPlaceholder')}
                  />
                </div>
              </div>

              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t('aiTranslation.enterText')}
                className="min-h-[120px]"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={generateAlternatives}
                      onCheckedChange={setGenerateAlternatives}
                    />
                    <Label className="text-sm">{t('aiTranslation.alternative')}</Label>
                  </div>
                </div>
                <Button 
                  onClick={handleTranslate} 
                  disabled={isTranslating || !inputText.trim()}
                  className="min-w-[140px]"
                >
                  {isTranslating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {t('aiTranslation.translating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {t('aiTranslation.translateWithAI')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Translation Result */}
          {translatedText && (
            <Card className="border-green-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    {t('aiTranslation.translation')}
                  </CardTitle>
                  {lastResult && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{lastResult.provider}/{lastResult.model}</Badge>
                      <span>{lastResult.processingTime}ms</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Textarea
                    value={translatedText}
                    readOnly
                    className="min-h-[100px] pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(translatedText)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                {alternatives.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">{t('aiTranslation.alternative')}:</Label>
                    <div className="space-y-2">
                      {alternatives.map((alt, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <span className="flex-1 text-sm">{alt}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(alt)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Context Panel */}
        <div className="space-y-4">
          <Collapsible open={showContext} onOpenChange={setShowContext}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Gamepad2 className="h-5 w-5" />
                      {t('aiTranslation.gameContext')}
                    </span>
                    {showContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                  <CardDescription>
                    {t('aiTranslation.gameContextDesc')}
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-2">
                    <Label>{t('aiTranslation.gameTitle')}</Label>
                    <Input
                      value={gameContext.gameTitle}
                      onChange={(e) => setGameContext(prev => ({ ...prev, gameTitle: e.target.value }))}
                      placeholder="e.g. The Witcher 3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('aiTranslation.genre')}</Label>
                    <Select 
                      value={gameContext.genre} 
                      onValueChange={(value: any) => setGameContext(prev => ({ ...prev, genre: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map(g => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.icon} {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('aiTranslation.tone')}</Label>
                    <Select 
                      value={gameContext.tone} 
                      onValueChange={(value: any) => setGameContext(prev => ({ ...prev, tone: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tones.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('aiTranslation.setting')}</Label>
                    <Input
                      value={gameContext.setting}
                      onChange={(e) => setGameContext(prev => ({ ...prev, setting: e.target.value }))}
                      placeholder="e.g. medieval fantasy"
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Glossary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {t('aiTranslation.glossary')}
              </CardTitle>
              <CardDescription>
                {t('aiTranslation.glossaryDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={glossaryTerm}
                  onChange={(e) => setGlossaryTerm(e.target.value)}
                  placeholder={t('aiTranslation.termPlaceholder')}
                  className="flex-1"
                />
                <Input
                  value={glossaryTranslation}
                  onChange={(e) => setGlossaryTranslation(e.target.value)}
                  placeholder={t('aiTranslation.translationPlaceholder')}
                  className="flex-1"
                />
                <Button size="icon" onClick={addGlossaryTerm}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>

              {Object.keys(gameContext.glossary || {}).length > 0 && (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {Object.entries(gameContext.glossary || {}).map(([term, translation]) => (
                    <div key={term} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                      <span><strong>{term}</strong> → {translation}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeGlossaryTerm(term)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          {translationHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Cronologia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {translationHistory.slice(0, 10).map((item, i) => (
                    <div 
                      key={i} 
                      className="p-2 bg-muted/50 rounded text-xs cursor-pointer hover:bg-muted"
                      onClick={() => {
                        setInputText(item.source);
                        setTranslatedText(item.translation);
                      }}
                    >
                      <p className="text-muted-foreground truncate">{item.source}</p>
                      <p className="font-medium truncate">{item.translation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default AITranslationAssistant;



