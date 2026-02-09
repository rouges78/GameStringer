'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Upload,
  Download,
  Search,
  Check,
  X,
  Globe,
  Loader2,
  Terminal,
  ChevronRight,
  Database,
  BarChart3,
  Copy,
  Sparkles,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

interface WadTextEntry {
  original: string;
  translated: string;
  file: string;
  index: number;
  type: string;
  context: string;
  raw?: string;
}

interface ExtractionStats {
  total: number;
  translated: number;
  dialogues: number;
  texts: number;
  withCLT: number;
  uniqueFiles: number;
  percentage: number;
}

export function WadExtractor() {
  const [entries, setEntries] = useState<WadTextEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dialogue' | 'text'>('all');
  const [showUntranslated, setShowUntranslated] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('compact');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(0);
  const [wadPath, setWadPath] = useState('');

  // Compute stats
  const stats: ExtractionStats = useMemo(() => {
    const total = entries.length;
    const translated = entries.filter(e => e.translated && e.translated.length > 0).length;
    const dialogues = entries.filter(e => e.type === 'dialogue').length;
    const texts = entries.filter(e => e.type === 'text').length;
    const withCLT = entries.filter(e => e.raw).length;
    const uniqueFiles = new Set(entries.map(e => e.file)).size;
    return {
      total,
      translated,
      dialogues,
      texts,
      withCLT,
      uniqueFiles,
      percentage: total > 0 ? Math.round((translated / total) * 100) : 0,
    };
  }, [entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = searchTerm === '' ||
        e.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.translated && e.translated.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.file.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || e.type === typeFilter;
      const matchesUntranslated = !showUntranslated || !e.translated;
      return matchesSearch && matchesType && matchesUntranslated;
    });
  }, [entries, searchTerm, typeFilter, showUntranslated]);

  // Load extracted JSON
  const loadExtractedJson = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        title: 'Carica testo estratto dal WAD',
      });

      if (selected && typeof selected === 'string') {
        setLoading(true);
        try {
          const { readTextFile } = await import('@tauri-apps/plugin-fs');
          const content = await readTextFile(selected);
          const data: WadTextEntry[] = JSON.parse(content);
          setEntries(data);
          toast.success(`Caricati ${data.length} stringhe da WAD`);
        } catch {
          // Fallback: try fetch for dev mode
          const response = await fetch(`/api/read-file?path=${encodeURIComponent(selected)}`);
          if (response.ok) {
            const data = await response.json();
            setEntries(data);
            toast.success(`Caricati ${data.length} stringhe`);
          } else {
            toast.error('Errore lettura file');
          }
        }
      }
    } catch (e) {
      toast.error(`Errore: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save translated JSON
  const saveTranslatedJson = useCallback(async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const selected = await save({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        defaultPath: 'translations.json',
      });

      if (selected) {
        try {
          const { writeTextFile } = await import('@tauri-apps/plugin-fs');
          // Export in GameStringer translations.json format
          const exportData = entries
            .filter(e => e.translated && e.translated.length > 0)
            .map(e => ({
              original: e.original,
              translated: e.translated,
              file: e.file,
              index: e.index,
              type: e.type,
              context: e.context,
            }));
          await writeTextFile(selected, JSON.stringify(exportData, null, 2));
          toast.success(`Salvate ${exportData.length} traduzioni`);
        } catch {
          toast.error('Errore salvataggio');
        }
      }
    } catch (e) {
      toast.error(`Errore: ${e}`);
    }
  }, [entries]);

  // Update a single entry
  const updateEntry = useCallback((idx: number, translation: string) => {
    setEntries(prev => {
      const updated = [...prev];
      const globalIdx = entries.indexOf(filteredEntries[idx]);
      if (globalIdx >= 0) {
        updated[globalIdx] = { ...updated[globalIdx], translated: translation };
      }
      return updated;
    });
    setEditingIndex(null);
  }, [entries, filteredEntries]);

  // Batch translate with AI
  const translateBatch = useCallback(async () => {
    const untranslated = entries.filter(e => !e.translated || e.translated.length === 0);
    if (untranslated.length === 0) {
      toast.info('Tutte le stringhe sono gia tradotte');
      return;
    }

    setTranslating(true);
    setTranslateProgress(0);
    const batchSize = 5;
    const maxBatch = Math.min(untranslated.length, 100); // Max 100 at a time
    let translatedCount = 0;

    try {
      toast.info(`Traduzione di ${maxBatch} stringhe in corso...`);

      for (let i = 0; i < maxBatch; i += batchSize) {
        const batch = untranslated.slice(i, i + batchSize);

        const results = await Promise.all(
          batch.map(async (entry) => {
            try {
              const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: entry.original,
                  sourceLanguage: 'en',
                  targetLanguage: 'it',
                  context: `Videogioco Danganronpa. Tipo: ${entry.type}. File: ${entry.file}`,
                }),
              });

              if (response.ok) {
                const data = await response.json();
                return { original: entry.original, translation: data.translatedText };
              }
              return null;
            } catch {
              return null;
            }
          })
        );

        const valid = results.filter(r => r !== null);
        if (valid.length > 0) {
          setEntries(prev => {
            const updated = [...prev];
            for (const v of valid) {
              if (!v) continue;
              const idx = updated.findIndex(e => e.original === v.original && (!e.translated || e.translated.length === 0));
              if (idx >= 0) {
                updated[idx] = { ...updated[idx], translated: v.translation };
                translatedCount++;
              }
            }
            return updated;
          });
        }

        setTranslateProgress(Math.round(((i + batchSize) / maxBatch) * 100));

        if (i + batchSize < maxBatch) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      toast.success(`Tradotte ${translatedCount} stringhe con AI`);
    } catch (e) {
      toast.error(`Errore traduzione: ${e}`);
    } finally {
      setTranslating(false);
      setTranslateProgress(0);
    }
  }, [entries]);

  // Copy extraction command
  const copyExtractCommand = useCallback(() => {
    const cmd = wadPath
      ? `node scripts/extract-wad-text.mjs "${wadPath}" extracted_text.json`
      : 'node scripts/extract-wad-text.mjs "<percorso-wad>" extracted_text.json';
    navigator.clipboard.writeText(cmd);
    toast.success('Comando copiato negli appunti');
  }, [wadPath]);

  return (
    <div className="space-y-3">
      {/* Stats Bar */}
      {entries.length > 0 && (
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardContent className="pt-4 px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-emerald-400">{stats.percentage}%</p>
                  <p className="text-sm text-muted-foreground">Tradotto</p>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-medium">{stats.total.toLocaleString()}</span>
                    <span className="text-muted-foreground text-xs">totali</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <span>{stats.translated.toLocaleString()}</span>
                    <span className="text-muted-foreground text-xs">tradotte</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <X className="w-3.5 h-3.5 text-red-500" />
                    <span>{(stats.total - stats.translated).toLocaleString()}</span>
                    <span className="text-muted-foreground text-xs">mancanti</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    <FileText className="w-2.5 h-2.5 mr-1" />
                    {stats.dialogues} dialoghi
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <BarChart3 className="w-2.5 h-2.5 mr-1" />
                    {stats.texts} testi
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {stats.uniqueFiles} file
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={translateBatch}
                  disabled={translating || stats.translated === stats.total}
                  size="sm"
                  className="h-8 bg-purple-600 hover:bg-purple-500"
                >
                  {translating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  Traduci AI
                </Button>
                <Button variant="outline" onClick={loadExtractedJson} size="sm" className="h-8">
                  <Upload className="w-3 h-3 mr-1" />
                  Carica
                </Button>
                <Button
                  onClick={saveTranslatedJson}
                  disabled={stats.translated === 0}
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-500"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Esporta
                </Button>
              </div>
            </div>
            <Progress value={translating ? translateProgress : stats.percentage} className="h-2 bg-slate-800" />
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Sidebar - Extraction */}
        <Card className="lg:col-span-1 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Estrazione WAD
            </CardTitle>
            <CardDescription className="text-xs">
              Estrai tutto il testo da un file WAD
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* WAD Path */}
            <div>
              <label className="text-xs text-muted-foreground">Percorso WAD (opzionale)</label>
              <Input
                placeholder="C:\...\dr1_data_us.wad"
                value={wadPath}
                onChange={(e) => setWadPath(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>

            {/* Extract Command */}
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Comando estrazione:</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={copyExtractCommand}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <code className="text-[10px] text-emerald-400 font-mono break-all leading-relaxed">
                node scripts/extract-wad-text.mjs &quot;{wadPath || '<wad-path>'}&quot; out.json
              </code>
            </div>

            {/* Workflow Steps */}
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Workflow</p>
              <div className="space-y-1.5">
                <div className={`flex items-center gap-2 text-xs ${entries.length > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${entries.length > 0 ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-800 border border-slate-700'}`}>
                    {entries.length > 0 ? <Check className="w-3 h-3" /> : '1'}
                  </div>
                  Estrai testo (CLI)
                </div>
                <div className={`flex items-center gap-2 text-xs ${entries.length > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${entries.length > 0 ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-800 border border-slate-700'}`}>
                    {entries.length > 0 ? <Check className="w-3 h-3" /> : '2'}
                  </div>
                  Carica JSON
                </div>
                <div className={`flex items-center gap-2 text-xs ${stats.translated > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${stats.translated > 0 ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-800 border border-slate-700'}`}>
                    {stats.translated > 0 ? <Check className="w-3 h-3" /> : '3'}
                  </div>
                  Traduci (AI/manuale)
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-800 border border-slate-700">4</div>
                  Esporta traduzioni
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-800 border border-slate-700">5</div>
                  Applica patch (CLI)
                </div>
              </div>
            </div>

            {/* Load Button */}
            <Button
              onClick={loadExtractedJson}
              disabled={loading}
              className="w-full h-9 bg-emerald-600 hover:bg-emerald-500"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Carica JSON Estratto
            </Button>
          </CardContent>
        </Card>

        {/* Main - Text Editor */}
        <Card className="lg:col-span-3 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                Testo Estratto
                {entries.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {filteredEntries.length.toLocaleString()} / {entries.length.toLocaleString()}
                  </Badge>
                )}
              </CardTitle>
              {entries.length > 0 && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={viewMode === 'compact' ? 'default' : 'outline'}
                    onClick={() => setViewMode('compact')}
                    className="h-7 px-2 text-xs"
                  >
                    Compatta
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'full' ? 'default' : 'outline'}
                    onClick={() => setViewMode('full')}
                    className="h-7 px-2 text-xs"
                  >
                    Espansa
                  </Button>
                </div>
              )}
            </div>
            {entries.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca testo, file..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-8"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={typeFilter === 'all' ? 'default' : 'outline'}
                      onClick={() => setTypeFilter('all')}
                      className="h-8 text-xs"
                    >
                      Tutti
                    </Button>
                    <Button
                      size="sm"
                      variant={typeFilter === 'dialogue' ? 'default' : 'outline'}
                      onClick={() => setTypeFilter('dialogue')}
                      className="h-8 text-xs"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Dialoghi
                    </Button>
                    <Button
                      size="sm"
                      variant={typeFilter === 'text' ? 'default' : 'outline'}
                      onClick={() => setTypeFilter('text')}
                      className="h-8 text-xs"
                    >
                      <Filter className="w-3 h-3 mr-1" />
                      Testi
                    </Button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUntranslated}
                    onChange={(e) => setShowUntranslated(e.target.checked)}
                    className="rounded border-slate-700"
                  />
                  Solo non tradotti ({(stats.total - stats.translated).toLocaleString()})
                </label>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px]">
              {filteredEntries.length > 0 ? (
                <div className="space-y-2">
                  {filteredEntries.slice(0, 200).map((entry, i) => {
                    const isEditing = editingIndex === i;
                    const isUntranslated = !entry.translated || entry.translated.length === 0;

                    if (viewMode === 'compact' && !isEditing) {
                      return (
                        <div
                          key={`${entry.file}-${entry.index}-${i}`}
                          onClick={() => { setEditingIndex(i); setEditedText(entry.translated || ''); }}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-slate-800/30 transition-colors ${
                            isUntranslated ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-slate-800/50'
                          }`}
                        >
                          <Badge className={`text-[9px] shrink-0 ${
                            entry.type === 'dialogue'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          }`}>
                            {entry.type === 'dialogue' ? 'DLG' : 'TXT'}
                          </Badge>
                          <span className="text-xs font-mono truncate flex-1 text-muted-foreground">
                            {entry.original.substring(0, 60)}{entry.original.length > 60 ? '...' : ''}
                          </span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className={`text-xs truncate flex-1 ${isUntranslated ? 'italic text-yellow-500/70' : ''}`}>
                            {entry.translated || '(da tradurre)'}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${entry.file}-${entry.index}-${i}`}
                        className={`p-3 rounded-lg border ${isUntranslated ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-slate-800'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[9px] ${
                              entry.type === 'dialogue'
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            }`}>
                              {entry.type === 'dialogue' ? 'Dialogo' : 'Testo'}
                            </Badge>
                            {entry.raw && (
                              <Badge variant="outline" className="text-[9px]">CLT</Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {entry.file.split('/').pop()} #{entry.index}
                          </span>
                        </div>

                        <div className="mb-2">
                          <p className="text-sm font-mono bg-slate-950/50 p-2 rounded border border-slate-800">
                            {entry.original}
                          </p>
                          {entry.raw && entry.raw !== entry.original && (
                            <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                              Raw: {entry.raw.substring(0, 100)}{entry.raw.length > 100 ? '...' : ''}
                            </p>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              className="font-mono text-sm bg-slate-950/50 border-slate-700"
                              rows={2}
                              placeholder="Inserisci traduzione italiana..."
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateEntry(i, editedText)}
                                className="h-7 bg-emerald-600 hover:bg-emerald-500"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Salva
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingIndex(null)}
                                className="h-7"
                              >
                                Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => { setEditingIndex(i); setEditedText(entry.translated || ''); }}
                            className={`p-2 rounded cursor-pointer hover:bg-slate-800/50 transition-colors text-sm ${
                              isUntranslated ? 'text-muted-foreground italic' : 'font-mono'
                            }`}
                          >
                            {entry.translated || 'Clicca per tradurre...'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredEntries.length > 200 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Mostrando 200 di {filteredEntries.length.toLocaleString()} stringhe. Usa la ricerca per filtrare.
                    </p>
                  )}
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nessun testo WAD caricato</p>
                  <p className="text-sm mt-2 max-w-md mx-auto">
                    Esegui il comando di estrazione nel terminale, poi carica il JSON risultante.
                  </p>
                  <div className="mt-4 p-3 rounded-lg bg-slate-950/50 border border-slate-800 max-w-lg mx-auto">
                    <code className="text-xs text-emerald-400 font-mono">
                      node scripts/extract-wad-text.mjs &quot;path/to/game.wad&quot; output.json
                    </code>
                  </div>
                  <Button onClick={loadExtractedJson} className="mt-4 bg-emerald-600 hover:bg-emerald-500">
                    <Upload className="w-4 h-4 mr-2" />
                    Carica JSON Estratto
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nessun risultato</p>
                  <p className="text-sm mt-1">Modifica i filtri per vedere piu risultati</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
