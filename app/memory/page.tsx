'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Database, Search, Trash2, Edit3, Check, X, RefreshCw, 
  Filter, Download, Upload, Sparkles, Clock, Gamepad2,
  ChevronDown, MoreHorizontal, AlertCircle, Scan, Bot, User, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { translationMemory, type TranslationUnit, type TMStats } from '@/lib/translation-memory';
import { invoke } from '@/lib/tauri-api';
import { useTranslation } from '@/lib/i18n';
import { ExportDialog } from '@/components/tools/export-dialog';

// Cache per i nomi dei games
const gameNameCache: Record<string, string> = {};

export default function MemoryPage() {
  const { t } = useTranslation();
  const [units, setUnits] = useState<TranslationUnit[]>([]);
  const [stats, setStats] = useState<TMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGame, setFilterGame] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<TranslationUnit | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { toast } = useToast();

  // Carica dati dalla Translation Memory
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await translationMemory.initialize('en', 'it');
      const memory = translationMemory.export();
      if (memory) {
        setUnits(memory.units);
        setStats(memory.stats);
      }
    } catch (e) {
      console.error('TM loading error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtra unità per ricerca e game (esclude dati corrotti)
  const filteredUnits = units.filter(unit => {
    // Escludi dati corrotti (numeri puri, date, metadata)
    const isCorrupted = 
      /^\d+$/.test(unit.sourceText) || // Solo numeri
      /^\d{4}-\d{2}-\d{2}/.test(unit.sourceText) || // Date ISO
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/.test(unit.sourceText) || // Date formattate
      unit.sourceText === 'unknown' ||
      unit.sourceText === '0' ||
      unit.sourceText === 'DefaultProperties' ||
      unit.sourceText.length < 2 || // Troppo corto
      !unit.targetText || unit.targetText.length < 2;
    
    if (isCorrupted) return false;
    
    const matchesSearch = !searchQuery || 
      unit.sourceText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.targetText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGame = filterGame === 'all' || unit.gameId === filterGame || (!unit.gameId && filterGame === 'all');
    return matchesSearch && matchesGame;
  });

  // Lista games unici
  const uniqueGames = [...new Set(units.map(u => u.gameId).filter(Boolean))];

  // Stato per i nomi dei games risolti
  const [gameNames, setGameNames] = useState<Record<string, string>>({});

  // Risolvi nomi games dagli ID
  useEffect(() => {
    const resolveGameNames = async () => {
      const idsToResolve = uniqueGames.filter(id => id && !gameNameCache[id]);
      if (idsToResolve.length === 0) {
        setGameNames({...gameNameCache});
        return;
      }
      
      try {
        // Carica tutti i games una sola volta
        const games = await invoke<any[]>('get_games_fast');
        
        for (const gameId of idsToResolve) {
          if (!gameId) continue;
          
          // Cerca il game con varie strategie
          const game = games?.find(g => {
            if (!g?.id) return false;
            // Match esatto
            if (g.id === gameId) return true;
            // Match con prefisso steam_
            if (g.id === `steam_${gameId}`) return true;
            // Match con prefisso steam_family_
            if (g.id === `steam_family_${gameId}`) return true;
            // Estrai numero da steam_XXXXX e confronta
            const match = g.id.match(/steam_(?:family_)?(\d+)/);
            if (match && match[1] === gameId) return true;
            return false;
          });
          
          if (game?.name) {
            gameNameCache[gameId] = game.name;
          } else if (/^\d+$/.test(gameId)) {
            // È un ID numerico Steam - prova a ottenere il nome via API
            try {
              const appId = parseInt(gameId);
              const name = await invoke<string | null>('get_steam_game_name', { appId });
              if (name) {
                gameNameCache[gameId] = name;
              } else {
                gameNameCache[gameId] = `Steam #${gameId}`;
              }
            } catch {
              gameNameCache[gameId] = `Steam #${gameId}`;
            }
          } else {
            gameNameCache[gameId] = gameId;
          }
        }
      } catch (e) {
        console.error('Game name resolution error:', e);
        // Fallback per tutti gli ID non risolti
        for (const gameId of idsToResolve) {
          if (gameId && !gameNameCache[gameId]) {
            gameNameCache[gameId] = /^\d+$/.test(gameId) ? `Steam #${gameId}` : gameId;
          }
        }
      }
      
      setGameNames({...gameNameCache});
    };
    
    if (uniqueGames.length > 0) {
      resolveGameNames();
    }
  }, [uniqueGames.join(',')]);

  // Helper per ottenere il nome del game
  const getGameName = (gameId: string | undefined) => {
    if (!gameId) return 'Unknown';
    return gameNames[gameId] || gameId;
  };

  // Modifica traduzione
  const handleEdit = async (unit: TranslationUnit) => {
    if (!editValue.trim() || editValue === unit.targetText) {
      setEditingId(null);
      return;
    }
    
    try {
      await translationMemory.add(unit.sourceText, editValue, {
        context: unit.context,
        gameId: unit.gameId,
        provider: 'manual',
        confidence: 1.0,
        verified: true
      });
      toast({ title: `✅ ${t('dictionary.translationUpdated')}` });
      loadData();
    } catch (e) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    }
    setEditingId(null);
  };

  // Elimina traduzione
  const handleDelete = async () => {
    if (!unitToDelete) return;
    try {
      await translationMemory.delete(unitToDelete.id);
      toast({ title: `🗑️ ${t('dictionary.translationDeleted')}` });
      loadData();
    } catch (e) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    }
    setDeleteDialogOpen(false);
    setUnitToDelete(null);
  };

  // Formatta data
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {t('dictionary.title')}
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('dictionary.subtitle')}
              </p>
            </div>
          </div>
          
          {/* Stats inline */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">{filteredUnits.length.toLocaleString()}</span>
              <span className="text-[10px] text-white/80">{t('dictionary.translations')}</span>
            </div>
            {stats && stats.totalUnits > filteredUnits.length && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/30 backdrop-blur-sm border border-amber-500/40">
                <AlertCircle className="h-3.5 w-3.5 text-white" />
                <span className="text-[10px] text-white">{stats.totalUnits - filteredUnits.length} {t('dictionary.corrupted')}</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setExportDialogOpen(true)} 
              disabled={filteredUnits.length === 0}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white h-8 gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="border-white/30 bg-white/10 hover:bg-white/20 text-white h-8">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('dictionary.searchPlaceholder')}
            className="pl-10 bg-slate-800/50 border-slate-700"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {filterGame === 'all' ? t('dictionary.allGames') : getGameName(filterGame)}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterGame('all')}>
              {t('dictionary.allGames')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {uniqueGames.map(game => (
              <DropdownMenuItem key={game} onClick={() => setFilterGame(game!)}>
                <Gamepad2 className="h-4 w-4 mr-2" />
                {getGameName(game)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-sm text-slate-500">
          {filteredUnits.length} {t('dictionary.results')}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 rounded-xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 text-slate-500 animate-spin" />
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Database className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">{t('dictionary.noTranslationsFound')}</p>
            <p className="text-sm">{t('dictionary.useNeuralTranslator')}</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <table className="w-full table-fixed border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800/95 backdrop-blur-sm">
                  <th className="text-left py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-600/50 w-1/2">
                    {t('dictionary.original')}
                  </th>
                  <th className="text-left py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-orange-400/80 border-b border-slate-600/50 w-1/2">
                    {t('dictionary.translation')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((unit, idx) => (
                  <tr 
                    key={unit.id} 
                    className={cn(
                      "group transition-all duration-200",
                      "hover:bg-gradient-to-r hover:from-indigo-500/10 hover:via-purple-500/5 hover:to-transparent",
                      "hover:shadow-[inset_0_0_30px_rgba(99,102,241,0.1)]",
                      idx % 2 === 0 ? "bg-slate-900/20" : "bg-slate-900/40"
                    )}
                  >
                    {/* Originale */}
                    <td className="py-1 px-2 border-b border-slate-800/30">
                      <span className="text-slate-300 text-xs">{unit.sourceText}</span>
                    </td>
                    
                    {/* Traduzione */}
                    <td className="py-1 px-2 border-b border-slate-800/30">
                      {editingId === unit.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEdit(unit);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="h-8 text-sm bg-slate-800 border-purple-500/50 focus:border-purple-400 focus:ring-purple-400/20"
                          />
                          <Button size="sm" className="h-8 px-3 bg-purple-600 hover:bg-purple-500 text-white" onClick={() => handleEdit(unit)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span 
                            className="text-orange-400 text-xs cursor-pointer hover:text-orange-300 transition-colors flex-1"
                            onClick={() => { setEditingId(unit.id); setEditValue(unit.targetText); }}
                          >
                            {unit.targetText}
                          </span>
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-5 w-5 p-0 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                              onClick={() => { setEditingId(unit.id); setEditValue(unit.targetText); }}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-5 w-5 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => { setUnitToDelete(unit); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              {t('dictionary.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t('dictionary.deleteDescription')}
              {unitToDelete && (
                <span className="mt-3 p-3 rounded-lg bg-slate-800/50 text-sm block">
                  <span className="text-slate-300 block">"{unitToDelete.sourceText}"</span>
                  <span className="text-emerald-400 mt-1 block">→ "{unitToDelete.targetText}"</span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 hover:bg-slate-700">
              {t('dictionary.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('dictionary.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        entries={filteredUnits.map(u => ({
          id: u.id,
          source: u.sourceText,
          target: u.targetText,
          context: u.context,
          notes: u.metadata?.notes,
        }))}
        sourceLang="en"
        targetLang="it"
        defaultFileName="translation_memory"
      />
    </div>
  );
}



