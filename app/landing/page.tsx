"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Gamepad2,
  Languages,
  Zap,
  Brain,
  Download,
  Github,
  Star,
  ArrowRight,
  Check,
  Sparkles,
  Globe,
  Users,
  Cpu,
  FileText,
  Wand2,
  ChevronRight,
  Play,
  Coffee
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Powered Translation",
    description: "Use Claude, GPT-4, Gemini, DeepSeek or local Ollama models for context-aware translations",
    color: "text-violet-500",
    bg: "bg-violet-500/10"
  },
  {
    icon: Gamepad2,
    title: "Multi-Engine Support",
    description: "Unity, Unreal, Godot, RPG Maker, Ren'Py, GameMaker and more - we detect and patch automatically",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10"
  },
  {
    icon: FileText,
    title: "10+ File Formats",
    description: "JSON, PO, RESX, CSV, SRT, VTT, ASS subtitles, XML, YAML and custom formats",
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    icon: Zap,
    title: "Batch Processing",
    description: "Translate entire folders with one click. Perfect for large localization projects",
    color: "text-amber-500",
    bg: "bg-amber-500/10"
  },
  {
    icon: Users,
    title: "Community Hub",
    description: "Share and download Translation Memories from the community. Save time, improve quality",
    color: "text-orange-500",
    bg: "bg-orange-500/10"
  },
  {
    icon: Wand2,
    title: "One-Click Patching",
    description: "Automatic BepInEx + XUnity AutoTranslator installation for Unity games",
    color: "text-pink-500",
    bg: "bg-pink-500/10"
  }
];

const SUPPORTED_ENGINES = [
  { name: "Unity", logo: "🎮" },
  { name: "Unreal", logo: "🔷" },
  { name: "Godot", logo: "🤖" },
  { name: "RPG Maker", logo: "⚔️" },
  { name: "Ren'Py", logo: "📖" },
  { name: "GameMaker", logo: "🎲" },
  { name: "Telltale", logo: "🐺" },
  { name: "NES/SNES", logo: "👾" },
];

const AI_PROVIDERS = [
  { name: "Claude", free: false },
  { name: "GPT-4", free: false },
  { name: "Gemini", free: true },
  { name: "DeepSeek", free: false },
  { name: "Ollama", free: true },
  { name: "MyMemory", free: true },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Languages className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">GameStringer</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-slate-300 hover:text-white transition">Features</a>
              <a href="#engines" className="text-sm text-slate-300 hover:text-white transition">Supported Engines</a>
              <a href="#pricing" className="text-sm text-slate-300 hover:text-white transition">Pricing</a>
              <a href="https://github.com/rouges78/GameStringer" target="_blank" className="text-sm text-slate-300 hover:text-white transition flex items-center gap-1">
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://ko-fi.com/gamestringer" target="_blank">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                  <Coffee className="w-4 h-4 mr-2" />
                  Support
                </Button>
              </a>
              <a href="https://github.com/rouges78/GameStringer/releases" target="_blank">
                <Button size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-[128px]" />
        </div>
        
        <div className="relative max-w-5xl mx-auto text-center">
          <Badge className="mb-6 bg-violet-500/20 text-violet-300 border-violet-500/30 px-4 py-1">
            <Sparkles className="w-3 h-3 mr-1" />
            v1.0 Now Available
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
            Translate Any Game
            <br />
            <span className="text-4xl md:text-6xl">With AI Power</span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            The ultimate desktop app for game localization. Use AI models like Claude, GPT-4, or free alternatives to translate games from any engine into any language.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <a href="https://github.com/rouges78/GameStringer/releases" target="_blank">
              <Button size="lg" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-lg px-8 h-14">
                <Download className="w-5 h-5 mr-2" />
                Download for Windows
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            <a href="https://github.com/rouges78/GameStringer" target="_blank">
              <Button size="lg" variant="outline" className="border-slate-700 hover:bg-slate-800 text-lg px-8 h-14">
                <Github className="w-5 h-5 mr-2" />
                View Source
              </Button>
            </a>
          </div>
          
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-white">8+</p>
              <p className="text-sm text-slate-400">Game Engines</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">20+</p>
              <p className="text-sm text-slate-400">Languages</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">6</p>
              <p className="text-sm text-slate-400">AI Providers</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">100%</p>
              <p className="text-sm text-slate-400">Free & Open Source</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From single file translation to batch processing entire projects, GameStringer handles it all.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-all hover:shadow-xl hover:shadow-violet-500/5">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Engines Section */}
      <section id="engines" className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-500/20 text-blue-300 border-blue-500/30">
              Compatibility
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Works With Any Engine</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Automatic detection and patching for the most popular game engines. Retro consoles too!
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {SUPPORTED_ENGINES.map((engine) => (
              <div
                key={engine.name}
                className="flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-violet-500/50 transition-all"
              >
                <span className="text-2xl">{engine.logo}</span>
                <span className="font-medium text-white">{engine.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Providers Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30">
              AI Models
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Choose Your AI</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Use premium APIs for best quality, or free alternatives like Ollama (local) and MyMemory.
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {AI_PROVIDERS.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-800/50 border border-slate-700"
              >
                <Brain className="w-5 h-5 text-violet-400" />
                <span className="font-medium text-white">{provider.name}</span>
                {provider.free && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                    FREE
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-amber-500/20 text-amber-300 border-amber-500/30">
              Pricing
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Free Forever</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              GameStringer is open source and completely free. Support development if you find it useful!
            </p>
          </div>
          
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-violet-500/30 overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Open Source</h3>
                  <p className="text-slate-400 mb-4">
                    All features included. No subscriptions. No limits.
                  </p>
                  <ul className="space-y-2">
                    {[
                      "All AI providers",
                      "All game engines",
                      "Unlimited translations",
                      "Community packages",
                      "Lifetime updates"
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-slate-300">
                        <Check className="w-4 h-4 text-emerald-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-center">
                  <p className="text-6xl font-bold text-white mb-2">$0</p>
                  <p className="text-slate-400 mb-4">forever</p>
                  <a href="https://ko-fi.com/gamestringer" target="_blank">
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400">
                      <Coffee className="w-4 h-4 mr-2" />
                      Buy Me a Coffee
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Translate?</h2>
          <p className="text-xl text-slate-400 mb-8">
            Download GameStringer now and start localizing your favorite games.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://github.com/rouges78/GameStringer/releases" target="_blank">
              <Button size="lg" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-lg px-8 h-14">
                <Download className="w-5 h-5 mr-2" />
                Download Now
              </Button>
            </a>
            <a href="https://github.com/rouges78/GameStringer" target="_blank">
              <Button size="lg" variant="outline" className="border-slate-700 hover:bg-slate-800 text-lg px-8 h-14">
                <Star className="w-5 h-5 mr-2" />
                Star on GitHub
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Languages className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">GameStringer</span>
            </div>
            <p className="text-slate-500 text-sm">
              Made with ❤️ for the game translation community
            </p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/rouges78/GameStringer" target="_blank" className="text-slate-400 hover:text-white transition">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://ko-fi.com/gamestringer" target="_blank" className="text-slate-400 hover:text-white transition">
                <Coffee className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
