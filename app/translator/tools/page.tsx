'use client';

import { useState } from 'react';
import { Brain, Type, Volume2, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { SmartContextPanel } from '@/components/translator/smart-context-panel';
import { PixelFontPreview } from '@/components/translator/pixel-font-preview';
import { TTSPreview } from '@/components/translator/tts-preview';
import { useTranslation } from '@/lib/i18n';

export default function TranslatorToolsPage() {
  const { t } = useTranslation();
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [selectedGame, setSelectedGame] = useState<{ id: string; name: string } | null>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  // Demo game per Smart Context
  const demoGame = { id: 'demo-game', name: 'Demo Game' };

  return (
    <div className="space-y-2 p-3">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 animate-shimmer p-3 shadow-xl shadow-blue-900/50">
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
              Translator Tools
            </h1>
            <p className="text-white/70 text-2xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              Smart Context • Pixel Font Preview • Text-to-Speech
            </p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">{t('qaCheck.originalText')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Textarea
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder={t('qaCheck.enterOriginal')}
              className="bg-muted/50 border-border min-h-[80px] text-sm"
            />
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Testo Tradotto</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Textarea
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              placeholder={t('qaCheck.enterTranslation')}
              className="bg-muted/50 border-border min-h-[80px] text-sm"
            />
          </CardContent>
        </Card>
      </div>

      {/* Tools Tabs */}
      <Tabs defaultValue="smart-context" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <TabsTrigger value="smart-context" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Smart Context
          </TabsTrigger>
          <TabsTrigger value="pixel-font" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Pixel Font
          </TabsTrigger>
          <TabsTrigger value="tts" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            TTS Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smart-context" className="mt-2">
          <SmartContextPanel 
            gameId={demoGame.id} 
            gameName={demoGame.name}
          />
        </TabsContent>

        <TabsContent value="pixel-font" className="mt-2">
          <PixelFontPreview 
            text={translatedText}
            originalText={originalText}
            onOverflow={setIsOverflow}
          />
        </TabsContent>

        <TabsContent value="tts" className="mt-2">
          <TTSPreview 
            text={translatedText || originalText}
            language="it-IT"
          />
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <div className="flex gap-2 justify-center pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOriginalText("Hello, adventurer! Welcome to our world. Choose your destiny wisely, for the path you take will shape the future of this realm.");
            setTranslatedText("Salve, avventuriero! Benvenuto nel nostro mondo. Scegli il tuo destino con saggezza, perché il sentiero che intraprenderai plasmerà il futuro di questo reame.");
          }}
        >
          Carica Esempio RPG
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOriginalText("GAME OVER\nInsert coin to continue\n10... 9... 8...");
            setTranslatedText("FINE PARTITA\nInserisci moneta per continuare\n10... 9... 8...");
          }}
        >
          Carica Esempio Arcade
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOriginalText("Commander, our forces are ready. Shall we proceed with the assault?");
            setTranslatedText("Comandante, le nostre forze sono pronte. Procediamo con l'assalto?");
          }}
        >
          Carica Esempio Strategico
        </Button>
      </div>
    </div>
  );
}
