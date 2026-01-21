'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Square,
  Camera,
  Eye,
  BookOpen,
  Settings,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Clock,
  Zap,
  Brain,
  FileText,
  Users,
  MapPin,
  Sword,
  Shield,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import {
  CrawlerConfig,
  CrawlerSession,
  GlossaryEntry,
  CrawlerStats,
  TermCategory,
  saveCrawlerSession,
  getCrawlerSessions,
  saveGlossary,
  getGlossary,
  classifyTerm,
  generateId,
  exportGlossaryToCSV,
  getGlossaryStats,
} from '@/lib/context-crawler';
import { useTranslation } from '@/lib/i18n';

const CATEGORY_ICONS: Record<TermCategory, React.ReactNode> = {
  character_name: <Users className="h-3 w-3" />,
  location: <MapPin className="h-3 w-3" />,
  item: <Sparkles className="h-3 w-3" />,
  skill: <Zap className="h-3 w-3" />,
  enemy: <Sword className="h-3 w-3" />,
  ui_element: <Shield className="h-3 w-3" />,
  dialog: <MessageSquare className="h-3 w-3" />,
  system: <Settings className="h-3 w-3" />,
  unknown: <FileText className="h-3 w-3" />,
};

const CATEGORY_COLORS: Record<TermCategory, string> = {
  character_name: 'bg-blue-500',
  location: 'bg-green-500',
  item: 'bg-yellow-500',
  skill: 'bg-purple-500',
  enemy: 'bg-red-500',
  ui_element: 'bg-gray-500',
  dialog: 'bg-cyan-500',
  system: 'bg-orange-500',
  unknown: 'bg-slate-500',
};

const DEFAULT_CONFIG: CrawlerConfig = {
  captureInterval: 2000,
  ocrLanguage: 'en',
  targetLanguage: 'it',
  minConfidence: 0.6,
  deduplicateThreshold: 0.85,
  contextWindowSize: 5,
  autoClassify: true,
};

export function ContextCrawler() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<CrawlerConfig>(DEFAULT_CONFIG);
  const [session, setSession] = useState<CrawlerSession | null>(null);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [stats, setStats] = useState<CrawlerStats>({
    framesProcessed: 0,
    textsExtracted: 0,
    uniqueTerms: 0,
    categorizedTerms: 0,
    translatedTerms: 0,
    avgConfidence: 0,
    processingSpeed: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameId, setGameId] = useState('demo_game');
  const [gameName, setGameName] = useState('Demo Game');
  const [recentCaptures, setRecentCaptures] = useState<string[]>([]);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef(0);

  // Load existing glossary
  useEffect(() => {
    const stored = getGlossary(gameId);
    if (stored.length > 0) {
      setGlossary(stored);
    }
  }, [gameId]);

  // Simulate OCR capture (in production would use Tauri to capture screen)
  const simulateCapture = useCallback(() => {
    if (!isRunning || isPaused) return;

    frameCountRef.current++;
    
    // Simulate extracted texts (in production would come from real OCR)
    const sampleTexts = [
      'Attack', 'Defend', 'Magic', 'Item', 'Run',
      'HP', 'MP', 'Level', 'EXP', 'Gold',
      'Fire', 'Ice', 'Thunder', 'Heal', 'Cure',
      'Potion', 'Elixir', 'Phoenix Down', 'Antidote',
      'Sword', 'Shield', 'Armor', 'Helmet',
      'Goblin', 'Orc', 'Dragon', 'Slime',
      'Castle', 'Village', 'Forest', 'Cave',
      'Hero', 'Princess', 'King', 'Wizard',
      'Save your progress?', 'Game Over', 'Victory!',
      'You obtained a key!', 'Quest completed!',
    ];

    // Scegli casualmente alcuni testi
    const capturedCount = Math.floor(Math.random() * 3) + 1;
    const captured: string[] = [];
    
    for (let i = 0; i < capturedCount; i++) {
      const text = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
      if (!captured.includes(text)) {
        captured.push(text);
      }
    }

    // Update recent captures
    setRecentCaptures(prev => [...captured, ...prev].slice(0, 10));

    // Process each captured text
    for (const text of captured) {
      const existingIndex = glossary.findIndex(
        g => g.term.toLowerCase() === text.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update frequency
        const updated = [...glossary];
        updated[existingIndex].frequency++;
        updated[existingIndex].lastSeen = Date.now();
        setGlossary(updated);
      } else {
        // New entry
        const context = {
          screenRegion: 'unknown' as const,
          nearbyTexts: [],
          dominantColors: [],
          estimatedFontSize: 'medium' as const,
          isRepeated: false,
        };
        
        const category = config.autoClassify 
          ? classifyTerm(text, context, glossary)
          : 'unknown';

        const newEntry: GlossaryEntry = {
          id: generateId(),
          term: text,
          category,
          frequency: 1,
          contexts: [],
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          confidence: 0.7 + Math.random() * 0.3,
          status: 'pending',
        };

        setGlossary(prev => [...prev, newEntry]);
      }
    }

    // Update stats
    setStats(prev => ({
      ...prev,
      framesProcessed: frameCountRef.current,
      textsExtracted: prev.textsExtracted + captured.length,
      uniqueTerms: glossary.length + captured.filter(c => 
        !glossary.some(g => g.term.toLowerCase() === c.toLowerCase())
      ).length,
      processingSpeed: frameCountRef.current / ((Date.now() - (session?.startTime || Date.now())) / 1000),
    }));

  }, [isRunning, isPaused, config, glossary, session]);

  // Start/stop crawler
  const startCrawler = () => {
    const newSession: CrawlerSession = {
      id: generateId(),
      gameId,
      gameName,
      startTime: Date.now(),
      totalFrames: 0,
      uniqueTexts: 0,
      glossaryEntries: glossary.length,
      status: 'running',
    };
    
    setSession(newSession);
    setIsRunning(true);
    setIsPaused(false);
    frameCountRef.current = 0;
    
    intervalRef.current = setInterval(simulateCapture, config.captureInterval);
  };

  const pauseCrawler = () => {
    setIsPaused(!isPaused);
    if (session) {
      setSession({ ...session, status: isPaused ? 'running' : 'paused' });
    }
  };

  const stopCrawler = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    setIsRunning(false);
    setIsPaused(false);
    
    if (session) {
      const finalSession = {
        ...session,
        endTime: Date.now(),
        totalFrames: frameCountRef.current,
        uniqueTexts: glossary.length,
        glossaryEntries: glossary.length,
        status: 'completed' as const,
      };
      setSession(finalSession);
      saveCrawlerSession(finalSession);
    }
    
    // Save glossary
    saveGlossary(gameId, glossary);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update interval when config changes
  useEffect(() => {
    if (isRunning && !isPaused && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(simulateCapture, config.captureInterval);
    }
  }, [config.captureInterval, isRunning, isPaused, simulateCapture]);

  const handleExport = () => {
    const csv = exportGlossaryToCSV(glossary);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameId}_glossary.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearGlossary = () => {
    if (confirm(t('contextCrawler.clearConfirm'))) {
      setGlossary([]);
      saveGlossary(gameId, []);
    }
  };

  const glossaryStats = getGlossaryStats(glossary);

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-600 via-rose-500 to-purple-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('contextCrawler.title')}</h2>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('contextCrawler.subtitle')}</p>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <Button onClick={startCrawler} className="bg-white text-pink-600 hover:bg-white/90 shadow-lg">
                <Play className="h-4 w-4 mr-1" />
                {t('contextCrawler.start')}
              </Button>
            ) : (
              <>
                <Button onClick={pauseCrawler} variant="outline" className="border-white/30 text-white hover:bg-white/20">
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
                <Button onClick={stopCrawler} className="bg-red-500/80 hover:bg-red-500 text-white">
                  <Square className="h-4 w-4 mr-1" />
                  {t('contextCrawler.stop')}
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Status Badge in Header */}
        {isRunning && (
          <div className="mt-2 flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isPaused ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
              <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`} />
              {isPaused ? t('contextCrawler.paused') : t('contextCrawler.running')}
            </div>
            <span className="text-white/60 text-sm">{stats.framesProcessed} frames • {glossary.length} terms • {stats.processingSpeed.toFixed(1)} fps</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="glossary" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="glossary">{t('contextCrawler.glossary')} ({glossary.length})</TabsTrigger>
          <TabsTrigger value="live">{t('contextCrawler.liveFeed')}</TabsTrigger>
          <TabsTrigger value="settings">{t('contextCrawler.settings')}</TabsTrigger>
        </TabsList>

        {/* Glossary Tab */}
        <TabsContent value="glossary" className="space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="py-2 text-center">
                <p className="text-lg font-bold">{glossaryStats.total}</p>
                <p className="text-[10px] text-muted-foreground">{t('contextCrawler.total')}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="py-2 text-center">
                <p className="text-lg font-bold">{glossaryStats.byStatus.translated}</p>
                <p className="text-[10px] text-muted-foreground">{t('contextCrawler.translated')}</p>
              </CardContent>
            </Card>
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="py-2 text-center">
                <p className="text-lg font-bold">{glossaryStats.byStatus.pending}</p>
                <p className="text-[10px] text-muted-foreground">{t('contextCrawler.pending')}</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-500/10 border-purple-500/30">
              <CardContent className="py-2 text-center">
                <p className="text-lg font-bold">{(glossaryStats.avgConfidence * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">{t('contextCrawler.confidence')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3 w-3 mr-1" />
              {t('contextCrawler.exportCsv')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearGlossary}>
              <Trash2 className="h-3 w-3 mr-1" />
              {t('contextCrawler.clear')}
            </Button>
          </div>

          {/* Glossary List */}
          <Card>
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-1">
                {glossary.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    {t('contextCrawler.noTermsCaptured')}
                  </p>
                ) : (
                  glossary
                    .sort((a, b) => b.frequency - a.frequency)
                    .map(entry => (
                      <div 
                        key={entry.id}
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted"
                      >
                        <Badge className={`${CATEGORY_COLORS[entry.category]} h-5 w-5 p-0 flex items-center justify-center`}>
                          {CATEGORY_ICONS[entry.category]}
                        </Badge>
                        <span className="flex-1 font-medium text-sm">{entry.term}</span>
                        {entry.translation && (
                          <span className="text-sm text-green-500">{entry.translation}</span>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          x{entry.frequency}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] ${
                            entry.status === 'translated' ? 'border-green-500 text-green-500' :
                            entry.status === 'confirmed' ? 'border-blue-500 text-blue-500' :
                            'border-gray-500 text-gray-500'
                          }`}
                        >
                          {entry.status}
                        </Badge>
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Live Feed Tab */}
        <TabsContent value="live" className="space-y-3">
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {t('contextCrawler.recentCaptures')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {recentCaptures.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      {t('contextCrawler.noRecentCaptures')}
                    </p>
                  ) : (
                    recentCaptures.map((text, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 bg-muted/30 rounded text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{text}</span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm">{t('contextCrawler.categoryDistribution')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(glossaryStats.byCategory)
                  .filter(([_, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div key={category} className="flex items-center gap-2">
                      <Badge className={`${CATEGORY_COLORS[category as TermCategory]} h-5 w-5 p-0 flex items-center justify-center`}>
                        {CATEGORY_ICONS[category as TermCategory]}
                      </Badge>
                      <span className="text-xs flex-1 capitalize">{category.replace(/_/g, ' ')}</span>
                      <Progress value={(count / glossaryStats.total) * 100} className="w-24 h-2" />
                      <span className="text-xs text-muted-foreground w-8">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-3">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('contextCrawler.captureInterval')}</span>
                  <span className="text-xs text-muted-foreground">{config.captureInterval}ms</span>
                </div>
                <Slider
                  value={[config.captureInterval]}
                  onValueChange={([v]) => setConfig(c => ({ ...c, captureInterval: v }))}
                  min={500}
                  max={5000}
                  step={100}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('contextCrawler.minConfidence')}</span>
                  <span className="text-xs text-muted-foreground">{(config.minConfidence * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[config.minConfidence * 100]}
                  onValueChange={([v]) => setConfig(c => ({ ...c, minConfidence: v / 100 }))}
                  min={30}
                  max={95}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('contextCrawler.deduplicationThreshold')}</span>
                  <span className="text-xs text-muted-foreground">{(config.deduplicateThreshold * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[config.deduplicateThreshold * 100]}
                  onValueChange={([v]) => setConfig(c => ({ ...c, deduplicateThreshold: v / 100 }))}
                  min={50}
                  max={100}
                  step={5}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm">{t('contextCrawler.autoClassification')}</span>
                  <p className="text-xs text-muted-foreground">{t('contextCrawler.autoClassifyDesc')}</p>
                </div>
                <Switch
                  checked={config.autoClassify}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, autoClassify: v }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-muted-foreground">{t('contextCrawler.ocrLanguage')}</span>
                  <Input
                    value={config.ocrLanguage}
                    onChange={(e) => setConfig(c => ({ ...c, ocrLanguage: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{t('contextCrawler.targetLanguage')}</span>
                  <Input
                    value={config.targetLanguage}
                    onChange={(e) => setConfig(c => ({ ...c, targetLanguage: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}



