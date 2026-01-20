'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Github, 
  Heart, 
  Gamepad2, 
  Languages, 
  Sparkles, 
  Cpu,
  Brain,
  Mic,
  Subtitles,
  Users,
  Zap,
  Shield,
  Globe,
  Star,
  Coffee,
  ArrowRight,
  Check
} from 'lucide-react';

const FEATURES = [
  {
    icon: Languages,
    title: 'Traduzioni AI Multi-LLM',
    description: 'OpenAI, Claude, Gemini, DeepSeek, Mistral - confronta e scegli la migliore',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Gamepad2,
    title: 'Multi-Engine Support',
    description: 'Unity, Unreal, Godot, RPG Maker, Ren\'Py, GameMaker e altri',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Mic,
    title: 'Voice Translation',
    description: 'Audio → Trascrizione Whisper → Traduzione → Text-to-Speech',
    color: 'from-amber-500 to-yellow-500',
  },
  {
    icon: Brain,
    title: 'AI Context Crawler',
    description: 'Costruisce glossario automaticamente analizzando il gameplay',
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: Subtitles,
    title: 'Subtitle Overlay',
    description: 'Sottotitoli live per streaming e recording con export SRT/VTT',
    color: 'from-indigo-500 to-purple-500',
  },
  {
    icon: Users,
    title: 'Community Hub',
    description: 'Condividi Translation Memory con la community',
    color: 'from-orange-500 to-red-500',
  },
];

const STATS = [
  { value: '10+', label: 'Engine Supportati' },
  { value: '7+', label: 'Provider AI' },
  { value: '100%', label: 'Gratuito' },
  { value: '∞', label: 'Giochi Traducibili' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <header className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <img 
              src="/logo.png" 
              alt="GameStringer" 
              className="h-20 object-contain"
            />
          </div>
          
          <p className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto">
            La suite completa per tradurre videogiochi con AI
          </p>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Open source, gratuito, supporta qualsiasi engine. 
            Traduci giochi indie, retro e AAA con intelligenza artificiale.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-lg px-8">
              <Download className="mr-2 h-5 w-5" />
              Scarica Gratis
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              <Github className="mr-2 h-5 w-5" />
              GitHub
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-white mb-4">
          Tutto quello che serve per tradurre giochi
        </h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Un ecosistema completo di strumenti AI per localizzazione videogiochi
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <Card key={i} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Engines Supported */}
      <section className="bg-slate-800/30 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-white mb-8">
            Engine Supportati
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {['Unity', 'Unreal Engine', 'Godot', 'RPG Maker MV/MZ', 'RPG Maker VX Ace', 'GameMaker', "Ren'Py", 'Kirikiri', 'Wolf RPG', 'NScripter'].map((engine, i) => (
              <Badge key={i} variant="secondary" className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600">
                {engine}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          Come Funziona
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Seleziona il gioco', desc: 'Scegli dalla libreria Steam/Epic o aggiungi manualmente' },
            { step: '2', title: 'Configura la traduzione', desc: 'Scegli provider AI, lingua target e profilo personaggio' },
            { step: '3', title: 'Traduci e gioca', desc: 'Le traduzioni vengono iniettate automaticamente nel gioco' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <Card className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-purple-500/30">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Pronto a tradurre i tuoi giochi preferiti?
            </h2>
            <p className="text-slate-300 mb-6">
              Scarica GameStringer gratuitamente e inizia subito
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-white text-purple-900 hover:bg-slate-100">
                <Download className="mr-2 h-5 w-5" />
                Download per Windows
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                <Coffee className="mr-2 h-5 w-5" />
                Supporta il progetto
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GameStringer" className="h-8 object-contain" />
            </div>
            
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">Ko-fi</a>
              <a href="#" className="hover:text-white transition-colors">Discord</a>
            </div>
            
            <p className="text-sm text-slate-500">
              Made with <Heart className="inline h-4 w-4 text-pink-500" /> in Italy
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
