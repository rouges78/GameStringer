'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  History,
  Search,
  Download,
  Trash2,
  Clock,
  DollarSign,
  Zap,
  TrendingUp,
  BarChart3,
  Filter,
} from 'lucide-react';
import { 
  translationHistory, 
  TranslationRecord, 
  TranslationStats,
  formatCost,
  formatDuration,
} from '@/lib/translation-history';
import { toast } from 'sonner';

interface TranslationHistoryPanelProps {
  gameId?: string;
  compact?: boolean;
}

export function TranslationHistoryPanel({ gameId, compact = false }: TranslationHistoryPanelProps) {
  const [records, setRecords] = useState<TranslationRecord[]>([]);
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTool, setFilterTool] = useState<string>('');
  const [activeTab, setActiveTab] = useState('recent');

  useEffect(() => {
    translationHistory.init().then(() => {
      loadData();
    });
  }, [gameId]);

  const loadData = () => {
    const opts = gameId ? { gameId, limit: 100 } : { limit: 100 };
    setRecords(translationHistory.getRecords(opts));
    setStats(translationHistory.getStats(gameId ? { gameId } : undefined));
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setRecords(translationHistory.search(searchQuery));
    } else {
      loadData();
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    const data = translationHistory.exportHistory(format);
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation_history.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`History exported as ${format.toUpperCase()}`);
  };

  const handleClear = () => {
    if (confirm('Delete all translation history?')) {
      translationHistory.clearHistory();
      loadData();
      toast.success('History deleted');
    }
  };

  const toolColors: Record<string, string> = {
    neural: 'bg-red-500/20 text-red-400 border-red-500/30',
    ocr: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    ue: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    unity: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  const providerColors: Record<string, string> = {
    claude: 'bg-amber-500/20 text-amber-400',
    openai: 'bg-green-500/20 text-green-400',
    gemini: 'bg-blue-500/20 text-blue-400',
    deepl: 'bg-sky-500/20 text-sky-400',
    local: 'bg-slate-500/20 text-slate-400',
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium">Cronologia</span>
            <Badge variant="outline" className="text-[10px]">{stats?.totalTranslations || 0}</Badge>
          </div>
        </div>
        
        {stats && (
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="p-1.5 rounded bg-slate-800/30 text-center">
              <div className="font-bold text-red-400">{stats.totalWords.toLocaleString()}</div>
              <div className="text-muted-foreground">Parole</div>
            </div>
            <div className="p-1.5 rounded bg-slate-800/30 text-center">
              <div className="font-bold text-green-400">{formatCost(stats.totalCost)}</div>
              <div className="text-muted-foreground">Costo</div>
            </div>
            <div className="p-1.5 rounded bg-slate-800/30 text-center">
              <div className="font-bold text-blue-400">{formatDuration(stats.totalDuration)}</div>
              <div className="text-muted-foreground">Tempo</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-red-400" />
            Translation History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('json')} className="h-7 text-xs">
              <Download className="h-3 w-3 mr-1" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="h-7 text-xs">
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 text-xs text-red-400 hover:text-red-300">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full h-8 mb-3">
            <TabsTrigger value="recent" className="text-xs">Recent</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-3">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Search translations..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button size="sm" onClick={handleSearch} className="h-8">
                <Search className="h-3 w-3" />
              </Button>
            </div>

            {/* Records List */}
            <ScrollArea className="h-[250px]">
              <div className="space-y-1.5">
                {records.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No translations in history
                  </div>
                ) : (
                  records.map(record => (
                    <div 
                      key={record.id}
                      className="p-2 rounded-lg bg-slate-800/30 border border-slate-800/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground truncate">
                            {record.source.slice(0, 50)}...
                          </div>
                          <div className="text-sm text-green-400 truncate">
                            {record.target.slice(0, 50)}...
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[9px] px-1 ${toolColors[record.tool] || ''}`}>
                            {record.tool}
                          </Badge>
                          <Badge variant="outline" className={`text-[9px] px-1 ${providerColors[record.provider] || ''}`}>
                            {record.provider}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{record.sourceLanguage} → {record.targetLanguage}</span>
                        {record.gameName && <span>• {record.gameName}</span>}
                        <span>• {new Date(record.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stats" className="space-y-3">
            {stats && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                    <Zap className="h-4 w-4 text-red-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-red-400">{stats.totalTranslations}</div>
                    <div className="text-[10px] text-muted-foreground">Translations</div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                    <BarChart3 className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-blue-400">{stats.totalWords.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">Words</div>
                  </div>
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <DollarSign className="h-4 w-4 text-green-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-green-400">{formatCost(stats.totalCost)}</div>
                    <div className="text-[10px] text-muted-foreground">Cost</div>
                  </div>
                  <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                    <Clock className="h-4 w-4 text-orange-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-orange-400">{formatDuration(stats.totalDuration)}</div>
                    <div className="text-[10px] text-muted-foreground">Time</div>
                  </div>
                </div>

                {/* By Tool */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Per Tool</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.byTool).map(([tool, count]) => (
                      <Badge key={tool} variant="outline" className={`${toolColors[tool] || ''}`}>
                        {tool}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* By Provider */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Per Provider</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.byProvider).map(([provider, count]) => (
                      <Badge key={provider} variant="outline" className={`${providerColors[provider] || ''}`}>
                        {provider}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* By Language */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Per Lingua</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.byLanguage).slice(0, 8).map(([pair, count]) => (
                      <Badge key={pair} variant="secondary" className="text-[10px]">
                        {pair}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Cache Stats */}
                <div className="p-2 rounded-lg bg-slate-800/30 border border-slate-800/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Cache Hit Rate</span>
                    <span className="font-mono text-green-400">
                      {stats.cacheHits + stats.cacheMisses > 0 
                        ? Math.round((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>Hits: {stats.cacheHits}</span>
                    <span>•</span>
                    <span>Misses: {stats.cacheMisses}</span>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default TranslationHistoryPanel;



