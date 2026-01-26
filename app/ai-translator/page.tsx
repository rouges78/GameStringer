'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Brain, Scan, Image as ImageIcon, Database, Sparkles, Zap, Globe, Bot, Layers, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AITranslationAssistant } from '@/components/tools/ai-translation-assistant';
import { useTranslation, translations } from '@/lib/i18n';

export default function AITranslatorPage() {
  const searchParams = useSearchParams();
  const gameImage = searchParams.get('gameImage');
  const gameName = searchParams.get('gameName');
  
  const { language } = useTranslation();
  const ai = translations[language]?.aiTranslator || translations.it.aiTranslator;
  
  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Hero Header - Con immagine game fusa */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 p-3">
        {/* Immagine game fusa nello sfondo */}
        {gameImage && (
          <>
            <div className="absolute inset-0">
              <Image
                src={gameImage}
                alt={gameName || 'Game'}
                fill
                className="object-cover opacity-30"
                unoptimized
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-sky-600/80 via-blue-600/70 to-cyan-600/80" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-600/50 to-transparent" />
          </>
        )}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {gameName ? `${ai.title} • ${gameName}` : ai.title}
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {ai.subtitle}
              </p>
            </div>
          </div>
          
          {/* Stats inline */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Bot className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">Ollama</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Zap className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">{ai.free}</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="relative flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
          <span className="text-[10px] text-white/50 mr-2 self-center">{ai.more}</span>
          <Link href="/translator/pro">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Brain className="h-3 w-3" />
              {ai.neuralPro}
            </Button>
          </Link>
          <Link href="/ocr-translator">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Scan className="h-3 w-3" />
              OCR
            </Button>
          </Link>
          <Link href="/editor">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <ImageIcon className="h-3 w-3" />
              Visual
            </Button>
          </Link>
          <Link href="/memory">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Database className="h-3 w-3" />
              {ai.dictionary}
            </Button>
          </Link>
          <Link href="/batch-translation">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <Layers className="h-3 w-3" />
              Batch
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="outline" size="sm" className="gap-1.5 h-6 text-[10px] border-white/30 bg-white/10 hover:bg-white/20 text-white">
              <FolderOpen className="h-3 w-3" />
              {ai.projects}
            </Button>
          </Link>
        </div>
      </div>
      
      <AITranslationAssistant />
    </div>
  );
}



