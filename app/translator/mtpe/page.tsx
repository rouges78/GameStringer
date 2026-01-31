'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Play, FileText, Download, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { MTPEWorkflow } from '@/components/translator/mtpe-workflow';
import { useTranslation } from '@/lib/i18n';

type Phase = 'input' | 'translate' | 'review' | 'complete';

export default function MTPEPage() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('input');
  const [sourceTexts, setSourceTexts] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('it');
  const [provider, setProvider] = useState('gemini');
  const [translations, setTranslations] = useState<Array<{ source: string; translation: string }>>([]);
  const [results, setResults] = useState<any[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartTranslation = async () => {
    const lines = sourceTexts.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    setIsTranslating(true);
    setPhase('translate');
    setProgress(0);

    const translated: Array<{ source: string; translation: string }> = [];

    // Traduci in batch
    try {
      const response = await fetch('/api/translate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: lines,
          targetLanguage: targetLang,
          sourceLanguage: sourceLang,
          provider
        })
      });

      if (response.ok) {
        const data = await response.json();
        for (const t of data.translations) {
          translated.push({
            source: t.original,
            translation: t.translated
          });
        }
      } else {
        // Fallback: traduci singolarmente
        for (let i = 0; i < lines.length; i++) {
          try {
            const res = await fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: lines[i],
                targetLanguage: targetLang,
                sourceLanguage: sourceLang,
                provider
              })
            });
            
            if (res.ok) {
              const data = await res.json();
              translated.push({
                source: lines[i],
                translation: data.translatedText
              });
            } else {
              translated.push({
                source: lines[i],
                translation: lines[i]
              });
            }
          } catch {
            translated.push({
              source: lines[i],
              translation: lines[i]
            });
          }
          setProgress(Math.round(((i + 1) / lines.length) * 100));
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
    }

    setTranslations(translated);
    setIsTranslating(false);
    setPhase('review');
  };

  const handleComplete = (reviewedItems: any[]) => {
    setResults(reviewedItems);
    setPhase('complete');
  };

  const handleExport = () => {
    const approved = results.filter(r => r.status === 'approved' || r.status === 'edited');
    const content = approved.map(r => 
      `${r.source}\t${r.editedTranslation || r.machineTranslation}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtpe_export_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setPhase('input');
    setSourceTexts('');
    setTranslations([]);
    setResults([]);
    setProgress(0);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-700 via-blue-600 to-cyan-700 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center gap-3">
          <Link href="/translator/pro">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              MTPE Workflow
            </h1>
            <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              Machine Translation Post-Editing
            </p>
          </div>
        </div>
      </div>

        {/* Phase: Input */}
        {phase === 'input' && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                1. Inserisci testi da tradurre
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Lingua origine</label>
                  <Select value={sourceLang} onValueChange={setSourceLang}>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                      <SelectItem value="zh">🇨🇳 中文</SelectItem>
                      <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                      <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Lingua destinazione</label>
                  <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                      <SelectItem value="pt">🇵🇹 Português</SelectItem>
                      <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Provider AI</label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Gemini 2.0</SelectItem>
                      <SelectItem value="claude">Claude Sonnet</SelectItem>
                      <SelectItem value="openai">GPT-4o</SelectItem>
                      <SelectItem value="deepl">DeepL</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="google">Google Translate</SelectItem>
                      <SelectItem value="libre">LibreTranslate (Free)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea
                value={sourceTexts}
                onChange={(e) => setSourceTexts(e.target.value)}
                className="min-h-[300px] bg-slate-800/50 border-slate-600 font-mono text-sm"
                placeholder="Inserisci un testo per riga...&#10;&#10;Hello, adventurer!&#10;Welcome to our world.&#10;Choose your destiny..."
              />

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {sourceTexts.split('\n').filter(l => l.trim()).length} righe
                </span>
                <Button 
                  onClick={handleStartTranslation}
                  disabled={!sourceTexts.trim()}
                  className="bg-sky-600 hover:bg-sky-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Avvia traduzione AI
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase: Translate */}
        {phase === 'translate' && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-8 text-center">
              <Sparkles className="h-12 w-12 text-sky-400 mx-auto mb-4 animate-pulse" />
              <h2 className="text-xl font-medium mb-2">Traduzione in corso...</h2>
              <p className="text-gray-400 mb-4">
                Provider: {provider.toUpperCase()}
              </p>
              <div className="w-64 mx-auto">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">{progress}%</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase: Review (MTPE) */}
        {phase === 'review' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">2. Revisiona traduzioni</h2>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Ricomincia
              </Button>
            </div>
            <MTPEWorkflow
              translations={translations}
              sourceLang={sourceLang}
              targetLang={targetLang}
              onComplete={handleComplete}
            />
          </div>
        )}

        {/* Phase: Complete */}
        {phase === 'complete' && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="p-8 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-medium mb-2">Workflow completato!</h2>
              <p className="text-gray-400 mb-4">
                {results.filter(r => r.status === 'approved').length} approvate,{' '}
                {results.filter(r => r.status === 'edited').length} modificate,{' '}
                {results.filter(r => r.status === 'rejected').length} rifiutate
              </p>
              
              <div className="flex gap-3 justify-center">
                <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700">
                  <Download className="h-4 w-4 mr-2" />
                  Esporta TSV
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Nuovo workflow
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                Le traduzioni approvate/modificate sono state salvate nella Translation Memory
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
