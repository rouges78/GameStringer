'use client';

import React, { useState } from 'react';
import { useStreamingTranslation } from '@/hooks/use-streaming-translation';
import { StreamingTranslationBox } from '@/components/ui/streaming-text';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Languages, StopCircle } from 'lucide-react';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI GPT-4o-mini' },
  { value: 'gpt5', label: 'OpenAI GPT-4o' },
  { value: 'claude', label: 'Claude 3.5 Sonnet' },
  { value: 'gemini', label: 'Gemini 1.5 Flash' },
  { value: 'deepseek', label: 'DeepSeek Chat' },
];

const LANGUAGES = [
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'ja', label: '🇯🇵 日本語' },
  { value: 'zh', label: '🇨🇳 中文' },
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'pt', label: '🇧🇷 Português' },
  { value: 'ru', label: '🇷🇺 Русский' },
];

export default function StreamingTranslatorPage() {
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('it');
  const [sourceLang, setSourceLang] = useState('en');
  const [provider, setProvider] = useState('openai');
  const [context, setContext] = useState('');

  const {
    isStreaming,
    currentText,
    error,
    provider: activeProvider,
    translate,
    cancel,
    reset
  } = useStreamingTranslation();

  const handleTranslate = () => {
    if (!text.trim()) return;
    
    translate({
      text: text.trim(),
      targetLanguage: targetLang,
      sourceLanguage: sourceLang,
      provider,
      context: context.trim() || undefined
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Zap className="h-8 w-8 text-yellow-500" />
          Streaming Translator
        </h1>
        <p className="text-muted-foreground mt-2">
          Traduzioni in tempo reale con visualizzazione streaming
        </p>
      </div>

      <div className="grid gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Configurazione
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider & Languages */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Provider AI</label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block">Lingua Origine</label>
                <Select value={sourceLang} onValueChange={setSourceLang}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">🔍 Auto-detect</SelectItem>
                    {LANGUAGES.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block">Lingua Destinazione</label>
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Context */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Contesto (opzionale)
              </label>
              <Textarea
                placeholder="Es: Dialogo in un gioco horror, tono formale..."
                value={context}
                onChange={e => setContext(e.target.value)}
                className="h-16 resize-none"
              />
            </div>

            {/* Text Input */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Testo da tradurre</label>
              <Textarea
                placeholder="Inserisci il testo da tradurre..."
                value={text}
                onChange={e => setText(e.target.value)}
                className="h-32 resize-none font-mono text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                onClick={handleTranslate}
                disabled={!text.trim() || isStreaming}
                className="flex-1"
              >
                <Zap className="h-4 w-4 mr-2" />
                {isStreaming ? 'Traduzione in corso...' : 'Traduci in Streaming'}
              </Button>
              
              {isStreaming && (
                <Button variant="destructive" onClick={cancel}>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
              
              {(currentText || error) && !isStreaming && (
                <Button variant="outline" onClick={reset}>
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Output Section */}
        {(isStreaming || currentText || error) && (
          <StreamingTranslationBox
            originalText={text}
            translatedText={currentText}
            isStreaming={isStreaming}
            error={error}
            provider={activeProvider}
            onRetry={handleTranslate}
          />
        )}

        {/* Info */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Streaming LLM</strong>: La traduzione appare in tempo reale mentre l'AI genera il testo.
              Questo migliora l'esperienza utente mostrando i risultati immediatamente invece di aspettare il completamento.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
