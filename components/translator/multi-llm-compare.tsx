'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Sparkles, 
  Zap, 
  Clock, 
  Trophy, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Users,
  Brain
} from 'lucide-react';
import { CHARACTER_PRESETS, type CharacterProfile, getQualityCategory } from '@/lib/translation-quality';
import { useTranslation } from '@/lib/i18n';

interface TranslationResult {
  provider: string;
  translatedText: string;
  confidence: number;
  suggestions: string[];
  qualityScore: {
    overall: number;
    fluency: number;
    accuracy: number;
    consistency: number;
    style: number;
    lengthRatio: number;
    details: string[];
  };
  latencyMs: number;
  error?: string;
}

interface CompareResponse {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  results: TranslationResult[];
  bestResult: TranslationResult | null;
  consensusTranslation: string | null;
  processingTimeMs: number;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🤖', color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400', activeColor: 'bg-emerald-500 text-white' },
  { id: 'gemini', name: 'Gemini', icon: '✨', color: 'bg-blue-500/20 border-blue-500/50 text-blue-400', activeColor: 'bg-blue-500 text-white' },
  { id: 'claude', name: 'Claude', icon: '🧠', color: 'bg-purple-500/20 border-purple-500/50 text-purple-400', activeColor: 'bg-purple-500 text-white' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🔍', color: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400', activeColor: 'bg-cyan-500 text-white' },
  { id: 'mistral', name: 'Mistral', icon: '🌊', color: 'bg-orange-500/20 border-orange-500/50 text-orange-400', activeColor: 'bg-orange-500 text-white' },
  { id: 'deepl', name: 'DeepL', icon: '📝', color: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400', activeColor: 'bg-indigo-500 text-white' },
  { id: 'libre', name: 'Libre', icon: '🆓', color: 'bg-slate-500/20 border-slate-500/50 text-slate-400', activeColor: 'bg-slate-500 text-white' }
];

const LANGUAGES = [
  { code: 'it', name: 'Italiano 🇮🇹' },
  { code: 'en', name: 'English 🇬🇧' },
  { code: 'de', name: 'Deutsch 🇩🇪' },
  { code: 'es', name: 'Español 🇪🇸' },
  { code: 'fr', name: 'Français 🇫🇷' },
  { code: 'ja', name: '日本語 🇯🇵' },
  { code: 'ko', name: '한국어 🇰🇷' },
  { code: 'zh', name: '中文 🇨🇳' },
  { code: 'pt', name: 'Português 🇵🇹' },
  { code: 'ru', name: 'Русский 🇷🇺' }
];

export function MultiLLMCompare() {
  const { t } = useTranslation();
  const [sourceText, setSourceText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('it');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['openai', 'gemini', 'claude']);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('none');
  const [customCharacter, setCustomCharacter] = useState<Partial<CharacterProfile>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<CompareResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders(prev => 
      prev.includes(providerId)
        ? prev.filter(p => p !== providerId)
        : [...prev, providerId]
    );
  };

  const handleCompare = async () => {
    if (!sourceText.trim() || selectedProviders.length === 0) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const characterProfile = selectedCharacter && selectedCharacter !== 'none' && CHARACTER_PRESETS[selectedCharacter]
        ? {
            id: selectedCharacter,
            name: selectedCharacter,
            ...CHARACTER_PRESETS[selectedCharacter]
          }
        : undefined;

      const res = await fetch('/api/translate/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          targetLanguage,
          sourceLanguage,
          providers: selectedProviders,
          characterProfile
        })
      });

      if (!res.ok) throw new Error('Compare request failed');

      const data: CompareResponse = await res.json();
      setResponse(data);
    } catch (error) {
      console.error('Compare error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getProviderInfo = (providerId: string) => {
    return PROVIDERS.find(p => p.id === providerId) || { id: providerId, name: providerId, icon: '❓', color: 'bg-slate-500/20 border-slate-500/50 text-slate-400', activeColor: 'bg-slate-500 text-white' };
  };

  return (
    <div className="space-y-3">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{t('multiLlmCompare.title')}</h2>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('multiLlmCompare.subtitle')}</p>
            </div>
          </div>
          
          {/* Stats inline */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">{PROVIDERS.length}</span>
              <span className="text-[10px] text-white/80">{t('multiLlmCompare.providers')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Input Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Source Text */}
        <Card className="md:col-span-2 bg-slate-900/50 border-slate-700/50">
          <CardHeader className="py-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">→</span>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={t('multiLlmCompare.enterText')}
              className="min-h-[80px] resize-none text-sm bg-slate-800/50 border-slate-700/50"
            />
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="py-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t('multiLlmCompare.providerAI')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {/* Provider Selection */}
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderToggle(provider.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-xs font-medium border
                    ${selectedProviders.includes(provider.id)
                      ? provider.activeColor
                      : provider.color + ' hover:opacity-80'
                    }`}
                >
                  <span>{provider.icon}</span>
                  <span>{provider.name}</span>
                </button>
              ))}
            </div>

            {/* Compare Button */}
            <Button
              onClick={handleCompare}
              disabled={isLoading || !sourceText.trim() || selectedProviders.length === 0}
              size="sm"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {isLoading ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t('multiLlmCompare.comparing')}</>
              ) : (
                <><Sparkles className="h-3 w-3 mr-1" />{t('multiLlmCompare.compare')} ({selectedProviders.length})</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {response && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-2 border-green-500/30 bg-green-500/5 bg-slate-900/50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">{t('multiLlmCompare.bestResult')}</span>
                    {response.bestResult && (
                      <Badge className={getProviderInfo(response.bestResult.provider).activeColor}>
                        {getProviderInfo(response.bestResult.provider).icon} {getProviderInfo(response.bestResult.provider).name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {response.processingTimeMs}ms {t('multiLlmCompare.total')}
                  </div>
                </div>
                {response.consensusTranslation && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 font-medium">{t('multiLlmCompare.consensusFound')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Individual Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {response.results.map((result, index) => {
              const providerInfo = getProviderInfo(result.provider);
              const qualityCategory = getQualityCategory(result.qualityScore.overall);
              const isBest = response.bestResult?.provider === result.provider;

              return (
                <Card 
                  key={result.provider}
                  className={`relative overflow-hidden transition-all hover:shadow-lg bg-slate-900/50 border-slate-700/50 ${
                    isBest ? 'ring-2 ring-yellow-500 shadow-yellow-500/20' : ''
                  } ${result.error ? 'opacity-60' : ''}`}
                >
                  {isBest && (
                    <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-bl">
                      🏆 BEST
                    </div>
                  )}
                  
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className={providerInfo.activeColor}>{providerInfo.icon} {providerInfo.name}</Badge>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Zap className="h-3 w-3" />
                        {result.latencyMs}ms
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {result.error ? (
                      <div className="flex items-center gap-2 text-red-500 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        {result.error}
                      </div>
                    ) : (
                      <>
                        {/* Translation */}
                        <div className="relative group">
                          <p className="text-sm leading-relaxed pr-8">
                            {result.translatedText}
                          </p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(result.translatedText, result.provider)}
                          >
                            {copiedId === result.provider ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>

                        {/* Quality Score */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{t('multiLlmCompare.qualityScore')}</span>
                            <span className={`font-bold ${qualityCategory.color}`}>
                              {result.qualityScore.overall}/100 - {qualityCategory.label}
                            </span>
                          </div>
                          <Progress 
                            value={result.qualityScore.overall} 
                            className="h-2"
                          />
                          
                          {/* Detailed Scores */}
                          <div className="grid grid-cols-4 gap-1 text-xs">
                            <div className="text-center">
                              <div className="text-muted-foreground">{t('multiLlmCompare.fluency')}</div>
                              <div className="font-medium">{result.qualityScore.fluency}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">{t('multiLlmCompare.accuracy')}</div>
                              <div className="font-medium">{result.qualityScore.accuracy}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">{t('multiLlmCompare.consistency')}</div>
                              <div className="font-medium">{result.qualityScore.consistency}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">{t('multiLlmCompare.style')}</div>
                              <div className="font-medium">{result.qualityScore.style}</div>
                            </div>
                          </div>

                          {/* Details */}
                          {result.qualityScore.details.length > 0 && (
                            <div className="text-xs space-y-0.5 mt-2 pt-2 border-t">
                              {result.qualityScore.details.slice(0, 3).map((detail, i) => (
                                <div key={i} className="text-muted-foreground">{detail}</div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Suggestions */}
                        {result.suggestions.length > 0 && (
                          <div className="text-xs">
                            <p className="text-muted-foreground mb-1">{t('multiLlmCompare.alternative')}</p>
                            <div className="space-y-1">
                              {result.suggestions.slice(0, 2).map((sugg, i) => (
                                <p key={i} className="text-muted-foreground italic truncate">
                                  {i + 1}. {sugg}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



