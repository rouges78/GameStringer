'use client';

import { useState, useEffect } from 'react';
import { 
  Cpu, 
  Cloud, 
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  BookOpen,
  Gamepad2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  { value: 'rpg', label: 'RPG' },
  { value: 'action', label: 'Action' },
  { value: 'horror', label: 'Horror' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'visual_novel', label: 'Visual Novel' },
];

const textTypes = [
  { value: 'dialogue', label: 'Dialogue', icon: '💬' },
  { value: 'ui', label: 'UI', icon: '🖥️' },
  { value: 'item', label: 'Item', icon: '🎒' },
  { value: 'quest', label: 'Quest', icon: '📜' },
  { value: 'lore', label: 'Lore', icon: '📚' },
];

const tones = [
  { value: 'serious', label: 'Serious' },
  { value: 'comedic', label: 'Comedic' },
  { value: 'dark', label: 'Dark' },
  { value: 'epic', label: 'Epic' },
];

export function AITranslationAssistant() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('ollama');
  const [selectedModel, setSelectedModel] = useState<string>('translategemma');
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
  
  const [showContext, setShowContext] = useState(false); // Collapsed di default
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
    <div className="space-y-3">
      {/* Top Bar: Provider + Model */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-800/30 border border-slate-700/50">
        {providers.map(provider => (
          <button
            key={provider.id}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              selectedProvider === provider.id 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            } ${!provider.isAvailable && provider.type === 'local' ? 'opacity-40' : ''}`}
            onClick={() => {
              if (provider.isAvailable || provider.type === 'cloud') {
                setSelectedProvider(provider.id);
                if (provider.models.length > 0) setSelectedModel(provider.models[0]);
              }
            }}
          >
            {provider.type === 'local' ? <Cpu className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
            {provider.name}
            <span className={`w-1.5 h-1.5 rounded-full ${provider.isAvailable ? 'bg-green-400' : 'bg-slate-500'}`} />
          </button>
        ))}
        
        {providers.find(p => p.id === selectedProvider)?.models.length! > 0 && (
          <>
            <div className="h-4 w-px bg-slate-600 mx-1" />
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-7 w-32 text-xs bg-slate-700/50 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.find(p => p.id === selectedProvider)?.models.map(model => (
                  <SelectItem key={model} value={model} className="text-xs">{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Ollama Warning */}
      {!localProviderAvailable && !isCheckingProviders && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-xs">
          <AlertCircle className="h-3 w-3 text-yellow-500" />
          <span className="text-yellow-300">
            Ollama non rilevato. <a href="https://ollama.ai" target="_blank" className="underline">ollama.ai</a> → <code className="bg-slate-800 px-1 rounded text-[10px]">ollama run translategemma</code>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Main Panel */}
        <div className="lg:col-span-8 space-y-3">
          {/* Languages + Type Row */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇺🇸 English</SelectItem>
                  <SelectItem value="ja">🇯🇵 Japanese</SelectItem>
                  <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                  <SelectItem value="ko">🇰🇷 Korean</SelectItem>
                  <SelectItem value="de">🇩🇪 German</SelectItem>
                  <SelectItem value="fr">🇫🇷 French</SelectItem>
                  <SelectItem value="es">🇪🇸 Spanish</SelectItem>
                </SelectContent>
              </Select>
              <ArrowRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="h-9 flex-1">
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
            
            {/* Type + Character */}
            <Select value={textType} onValueChange={setTextType}>
              <SelectTrigger className="h-9 w-32">
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
            
            <Input
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              placeholder={t('aiTranslation.characterPlaceholder') || 'Personaggio'}
              className="h-9 w-40"
            />
          </div>

          {/* Text Input */}
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('aiTranslation.enterText') || 'Inserisci il testo da tradurre...'}
            className="min-h-[100px] resize-none"
          />

          {/* Actions Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={generateAlternatives}
                onCheckedChange={setGenerateAlternatives}
                className="scale-90"
              />
              <Label className="text-xs text-slate-400">{t('aiTranslation.alternative') || 'Alternative'}</Label>
            </div>
            <Button 
              onClick={handleTranslate} 
              disabled={isTranslating || !inputText.trim()}
              size="sm"
              className="bg-blue-600 hover:bg-blue-500"
            >
              {isTranslating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Traduzione...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Traduci
                </>
              )}
            </Button>
          </div>

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
              <CardContent className="space-y-3 px-3 pb-3">
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

        {/* Context Panel - Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          <Collapsible open={showContext} onOpenChange={setShowContext}>
            <Card className="border-slate-700/50">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium">{t('aiTranslation.gameContext')}</span>
                  </div>
                  {showContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
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
                            {g.label}
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

          {/* Glossary - Compatto */}
          <Card className="border-slate-700/50">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/30">
              <BookOpen className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium">{t('aiTranslation.glossary')}</span>
            </div>
            <CardContent className="space-y-2 p-3">
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
                <Button size="icon" onClick={addGlossaryTerm} className="bg-blue-600 hover:bg-blue-500">
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



