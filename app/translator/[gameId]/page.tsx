'use client';

import { useState, useEffect } from 'react';
import type { Game } from '@prisma/client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileText, Languages, Save, Wand2, Gamepad2, AlertTriangle } from 'lucide-react';

interface ExtractedString {
  file: string;
  string: string;
}

interface TranslationResult {
  translatedText: string;
  confidence: number;
  suggestions: string[];
}

interface AiConfig {
  provider: string;
  apiKey: string;
}

export default function TranslatorPage({ params }: { params: { gameId: string } }) {
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedStrings, setExtractedStrings] = useState<ExtractedString[]>([]);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const [selectedStringIndex, setSelectedStringIndex] = useState<number | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [editedTranslation, setEditedTranslation] = useState<string>('');

  useEffect(() => {
    const fetchGameAndConfig = async () => {
      setIsLoading(true);
      try {
        // Carica la configurazione AI
        const configResponse = await fetch('/api/ai/config');
        if (!configResponse.ok) {
          const errorData = await configResponse.json();
          throw new Error(errorData.error || 'Errore nel caricamento della configurazione AI.');
        }
        const config = await configResponse.json();
        setAiConfig(config);

        // Carica i dati del gioco
        const gameResponse = await fetch(`/api/games/${params.gameId}`);
        if (gameResponse.status === 404) notFound();
        if (!gameResponse.ok) throw new Error('Errore nel caricamento dei dati del gioco.');
        const gameData = await gameResponse.json();
        setGame(gameData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto.');
      } finally {
        setIsLoading(false);
      }
    };
    if (params.gameId) fetchGameAndConfig();
  }, [params.gameId]);

  const handleSelectString = (index: number) => {
    setSelectedStringIndex(index);
    setTranslationResult(null);
    setTranslationError(null);
    setEditedTranslation('');
  }

  const handleExtractStrings = async () => {
    setIsExtracting(true);
    setExtractionError(null);
    setExtractedStrings([]);
    setSelectedStringIndex(null);
    try {
      const response = await fetch(`/api/games/${params.gameId}/extract`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore durante l-estrazione.');
      }
      const data = await response.json();
      setExtractedStrings(data.strings);
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : 'Errore sconosciuto.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleTranslate = async () => {
    if (selectedStringIndex === null || !aiConfig) {
        if (!aiConfig) setTranslationError('La configurazione AI non è disponibile. Impossibile tradurre.');
        return;
    }
    setIsTranslating(true);
    setTranslationError(null);
    setTranslationResult(null);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedStrings[selectedStringIndex].string,
          targetLanguage: 'it',
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore API traduzione.');
      }
      const data = await response.json();
      setTranslationResult(data);
      setEditedTranslation(data.translatedText);
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : 'Errore sconosciuto.');
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    if (translationResult) {
        setEditedTranslation(translationResult.translatedText);
    }
  }, [translationResult]);

  if (isLoading) return <div className="flex items-center justify-center h-[calc(100vh-8rem)]"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  if (error) return <div className="flex items-center justify-center h-[calc(100vh-8rem)] text-destructive"><p>{error}</p></div>;
  if (!game) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
        <div className="relative w-48 h-27 flex-shrink-0 rounded-lg overflow-hidden border aspect-[16/9]">
          {game.imageUrl ? <Image src={game.imageUrl} alt={`Copertina di ${game.title}`} fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-muted"><Gamepad2 className="w-12 h-12 text-muted-foreground/50" /></div>}
        </div>
        <div>
          <h1 className="text-4xl font-bold">{game.title}</h1>
          <p className="text-muted-foreground mt-1">{game.platform}</p>
        </div>
      </div>

      {aiConfigError && <div className="text-destructive text-sm p-3 mb-4 bg-destructive/10 rounded-md flex items-center"><AlertTriangle className="h-4 w-4 mr-2"/>{aiConfigError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5" /> Testo Originale</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExtractStrings} disabled={isExtracting}>{isExtracting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Estrazione...</> : <><FileText className="mr-2 h-4 w-4" />Estrai Stringhe</>}</Button>
          </CardHeader>
          <CardContent>
            {extractionError && <div className="text-destructive text-sm p-3 mb-4 bg-destructive/10 rounded-md flex items-center"><AlertTriangle className="h-4 w-4 mr-2"/>{extractionError}</div>}
            <div className="h-[400px] overflow-y-auto rounded-md border bg-background/50 p-2 font-mono text-xs space-y-2">
              {extractedStrings.length > 0 ? extractedStrings.map((s, index) => (
                <div key={index} onClick={() => handleSelectString(index)} className={`p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${selectedStringIndex === index ? 'bg-muted ring-2 ring-primary' : ''}`}>
                  <p className="text-muted-foreground text-[10px] break-all select-none">{s.file}</p>
                  <p className="break-all">{s.string}</p>
                </div>
              )) : <div className="flex items-center justify-center h-full text-muted-foreground"><p>Le stringhe estratte appariranno qui...</p></div>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center"><Languages className="mr-2 h-5 w-5" /> Testo Tradotto</CardTitle>
            <Button size="sm" onClick={handleTranslate} disabled={selectedStringIndex === null || isTranslating || !aiConfig}>{isTranslating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traduco...</> : <><Wand2 className="mr-2 h-4 w-4" />Traduci con AI</>}</Button>
          </CardHeader>
          <CardContent>
            {translationError && <div className="text-destructive text-sm p-3 mb-4 bg-destructive/10 rounded-md flex items-center"><AlertTriangle className="h-4 w-4 mr-2"/>{translationError}</div>}
            <Textarea placeholder="La traduzione apparirà qui..." rows={8} className="bg-background/50" value={editedTranslation} onChange={(e) => setEditedTranslation(e.target.value)} disabled={!translationResult} />
            {isTranslating && <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}
            {translationResult && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Affidabilità:</span>
                  <div className="flex items-center gap-2">
                    <Progress value={translationResult.confidence * 100} className="w-24 h-2" />
                    <span>{(translationResult.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Suggerimenti:</p>
                  {translationResult.suggestions.slice(1).map((s, i) => (
                    <Button key={i} variant="outline" size="sm" className="w-full text-left justify-start h-auto py-1.5 leading-snug" onClick={() => setEditedTranslation(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-end">
        <Button size="lg" disabled={extractedStrings.length === 0}><Save className="mr-2 h-5 w-5" /> Salva e Crea Patch</Button>
      </div>
    </div>
  );
}
