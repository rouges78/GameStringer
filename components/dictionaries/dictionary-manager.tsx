'use client';

import { useState, useEffect, useCallback } from 'react';
import { Book, Download, Upload, Trash2, Search, Plus, RefreshCw, HardDrive, CheckCircle, Gamepad2, Languages, Sparkles, Database, Zap, BookOpen, MoreHorizontal, Eye, FolderInput, FileUp, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { listInstalledDictionaries, deleteDictionary, searchInDictionary, addTranslationToDictionary, getDictionariesStats, importDictionaryAuto, exportDictionarySimple, applyDictionaryToXUnity, formatFileSize, formatDate, getLanguageName, getLanguageFlag, type DictionaryInfo, type DictionariesStats } from '@/lib/game-dictionaries';
import { invoke } from '@/lib/tauri-api';
import { open } from '@tauri-apps/plugin-dialog';

export function DictionaryManager() {
  const [dictionaries, setDictionaries] = useState<DictionaryInfo[]>([]);
  const [stats, setStats] = useState<DictionariesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDict, setSelectedDict] = useState<DictionaryInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<[string, string][]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [importFilePath, setImportFilePath] = useState('');
  const [newTrans, setNewTrans] = useState({ original: '', translated: '' });
  const [gamePath, setGamePath] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dicts, s] = await Promise.all([listInstalledDictionaries(), getDictionariesStats()]);
      setDictionaries(dicts); setStats(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Load translations when a dictionary is selected or searched
  useEffect(() => {
    if (!selectedDict) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // If there's a query, search. Otherwise show the first 100 entries
        const results = await searchInDictionary(selectedDict.id, selectedDict.target_language, searchQuery || '', 100);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, searchQuery ? 300 : 0); // No delay if it's the initial load
    return () => clearTimeout(timer);
  }, [searchQuery, selectedDict]);

  const handleDelete = async (d: DictionaryInfo) => {
    if (!confirm('Delete "' + d.game_name + '"?')) return;
    if ((await deleteDictionary(d.id, d.target_language)).success) { toast({ title: 'Deleted' }); loadData(); if (selectedDict?.id === d.id) setSelectedDict(null); }
  };

  const handleImport = async () => {
    if (!importFilePath) {
      toast({ title: 'Error', description: 'Select a JSON file', variant: 'destructive' });
      return;
    }
    const r = await importDictionaryAuto(importFilePath);
    if (r.success) { 
      toast({ title: 'Imported!', description: `${r.entries_loaded} entries loaded` }); 
      setImportDialogOpen(false); 
      setImportFilePath('');
      loadData(); 
    } else {
      toast({ title: 'Error', description: r.message, variant: 'destructive' });
    }
  };

  const handleAdd = async () => {
    if (!selectedDict || !newTrans.original || !newTrans.translated) return;
    if ((await addTranslationToDictionary(selectedDict.id, selectedDict.target_language, newTrans.original, newTrans.translated)).success) {
      toast({ title: 'Added' }); setAddDialogOpen(false); setNewTrans({ original: '', translated: '' }); loadData();
    }
  };

  const handleApply = async () => {
    if (!selectedDict) return;
    
    // Se il dialog è aperto e c'è un path, usa quello
    if (applyDialogOpen && gamePath) {
      const r = await applyDictionaryToXUnity(selectedDict.id, selectedDict.target_language, gamePath);
      if (r.success) { 
        toast({ title: 'Applied!', description: `Dictionary copied to ${gamePath}` }); 
        setApplyDialogOpen(false); 
        setGamePath(''); 
      } else {
        toast({ title: 'Error', description: r.message, variant: 'destructive' });
      }
      return;
    }
    
    // Prova a trovare il percorso automaticamente (silenzioso)
    let path = '';
    try {
      path = await invoke<string>('find_game_install_path', { installDir: selectedDict.game_name });
    } catch { /* not found by name */ }
    
    if (!path) {
      const appId = parseInt(selectedDict.id);
      if (!isNaN(appId)) {
        try {
          path = await invoke<string | null>('find_game_path_by_appid', { appId }) || '';
        } catch { /* not found by appid */ }
      }
    }
    
    if (!path) {
      setApplyDialogOpen(true);
      return;
    }
    
    const r = await applyDictionaryToXUnity(selectedDict.id, selectedDict.target_language, path);
    if (r.success) { 
      toast({ title: 'Applied!', description: `Dictionary copied to ${path}` }); 
    } else {
      toast({ title: 'Error', description: r.message, variant: 'destructive' });
    }
  };

  const pickFile = async () => {
    try {
      const f = await open({ filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (f) setImportFilePath(f as string);
    } catch (e) { console.error(e); }
  };

  const pickFolder = async () => {
    try {
      const f = await open({ directory: true });
      if (f) setGamePath(f as string);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20"><BookOpen className="h-5 w-5 text-indigo-400" /></div>
          <div><h2 className="text-lg font-bold">Translation Dictionaries</h2><p className="text-xs text-indigo-300/70">Pre-loaded translations for games</p></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm bg-black/20 rounded-lg px-3 py-1.5">
            <span className="flex items-center gap-1"><Database className="h-4 w-4 text-blue-400" /><b>{stats?.total_dictionaries||0}</b></span>
            <span className="flex items-center gap-1"><Languages className="h-4 w-4 text-emerald-400" /><b>{stats?.total_entries?.toLocaleString()||0}</b></span>
            <span className="flex items-center gap-1"><HardDrive className="h-4 w-4 text-amber-400" /><b>{stats?.total_size_mb?.toFixed(1)||0}</b>MB</span>
          </div>
          <Button onClick={loadData} variant="ghost" size="icon" disabled={loading}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"><Upload className="h-4 w-4 mr-1.5" />Import</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg border-indigo-500/30 bg-gradient-to-b from-gray-900 to-gray-950">
              <DialogHeader className="pb-4 border-b border-gray-800">
                <DialogTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-indigo-500/20"><FolderInput className="h-5 w-5 text-indigo-400" /></div>
                  Import Dictionary
                </DialogTitle>
                <p className="text-sm text-gray-400 mt-1">Load a JSON file with translations</p>
              </DialogHeader>
              <div className="py-6">
                <div 
                  onClick={pickFile}
                  className="border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-gray-800/30 hover:bg-indigo-500/5"
                >
                  {importFilePath ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                        <CheckCircle className="h-6 w-6 text-emerald-400" />
                      </div>
                      <p className="text-sm font-medium text-emerald-400">File selected</p>
                      <p className="text-xs text-gray-400 truncate max-w-sm mx-auto">{importFilePath}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto">
                        <FolderInput className="h-6 w-6 text-indigo-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-300">Click to select a file</p>
                      <p className="text-xs text-gray-500">File must contain _meta with game_id and game_name</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="pt-4 border-t border-gray-800 gap-2">
                <Button variant="ghost" onClick={()=>{setImportDialogOpen(false);setImportFilePath('');}} className="text-gray-400">Cancel</Button>
                <Button onClick={handleImport} className="bg-indigo-600 hover:bg-indigo-700 px-6" disabled={!importFilePath}>
                  <FileUp className="h-4 w-4 mr-2" />Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-5 border-gray-800 bg-gray-900/50 flex flex-col">
          <CardHeader className="py-3 px-4 border-b border-gray-800"><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-indigo-400" />Installed ({dictionaries.length})</CardTitle></CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-500" /></div>
              : dictionaries.length === 0 ? <div className="flex flex-col items-center py-12"><Book className="h-12 w-12 text-gray-700 mb-3" /><p className="text-gray-400">No dictionaries</p></div>
              : <div className="p-2 space-y-2">{dictionaries.map(d=>(
                <div 
                  key={d.id+d.target_language} 
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-all duration-200",
                    "bg-gradient-to-r from-amber-900/60 to-amber-800/40 border border-amber-600/50",
                    "hover:from-amber-800/70 hover:to-amber-700/50 hover:border-amber-500/70 hover:shadow-lg hover:shadow-amber-900/30",
                    selectedDict?.id===d.id && selectedDict?.target_language===d.target_language && "from-amber-700/70 to-amber-600/50 border-amber-400/80 shadow-lg shadow-amber-900/40"
                  )} 
                  onClick={()=>{setSelectedDict(d);setSearchResults([]);setSearchQuery('');}}
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-amber-200/80 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-amber-100 truncate">{d.game_name}</div>
                      <div className="text-xs text-amber-300/60 mt-0.5">{getLanguageFlag(d.source_language)} → {getLanguageFlag(d.target_language)} • {d.entries_count.toLocaleString()} entries</div>
                    </div>
                    <Badge className="bg-amber-950/50 text-amber-200/80 border-amber-600/30 text-xs">{formatFileSize(d.size_bytes)}</Badge>
                  </div>
                </div>))}</div>}
            </ScrollArea>
          </CardContent>
        </Card>
        <Card className="col-span-7 border-gray-800 bg-gray-900/50 flex flex-col">
          {selectedDict ? <>
            <CardHeader className="py-3 px-4 border-b border-gray-800 flex-row items-center justify-between">
              <div><CardTitle className="text-base flex items-center gap-2"><Gamepad2 className="h-4 w-4 text-indigo-400" />{selectedDict.game_name}</CardTitle><CardDescription className="text-xs mt-0.5">{getLanguageFlag(selectedDict.source_language)} {getLanguageName(selectedDict.source_language)} → {getLanguageFlag(selectedDict.target_language)} {getLanguageName(selectedDict.target_language)}</CardDescription></div>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>exportDictionarySimple(selectedDict.id,selectedDict.target_language,selectedDict.id+'_export.json')}><Download className="h-4 w-4 mr-2" />Export</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-red-400" onClick={()=>handleDelete(selectedDict)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{selectedDict.entries_count.toLocaleString()} entries</span>
                <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">v{selectedDict.version}</span>
                <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">{formatDate(selectedDict.updated_at)}</span>
                <div className="flex-1" />
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}><DialogTrigger asChild><Button variant="ghost" size="sm" className="h-6 px-2 text-xs"><Plus className="h-3 w-3 mr-1" />Add</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add Translation</DialogTitle></DialogHeader><div className="grid gap-3 py-4"><div><label className="text-xs text-gray-400 mb-1 block">Original</label><Textarea value={newTrans.original} onChange={e=>setNewTrans({...newTrans,original:e.target.value})} rows={2} /></div><div><label className="text-xs text-gray-400 mb-1 block">Translation</label><Textarea value={newTrans.translated} onChange={e=>setNewTrans({...newTrans,translated:e.target.value})} rows={2} /></div></div><DialogFooter><Button variant="outline" onClick={()=>setAddDialogOpen(false)}>Cancel</Button><Button onClick={handleAdd}>Save</Button></DialogFooter></DialogContent></Dialog>
                <Button size="sm" className="h-6 px-2 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleApply}><Zap className="h-3 w-3 mr-1" />Apply</Button>
                <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-400" />Game not found</DialogTitle></DialogHeader><div className="py-4"><p className="text-sm text-gray-400 mb-3">Manually select the game folder:</p><div className="flex gap-2"><Input value={gamePath} onChange={e=>setGamePath(e.target.value)} placeholder="Select folder..." className="flex-1" /><Button variant="outline" onClick={pickFolder}><FolderInput className="h-4 w-4" /></Button></div></div><DialogFooter><Button variant="outline" onClick={()=>{setApplyDialogOpen(false);setGamePath('');}}>Cancel</Button><Button onClick={handleApply} disabled={!gamePath} className="bg-indigo-600"><CheckCircle className="h-4 w-4 mr-1.5" />Apply</Button></DialogFooter></DialogContent></Dialog>
              </div>
              <div className="relative"><Input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search translations..." className="bg-gray-800/50 pr-10 h-8 text-sm" />{isSearching ? <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-indigo-400 animate-spin" /> : <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />}</div>
              <div className="flex-1 min-h-0 overflow-auto rounded border border-gray-800 bg-gray-900/30">
                {isSearching?<div className="flex items-center justify-center h-full text-gray-500 text-xs"><RefreshCw className="h-4 w-4 animate-spin mr-2" />Loading...</div>:searchResults.length>0?<table className="w-full text-xs"><tbody>{searchResults.map(([o,t],i)=><tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50"><td className="p-1.5 text-gray-300 w-1/2">{o}</td><td className="p-1.5 w-1/2">{editingIdx===i?<input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={async()=>{if(editValue!==t&&selectedDict){await addTranslationToDictionary(selectedDict.id,selectedDict.target_language,o,editValue);setSearchResults(r=>r.map((x,j)=>j===i?[x[0],editValue]:x));}setEditingIdx(null);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){setEditingIdx(null);}}} className="w-full bg-gray-800 text-emerald-400 px-1 py-0.5 rounded border border-indigo-500 outline-none" />:<span onClick={()=>{setEditingIdx(i);setEditValue(t);}} className="text-emerald-400 cursor-pointer hover:bg-gray-800 px-1 py-0.5 rounded block">{t}</span>}</td></tr>)}</tbody></table>:<div className="flex items-center justify-center h-full text-gray-500 text-xs">{searchQuery?'No results':'Empty dictionary'}</div>}
              </div>
            </CardContent>
          </> : <div className="flex flex-col items-center justify-center h-full"><Eye className="h-12 w-12 text-gray-700 mb-3" /><p className="text-gray-400">Select a dictionary</p></div>}
        </Card>
      </div>
    </div>
  );
}
