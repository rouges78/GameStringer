'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Square,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  Plus,
  Zap,
  Database,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Languages,
  Gamepad2,
  Settings,
} from 'lucide-react';
import { translationBridge, BridgeStats, DictionaryStats, TranslationPair } from '@/lib/translation-bridge';
import { getFlagEmoji } from '@/components/ui/language-flags';
import { useTranslation } from '@/lib/i18n';

export default function TranslationBridgePage() {
  const { t } = useTranslation();
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<BridgeStats | null>(null);
  const [dictStats, setDictStats] = useState<DictionaryStats | null>(null);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('it');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Translation input
  const [newOriginal, setNewOriginal] = useState('');
  const [newTranslated, setNewTranslated] = useState('');
  const [bulkTranslations, setBulkTranslations] = useState('');
  
  // Test translation
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    const [bridgeStats, dictionaryStats, running] = await Promise.all([
      translationBridge.getStats(),
      translationBridge.getDictionaryStats(),
      translationBridge.isRunning(),
    ]);
    setStats(bridgeStats);
    setDictStats(dictionaryStats);
    setIsRunning(running);
  }, []);

  // Auto-refresh stats
  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 2000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  // Start/Stop bridge
  const handleToggleBridge = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isRunning) {
        await translationBridge.stop();
        setSuccess('Translation Bridge fermato');
      } else {
        const ok = await translationBridge.start();
        if (ok) {
          setSuccess('Translation Bridge avviato');
        } else {
          setError('error avvio Translation Bridge');
        }
      }
      await refreshStats();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Set languages
  const handleSetLanguages = async () => {
    setIsLoading(true);
    try {
      await translationBridge.setLanguages(sourceLang, targetLang);
      setSuccess(`Lingue impostate: ${sourceLang} → ${targetLang}`);
      await refreshStats();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Add single translation
  const handleAddTranslation = async () => {
    if (!newOriginal.trim() || !newTranslated.trim()) return;
    
    setIsLoading(true);
    try {
      await translationBridge.addTranslation(newOriginal, newTranslated);
      setSuccess(`Aggiunta: "${newOriginal}" → "${newTranslated}"`);
      setNewOriginal('');
      setNewTranslated('');
      await refreshStats();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Load bulk translations
  const handleLoadBulk = async () => {
    if (!bulkTranslations.trim()) return;
    
    setIsLoading(true);
    try {
      // Parse JSON or line-by-line format
      let translations: TranslationPair[] = [];
      
      try {
        // Try JSON format first
        const parsed = JSON.parse(bulkTranslations);
        if (Array.isArray(parsed)) {
          translations = parsed;
        } else if (typeof parsed === 'object') {
          translations = Object.entries(parsed).map(([original, translated]) => ({
            original,
            translated: String(translated),
          }));
        }
      } catch {
        // Fallback to line format: original=translated
        const lines = bulkTranslations.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const [original, translated] = line.split('=').map(s => s.trim());
          if (original && translated) {
            translations.push({ original, translated });
          }
        }
      }
      
      if (translations.length === 0) {
        setError('Nessuna traduzione valida trovata');
        return;
      }
      
      const count = await translationBridge.loadTranslations(sourceLang, targetLang, translations);
      setSuccess(`loaded ${count} traduzioni`);
      setBulkTranslations('');
      await refreshStats();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Test translation
  const handleTestTranslation = async () => {
    if (!testInput.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await translationBridge.getTranslation(testInput);
      setTestResult(result || '(nessuna traduzione trovata)');
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Clear dictionary
  const handleClear = async () => {
    if (!confirm('Sei sicuro di voler cancellare tutte le traduzioni?')) return;
    
    setIsLoading(true);
    try {
      await translationBridge.clear();
      setSuccess('Dizionario cancellato');
      await refreshStats();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/10 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
              <Gamepad2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Translation Bridge
              </h1>
              <p className="text-muted-foreground">
                Sistema di traduzione in-game per Unity
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge 
              variant={isRunning ? "default" : "secondary"}
              className={isRunning ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}
            >
              {isRunning ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Attivo</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Inattivo</>
              )}
            </Badge>
            
            <Button
              onClick={handleToggleBridge}
              disabled={isLoading}
              variant={isRunning ? "destructive" : "default"}
              className={!isRunning ? "bg-gradient-to-r from-blue-600 to-cyan-600" : ""}
            >
              {isRunning ? (
                <><Square className="h-4 w-4 mr-2" /> Ferma</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> Avvia</>
              )}
            </Button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Database className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dictStats?.total_entries ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Traduzioni</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Activity className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total_requests ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Richieste</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Zap className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats ? `${translationBridge.getCacheHitRate(stats).toFixed(1)}%` : '0%'}
                  </p>
                  <p className="text-xs text-muted-foreground">Cache Hit</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Clock className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats ? translationBridge.formatUptime(stats.uptime_seconds) : '0s'}
                  </p>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="translations" className="space-y-4">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="translations">
              <Languages className="h-4 w-4 mr-2" />
              Traduzioni
            </TabsTrigger>
            <TabsTrigger value="test">
              <Zap className="h-4 w-4 mr-2" />
              Test
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Impostazioni
            </TabsTrigger>
          </TabsList>

          {/* Translations Tab */}
          <TabsContent value="translations" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Add Single Translation */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Aggiungi Traduzione
                  </CardTitle>
                  <CardDescription>
                    Aggiungi una singola coppia originale/traduzione
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Testo Originale ({getFlagEmoji(sourceLang === 'en' ? 'GB' : sourceLang.toUpperCase())})</Label>
                    <Input
                      value={newOriginal}
                      onChange={(e) => setNewOriginal(e.target.value)}
                      placeholder="Hello, World!"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Traduzione ({getFlagEmoji(targetLang.toUpperCase())})</Label>
                    <Input
                      value={newTranslated}
                      onChange={(e) => setNewTranslated(e.target.value)}
                      placeholder="Ciao, Mondo!"
                    />
                  </div>
                  <Button 
                    onClick={handleAddTranslation} 
                    disabled={isLoading || !newOriginal || !newTranslated}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Aggiungi
                  </Button>
                </CardContent>
              </Card>

              {/* Bulk Import */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import Massivo
                  </CardTitle>
                  <CardDescription>
                    Carica più traduzioni in formato JSON o linea per linea
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Traduzioni</Label>
                    <Textarea
                      value={bulkTranslations}
                      onChange={(e) => setBulkTranslations(e.target.value)}
                      placeholder={`Formato JSON:
{"Hello": "Ciao", "World": "Mondo"}

Oppure linea per linea:
Hello=Ciao
World=Mondo`}
                      className="h-32 font-mono text-sm"
                    />
                  </div>
                  <Button 
                    onClick={handleLoadBulk} 
                    disabled={isLoading || !bulkTranslations}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Carica Traduzioni
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Test Tab */}
          <TabsContent value="test">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Test Traduzione
                </CardTitle>
                <CardDescription>
                  Verifica se una stringa ha una traduzione nel dizionario
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Testo da cercare</Label>
                    <Input
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Hello, World!"
                      onKeyDown={(e) => e.key === 'Enter' && handleTestTranslation()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>result</Label>
                    <Input
                      value={testResult ?? ''}
                      readOnly
                      placeholder="(inserisci testo e premi Cerca)"
                      className={testResult && testResult !== '(nessuna traduzione trovata)' 
                        ? 'border-green-500/50 bg-green-500/10' 
                        : testResult ? 'border-orange-500/50 bg-orange-500/10' : ''}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleTestTranslation} 
                  disabled={isLoading || !testInput}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Cerca Traduzione
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurazione
                </CardTitle>
                <CardDescription>
                  Imposta la coppia di lingue attiva
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Lingua Sorgente</Label>
                    <Select value={sourceLang} onValueChange={setSourceLang}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">{getFlagEmoji('GB')} English</SelectItem>
                        <SelectItem value="ja">{getFlagEmoji('JP')} 日本語</SelectItem>
                        <SelectItem value="zh">{getFlagEmoji('CN')} 中文</SelectItem>
                        <SelectItem value="ko">{getFlagEmoji('KR')} 한국어</SelectItem>
                        <SelectItem value="de">{getFlagEmoji('DE')} Deutsch</SelectItem>
                        <SelectItem value="fr">{getFlagEmoji('FR')} Français</SelectItem>
                        <SelectItem value="es">{getFlagEmoji('ES')} Español</SelectItem>
                        <SelectItem value="ru">{getFlagEmoji('RU')} Русский</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lingua Target</Label>
                    <Select value={targetLang} onValueChange={setTargetLang}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">{getFlagEmoji('IT')} Italiano</SelectItem>
                        <SelectItem value="en">{getFlagEmoji('GB')} English</SelectItem>
                        <SelectItem value="de">{getFlagEmoji('DE')} Deutsch</SelectItem>
                        <SelectItem value="fr">{getFlagEmoji('FR')} Français</SelectItem>
                        <SelectItem value="es">{getFlagEmoji('ES')} Español</SelectItem>
                        <SelectItem value="ja">{getFlagEmoji('JP')} 日本語</SelectItem>
                        <SelectItem value="zh">{getFlagEmoji('CN')} 中文</SelectItem>
                        <SelectItem value="ko">{getFlagEmoji('KR')} 한국어</SelectItem>
                        <SelectItem value="ru">{getFlagEmoji('RU')} Русский</SelectItem>
                        <SelectItem value="pt">{getFlagEmoji('BR')} Português</SelectItem>
                        <SelectItem value="pl">{getFlagEmoji('PL')} Polski</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={handleSetLanguages} disabled={isLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Applica Lingue
                  </Button>
                  <Button variant="destructive" onClick={handleClear} disabled={isLoading}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cancella Dizionario
                  </Button>
                </div>

                {/* Current Languages */}
                {dictStats && (
                  <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                    <p className="text-sm text-muted-foreground mb-2">Lingue attive:</p>
                    <p className="text-lg font-medium">
                      {getFlagEmoji(dictStats.active_source === 'en' ? 'GB' : dictStats.active_source.toUpperCase())} {dictStats.active_source}
                      {' → '}
                      {getFlagEmoji(dictStats.active_target.toUpperCase())} {dictStats.active_target}
                    </p>
                    {dictStats.language_pairs.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Coppie disponibili: {dictStats.language_pairs.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Performance Stats */}
        {stats && stats.total_requests > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tempo medio risposta</p>
                  <p className="font-mono">{translationBridge.formatResponseTime(stats.avg_response_time_us)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cache Hits</p>
                  <p className="font-mono text-green-400">{stats.cache_hits}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cache Misses</p>
                  <p className="font-mono text-orange-400">{stats.cache_misses}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Errori</p>
                  <p className="font-mono text-red-400">{stats.errors}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}



