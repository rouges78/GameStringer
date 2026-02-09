'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  FolderOpen, 
  Package, 
  FileText, 
  Download, 
  Upload, 
  Search,
  Check,
  X,
  AlertCircle,
  Globe,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Archive,
  FolderOutput
} from 'lucide-react';
import { toast } from 'sonner';
import { WadExtractor } from '@/components/tools/wad-extractor';

interface DanganronpaGame {
  path: string;
  game_type: string;
  pak_files: string[];
}

interface PakEntry {
  name: string;
  offset: number;
  size: number;
}

interface PakArchive {
  path: string;
  entries: PakEntry[];
  pak_type: string;
}

interface PoEntry {
  msgid: string;
  msgstr: string;
  comments: string[];
  context: string | null;
}

interface PoFile {
  path: string;
  entries: PoEntry[];
  header: Record<string, string>;
}

interface PoStats {
  total: number;
  translated: number;
  untranslated: number;
  fuzzy: number;
  percentage: number;
}

interface DratInfo {
  available: boolean;
  download_url: string;
  description: string;
}

interface SteamGameInfo {
  found: boolean;
  path: string;
  game_name: string;
  app_id: string;
  wad_files: WadFileInfo[];
}

interface WadFileInfo {
  name: string;
  path: string;
  size: number;
  is_patched: boolean;
}

interface PatchResult {
  success: boolean;
  message: string;
  backup_path: string | null;
}

interface AllIcePatchInfo {
  team_name: string;
  website: string;
  discord: string;
  patches: AllIcePatch[];
}

interface AllIcePatch {
  game: string;
  version: string;
  release_date: string;
  file_name: string;
  download_url: string;
  notes: string;
}

interface LinDialogue {
  id: string;
  speaker: string;
  original: string;
  translated: string;
  file: string;
  line_index: number;
}

interface LinExtractionResult {
  success: boolean;
  message: string;
  dialogues: LinDialogue[];
  total_count: number;
}

interface LinDialogueStats {
  total: number;
  translated: number;
  untranslated: number;
  percentage: number;
  by_speaker: Record<string, number>;
}

export default function DanganronpaPatcherPage() {
  const [game, setGame] = useState<DanganronpaGame | null>(null);
  const [selectedPak, setSelectedPak] = useState<PakArchive | null>(null);
  const [poFile, setPoFile] = useState<PoFile | null>(null);
  const [poStats, setPoStats] = useState<PoStats | null>(null);
  const [dratInfo, setDratInfo] = useState<DratInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editedTranslation, setEditedTranslation] = useState('');
  const [steamGames, setSteamGames] = useState<SteamGameInfo[]>([]);
  const [selectedSteamGame, setSelectedSteamGame] = useState<SteamGameInfo | null>(null);
  const [backups, setBackups] = useState<WadFileInfo[]>([]);
  const [alliceInfo, setAlliceInfo] = useState<AllIcePatchInfo | null>(null);
  const [applyingPatch, setApplyingPatch] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ zipPath: string; zipSizeMb: number; filesIncluded: string[] } | null>(null);
  const [linDialogues, setLinDialogues] = useState<LinDialogue[]>([]);
  const [linStats, setLinStats] = useState<LinDialogueStats | null>(null);
  const [linSearchTerm, setLinSearchTerm] = useState('');
  const [editingLinId, setEditingLinId] = useState<string | null>(null);
  const [editedLinTranslation, setEditedLinTranslation] = useState('');
  const [extractingLin, setExtractingLin] = useState(false);
  const [linSpeakerFilter, setLinSpeakerFilter] = useState<string>('all');
  const [linViewMode, setLinViewMode] = useState<'full' | 'compact'>('full');
  const [linShowUntranslated, setLinShowUntranslated] = useState(false);
  const [pakFilter, setPakFilter] = useState<'all' | 'translatable'>('translatable');

  // Funzione per determinare se un PAK è traducibile
  const isTranslatablePak = (pakPath: string): boolean => {
    const fileName = pakPath.split('\\').pop()?.toLowerCase() || '';
    // File WAD principali
    if (fileName.endsWith('.wad')) return true;
    // File con _l (localizzati)
    if (fileName.includes('_l.pak')) return true;
    // Script e dialoghi
    if (fileName.startsWith('script') || fileName.startsWith('e0')) return true;
    // Menu e testi di sistema
    if (fileName.includes('menu') || fileName.includes('system') || fileName.includes('text')) return true;
    // Font
    if (fileName.includes('font')) return true;
    return false;
  };

  useEffect(() => {
    loadDratInfo();
    loadAlliceInfo();
    findSteamGames();
  }, []);

  const loadDratInfo = async () => {
    try {
      const info = await invoke<DratInfo>('get_drat_info');
      setDratInfo(info);
    } catch (e) {
      console.error('Errore caricamento info DRAT:', e);
    }
  };

  const loadAlliceInfo = async () => {
    try {
      const info = await invoke<AllIcePatchInfo>('get_allice_patch_info');
      setAlliceInfo(info);
    } catch (e) {
      console.error('Errore caricamento info All-Ice:', e);
    }
  };

  const findSteamGames = async () => {
    try {
      const games = await invoke<SteamGameInfo[]>('find_danganronpa_steam');
      setSteamGames(games);
      if (games.length > 0) {
        setSelectedSteamGame(games[0]);
        loadBackups(games[0].path);
      }
    } catch (e) {
      console.error('Errore ricerca giochi Steam:', e);
    }
  };

  const loadBackups = async (gamePath: string) => {
    try {
      const backupList = await invoke<WadFileInfo[]>('list_danganronpa_backups', { gamePath });
      setBackups(backupList);
    } catch (e) {
      console.error('Errore caricamento backup:', e);
    }
  };

  const selectPatchFile = async () => {
    if (!selectedSteamGame) {
      toast.error('Seleziona prima un gioco');
      return;
    }
    
    try {
      const selected = await open({
        filters: [{ name: 'WAD Files', extensions: ['wad'] }],
        title: 'Seleziona file patch WAD',
      });
      
      if (selected && typeof selected === 'string') {
        setApplyingPatch(true);
        const result = await invoke<PatchResult>('apply_danganronpa_patch', {
          patchFile: selected,
          gamePath: selectedSteamGame.path,
          createBackup: true,
        });
        
        if (result.success) {
          toast.success(result.message);
          if (result.backup_path) {
            toast.info('Backup creato automaticamente');
          }
          loadBackups(selectedSteamGame.path);
          findSteamGames(); // Refresh
        } else {
          toast.error(result.message);
        }
      }
    } catch (e) {
      toast.error(`Errore: ${e}`);
    } finally {
      setApplyingPatch(false);
    }
  };

  const restoreBackup = async (backupPath: string) => {
    if (!selectedSteamGame) return;
    
    try {
      setApplyingPatch(true);
      const result = await invoke<PatchResult>('restore_danganronpa_backup', {
        backupFile: backupPath,
        gamePath: selectedSteamGame.path,
      });
      
      if (result.success) {
        toast.success(result.message);
        findSteamGames();
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(`Errore ripristino: ${e}`);
    } finally {
      setApplyingPatch(false);
    }
  };

  const exportPatch = async () => {
    if (!selectedSteamGame) {
      toast.error('Seleziona prima un gioco');
      return;
    }

    try {
      const outputPath = await save({
        defaultPath: 'Danganronpa_ITA_Patch_GameStringer.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        title: 'Salva Patch Distribuibile',
      });

      if (!outputPath) return;

      setExporting(true);
      setExportResult(null);
      toast.info('Creazione ZIP in corso... (~626 MB, potrebbe richiedere qualche minuto)');

      const result = await invoke<{ success: boolean; zip_path: string; zip_size_mb: number; files_included: string[] }>('export_danganronpa_patch', {
        gamePath: selectedSteamGame.path,
        outputPath: outputPath,
      });

      if (result.success) {
        setExportResult({
          zipPath: result.zip_path,
          zipSizeMb: result.zip_size_mb,
          filesIncluded: result.files_included,
        });
        toast.success(`ZIP creato! ${result.zip_size_mb.toFixed(1)} MB`);
      }
    } catch (e) {
      toast.error(`Errore export: ${e}`);
    } finally {
      setExporting(false);
    }
  };

  const openLinFile = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'LIN Files', extensions: ['lin'] }],
        title: 'Seleziona file LIN (script Danganronpa)',
      });
      
      if (selected && typeof selected === 'string') {
        setExtractingLin(true);
        const result = await invoke<LinExtractionResult>('extract_lin_dialogues', {
          linPath: selected,
        });
        
        if (result.success) {
          setLinDialogues(result.dialogues);
          updateLinStats(result.dialogues);
          toast.success(`Estratti ${result.total_count} dialoghi`);
        } else {
          toast.error(result.message);
        }
      }
    } catch (e) {
      toast.error(`Errore estrazione LIN: ${e}`);
    } finally {
      setExtractingLin(false);
    }
  };

  const updateLinStats = async (dialogues: LinDialogue[]) => {
    try {
      const stats = await invoke<LinDialogueStats>('get_lin_dialogue_stats', { dialogues });
      setLinStats(stats);
    } catch (e) {
      console.error('Errore calcolo stats LIN:', e);
    }
  };

  const saveLinDialogues = async () => {
    try {
      const filePath = await open({
        directory: true,
        title: 'Seleziona cartella destinazione',
      });
      
      if (filePath) {
        const outputPath = `${filePath}/danganronpa_dialogues.json`;
        const count = await invoke<number>('save_lin_dialogues', {
          outputPath,
          dialogues: linDialogues,
        });
        toast.success(`Salvati ${count} dialoghi`);
      }
    } catch (e) {
      toast.error(`Errore salvataggio: ${e}`);
    }
  };

  const loadLinDialogues = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        title: 'Carica dialoghi',
      });
      
      if (filePath && typeof filePath === 'string') {
        const dialogues = await invoke<LinDialogue[]>('load_lin_dialogues', {
          inputPath: filePath,
        });
        setLinDialogues(dialogues);
        updateLinStats(dialogues);
        toast.success(`Caricati ${dialogues.length} dialoghi`);
      }
    } catch (e) {
      toast.error(`Errore caricamento: ${e}`);
    }
  };

  const updateLinDialogue = (id: string, translation: string) => {
    const updated = linDialogues.map(d => 
      d.id === id ? { ...d, translated: translation } : d
    );
    setLinDialogues(updated);
    setEditingLinId(null);
    updateLinStats(updated);
  };

  const translateWithAI = async () => {
    const untranslated = linDialogues.filter(d => !d.translated);
    if (untranslated.length === 0) {
      toast.info('Tutti i dialoghi sono già tradotti');
      return;
    }

    setLoading(true);
    let translatedCount = 0;
    const batchSize = 5;
    
    try {
      const toTranslate = untranslated.slice(0, 50); // Max 50 alla volta
      toast.info(`Traduzione di ${toTranslate.length} dialoghi in corso...`);
      
      for (let i = 0; i < toTranslate.length; i += batchSize) {
        const batch = toTranslate.slice(i, i + batchSize);
        
        const translations = await Promise.all(
          batch.map(async (dialogue) => {
            try {
              const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: dialogue.original,
                  sourceLanguage: 'en',
                  targetLanguage: 'it',
                  context: `Videogioco Danganronpa. Personaggio: ${dialogue.speaker}. Mantieni il tono originale.`
                })
              });
              
              if (response.ok) {
                const data = await response.json();
                return { id: dialogue.id, translation: data.translatedText };
              }
              return null;
            } catch {
              return null;
            }
          })
        );
        
        // Aggiorna i dialoghi tradotti
        const validTranslations = translations.filter(t => t !== null);
        if (validTranslations.length > 0) {
          setLinDialogues(prev => {
            const newDialogues = prev.map(d => {
              const found = validTranslations.find(t => t?.id === d.id);
              if (found) {
                translatedCount++;
                return { ...d, translated: found.translation };
              }
              return d;
            });
            updateLinStats(newDialogues);
            return newDialogues;
          });
        }
        
        // Piccola pausa tra batch per non sovraccaricare l'API
        if (i + batchSize < toTranslate.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      toast.success(`Tradotti ${translatedCount} dialoghi con AI`);
    } catch (e) {
      toast.error(`Errore traduzione: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const importFromDrat = async () => {
    try {
      if (linDialogues.length === 0) {
        toast.error('Prima carica un file LIN');
        return;
      }
      
      const filePath = await open({
        filters: [
          { name: 'DRAT Export', extensions: ['json', 'txt'] }
        ],
        title: 'Importa traduzioni da DRAT',
      });
      
      if (filePath && typeof filePath === 'string') {
        const [updated, result] = await invoke<[LinDialogue[], { success: boolean; message: string; matched_count: number }]>(
          'import_drat_translations',
          { dratPath: filePath, dialogues: linDialogues }
        );
        
        setLinDialogues(updated);
        updateLinStats(updated);
        
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.warning(result.message);
        }
      }
    } catch (e) {
      toast.error(`Errore import: ${e}`);
    }
  };

  const filteredLinDialogues = linDialogues.filter(d => {
    const matchesSearch = linSearchTerm === '' || 
      d.original.toLowerCase().includes(linSearchTerm.toLowerCase()) ||
      d.translated.toLowerCase().includes(linSearchTerm.toLowerCase()) ||
      d.speaker.toLowerCase().includes(linSearchTerm.toLowerCase());
    const matchesSpeaker = linSpeakerFilter === 'all' || d.speaker === linSpeakerFilter;
    const matchesUntranslated = !linShowUntranslated || !d.translated;
    return matchesSearch && matchesSpeaker && matchesUntranslated;
  }
  );

  const selectGameFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Seleziona cartella gioco Danganronpa',
      });
      
      if (selected) {
        setLoading(true);
        const detected = await invoke<DanganronpaGame>('detect_danganronpa_game', {
          gamePath: selected,
        });
        setGame(detected);
        setSelectedPak(null);
        setPoFile(null);
        toast.success(`Rilevato: ${getGameTypeName(detected.game_type)}`);
      }
    } catch (e) {
      toast.error(`Errore: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const getGameTypeName = (type: string): string => {
    switch (type) {
      case 'TriggerHappyHavoc': return 'Danganronpa: Trigger Happy Havoc';
      case 'GoodbyeDespair': return 'Danganronpa 2: Goodbye Despair';
      case 'AnotherEpisode': return 'Danganronpa Another Episode';
      default: return 'Danganronpa (Sconosciuto)';
    }
  };

  const selectPakFile = async (pakPath: string) => {
    try {
      setLoading(true);
      const archive = await invoke<PakArchive>('read_pak_archive', { pakPath });
      setSelectedPak(archive);
      toast.success(`PAK caricato: ${archive.entries.length} file`);
    } catch (e) {
      toast.error(`Errore lettura PAK: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const extractAllPak = async () => {
    if (!selectedPak) return;
    
    try {
      const outputDir = await open({
        directory: true,
        title: 'Seleziona cartella di destinazione',
      });
      
      if (outputDir) {
        setLoading(true);
        const count = await invoke<number>('extract_all_pak', {
          pakPath: selectedPak.path,
          outputDir,
        });
        toast.success(`Estratti ${count} file`);
      }
    } catch (e) {
      toast.error(`Errore estrazione: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const openPoFile = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'PO Files', extensions: ['po', 'pot'] }],
        title: 'Seleziona file PO',
      });
      
      if (selected && typeof selected === 'string') {
        setLoading(true);
        const po = await invoke<PoFile>('read_po_file', { poPath: selected });
        const stats = await invoke<PoStats>('get_po_stats', { poPath: selected });
        setPoFile(po);
        setPoStats(stats);
        toast.success(`PO caricato: ${po.entries.length} entry`);
      }
    } catch (e) {
      toast.error(`Errore lettura PO: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const savePoFile = async () => {
    if (!poFile) return;
    
    try {
      setLoading(true);
      await invoke('write_po_file', {
        poPath: poFile.path,
        entries: poFile.entries,
      });
      
      const stats = await invoke<PoStats>('get_po_stats', { poPath: poFile.path });
      setPoStats(stats);
      
      toast.success('File PO salvato');
    } catch (e) {
      toast.error(`Errore salvataggio: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (index: number, newMsgstr: string) => {
    if (!poFile) return;
    
    const newEntries = [...poFile.entries];
    newEntries[index] = { ...newEntries[index], msgstr: newMsgstr };
    setPoFile({ ...poFile, entries: newEntries });
    setEditingEntry(null);
  };

  const filteredEntries = poFile?.entries.filter(entry => 
    entry.msgid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.msgstr.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getPakTypeBadge = (type: string) => {
    switch (type) {
      case 'Text': return <Badge variant="default">Testi</Badge>;
      case 'Script': return <Badge variant="secondary">Script</Badge>;
      case 'Font': return <Badge variant="outline">Font</Badge>;
      case 'Texture': return <Badge className="bg-purple-500">Texture</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-2 overflow-y-auto">
      {/* Hero Header - Stile Unity Bundle */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-2.5 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-black/30 rounded-md shadow-lg shadow-black/40 border border-white/10">
              <Package className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">Visual Novel Patcher</h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Estrai e traduci file PAK/PO di visual novel</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {dratInfo && (
              dratInfo.available ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-sm font-bold text-white">DRAT</span>
                  <span className="text-[10px] text-white/70">Installato</span>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="bg-black/30 border-white/20 text-white hover:bg-black/50" asChild>
                  <a href={dratInfo.download_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Scarica DRAT
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Game Selection */}
      <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
        <CardHeader className="py-1.5 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <FolderOpen className="w-3 h-3 text-emerald-400" />
              Seleziona Gioco
            </CardTitle>
            <span className="text-[10px] text-muted-foreground">Seleziona la cartella di installazione del gioco</span>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-2">
          {!game ? (
            <Button onClick={selectGameFolder} disabled={loading} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500">
              {loading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FolderOpen className="w-3 h-3 mr-2" />}
              Sfoglia
            </Button>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold">{getGameTypeName(game.game_type)}</h3>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[500px]">{game.path}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{game.pak_files.length} PAK</Badge>
                  <Button variant="outline" size="sm" onClick={selectGameFolder} className="h-7 w-7 p-0">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="pak" className="space-y-1.5 flex-1">
        <TabsList className="bg-slate-900/50 border border-slate-800/50">
          <TabsTrigger value="pak" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Package className="w-3 h-3" />
            File PAK
          </TabsTrigger>
          <TabsTrigger value="po" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <FileText className="w-3 h-3" />
            Traduzioni PO
          </TabsTrigger>
          <TabsTrigger value="patch" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Download className="w-3 h-3" />
            Applica Patch
          </TabsTrigger>
          <TabsTrigger value="lin" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <FileText className="w-3 h-3" />
            Script LIN
          </TabsTrigger>
          <TabsTrigger value="wad-extract" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Search className="w-3 h-3" />
            WAD Extractor
          </TabsTrigger>
        </TabsList>

        {/* PAK Tab */}
        <TabsContent value="pak" className="space-y-1.5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* PAK List */}
            <Card className="lg:col-span-1 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Package className="w-3 h-3 text-emerald-400" />
                  File PAK
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <div className="flex gap-1 mb-2">
                  <Button
                    size="sm"
                    variant={pakFilter === 'translatable' ? 'default' : 'outline'}
                    onClick={() => setPakFilter('translatable')}
                    className="h-6 text-xs"
                  >
                    <Globe className="w-3 h-3 mr-1" />
                    Traducibili ({game?.pak_files.filter(isTranslatablePak).length || 0})
                  </Button>
                  <Button
                    size="sm"
                    variant={pakFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setPakFilter('all')}
                    className="h-6 text-xs"
                  >
                    Tutti ({game?.pak_files.length || 0})
                  </Button>
                </div>
                <ScrollArea className="h-[300px]">
                  {game?.pak_files.length ? (
                    <div className="space-y-1">
                      {game.pak_files
                        .filter(pak => pakFilter === 'all' || isTranslatablePak(pak))
                        .map((pak, i) => {
                        const fileName = pak.split('\\').pop() || pak;
                        const isSelected = selectedPak?.path === pak;
                        
                        return (
                          <button
                            key={i}
                            onClick={() => selectPakFile(pak)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-all border ${
                              isSelected ? 'bg-emerald-500/20 border-emerald-500/40' : 'hover:bg-slate-800/50 border-transparent'
                            }`}
                          >
                            <span className="truncate">{fileName}</span>
                            {isSelected && <ChevronRight className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Seleziona un gioco</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* PAK Contents */}
            <Card className="lg:col-span-2 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
              <CardHeader className="py-1.5 px-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-emerald-400" />
                      Contenuto PAK
                    </CardTitle>
                    {selectedPak && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {getPakTypeBadge(selectedPak.pak_type)}
                        <span>{selectedPak.entries.length} file</span>
                      </div>
                    )}
                  </div>
                  {selectedPak && (
                    <Button onClick={extractAllPak} disabled={loading} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500">
                      {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                      Estrai
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <ScrollArea className="h-[300px]">
                  {selectedPak?.entries.length ? (
                    <div className="space-y-1">
                      {selectedPak.entries.map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50"
                        >
                          <span className="text-sm font-mono">{entry.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(entry.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Seleziona un file PAK</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PO Tab */}
        <TabsContent value="po" className="space-y-1.5">
          {/* PO Stats */}
          {poStats && (
            <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
              <CardContent className="pt-2 px-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-lg font-bold">{poStats.percentage}%</p>
                      <p className="text-[10px] text-muted-foreground">Completato</p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>{poStats.translated} tradotte</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <X className="w-4 h-4 text-red-500" />
                        <span>{poStats.untranslated} mancanti</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span>{poStats.fuzzy} fuzzy</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={openPoFile} size="sm" className="h-8">
                      <Upload className="w-3 h-3 mr-1" />
                      Apri
                    </Button>
                    {poFile && (
                      <Button onClick={savePoFile} disabled={loading} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500">
                        {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                        Salva
                      </Button>
                    )}
                  </div>
                </div>
                <Progress value={poStats.percentage} className="h-2 bg-slate-800" />
              </CardContent>
            </Card>
          )}

          {/* PO Editor */}
          <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex-1">
            <CardHeader className="py-1.5 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-emerald-400" />
                  Editor Traduzioni
                </CardTitle>
                {!poFile && (
                  <Button onClick={openPoFile} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500">
                    <Upload className="w-3 h-3 mr-1" />
                    Apri PO
                  </Button>
                )}
              </div>
              {poFile && (
                <div className="mt-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca testi..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-3 pb-2">
              <ScrollArea className="h-[350px]">
                {filteredEntries.length ? (
                  <div className="space-y-4">
                    {filteredEntries.map((entry, i) => {
                      const originalIndex = poFile!.entries.indexOf(entry);
                      const isEditing = editingEntry === originalIndex;
                      const isUntranslated = !entry.msgstr || entry.msgstr.startsWith('[TODO]');
                      
                      if (entry.msgid === '') return null; // Skip header
                      
                      return (
                        <div
                          key={i}
                          className={`p-4 rounded-lg border ${isUntranslated ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border'}`}
                        >
                          {/* Original */}
                          <div className="mb-3">
                            <label className="text-xs font-medium text-muted-foreground uppercase">
                              Originale
                            </label>
                            <p className="text-sm mt-1 font-mono bg-slate-950/50 p-2 rounded border border-slate-800">
                              {entry.msgid}
                            </p>
                          </div>
                          
                          {/* Translation */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase">
                              Traduzione
                            </label>
                            {isEditing ? (
                              <div className="mt-1 space-y-2">
                                <Textarea
                                  value={editedTranslation}
                                  onChange={(e) => setEditedTranslation(e.target.value)}
                                  className="font-mono text-sm bg-slate-950/50 border-slate-700"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateEntry(originalIndex, editedTranslation)}
                                    className="h-7 bg-emerald-600 hover:bg-emerald-500"
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Salva
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingEntry(null)}
                                    className="h-7"
                                  >
                                    Annulla
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingEntry(originalIndex);
                                  setEditedTranslation(entry.msgstr);
                                }}
                                className={`mt-1 p-2 rounded cursor-pointer hover:bg-slate-800/50 transition-colors text-sm ${
                                  isUntranslated ? 'text-muted-foreground italic' : 'font-mono'
                                }`}
                              >
                                {entry.msgstr || 'Clicca per tradurre...'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Nessun file PO caricato</p>
                    <p className="text-xs mt-1">Apri un file PO per iniziare</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patch Tab */}
        <TabsContent value="patch" className="space-y-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Steam Games */}
            <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-emerald-400" />
                  Giochi Steam Rilevati
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">
                    {steamGames.length > 0 
                      ? `${steamGames.length} trovati`
                      : 'Nessuno'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <ScrollArea className="h-[120px]">
                  {steamGames.length > 0 ? (
                    <div className="space-y-2">
                      {steamGames.map((sg, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setSelectedSteamGame(sg);
                            loadBackups(sg.path);
                          }}
                          className={`p-2 rounded-md border cursor-pointer transition-all ${
                            selectedSteamGame?.app_id === sg.app_id
                              ? 'bg-emerald-500/20 border-emerald-500/40'
                              : 'hover:bg-slate-800/50 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{sg.game_name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {sg.wad_files.length} WAD
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">
                            {sg.path}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Nessun gioco trovato</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Apply Patch */}
            <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Download className="w-3 h-3 text-emerald-400" />
                  Applica Patch Italiana
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2 space-y-2">
                <Button 
                  onClick={selectPatchFile} 
                  disabled={!selectedSteamGame || applyingPatch}
                  size="sm"
                  className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-xs"
                >
                  {applyingPatch ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Seleziona File WAD Patch
                </Button>

                {selectedSteamGame && selectedSteamGame.wad_files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">File WAD attuali:</p>
                    {selectedSteamGame.wad_files.map((wad, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                        <span className="text-xs font-mono">{wad.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {(wad.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                          {wad.is_patched && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">
                              <Check className="w-2.5 h-2.5 mr-1" />
                              Patchato
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Backups & All-Ice Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Backups */}
            <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  Backup Disponibili
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <ScrollArea className="h-[100px]">
                  {backups.length > 0 ? (
                    <div className="space-y-2">
                      {backups.map((backup, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                          <div>
                            <span className="text-xs font-mono">{backup.name}</span>
                            <p className="text-[10px] text-muted-foreground">
                              {(backup.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreBackup(backup.path)}
                            disabled={applyingPatch}
                            className="h-7 text-xs"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Ripristina
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-muted-foreground">
                      <p className="text-xs">Nessun backup</p>
                      <p className="text-[10px] mt-0.5">Creati automaticamente</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* All-Ice Team Info */}
            {alliceInfo && (
              <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
                <CardHeader className="py-1.5 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-emerald-400" />
                    {alliceInfo.team_name}
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">Team traduzione ufficiale</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2 space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <a href={alliceInfo.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-3 h-3 mr-1" />
                        Sito Web
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <a href={alliceInfo.discord} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Discord
                      </a>
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Patch disponibili:</p>
                    {alliceInfo.patches.map((patch, i) => (
                      <div key={i} className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{patch.game}</span>
                          <Badge variant="outline" className="text-[10px]">v{patch.version}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{patch.notes}</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-6 p-0 text-[10px] text-emerald-400"
                          asChild
                        >
                          <a href={patch.download_url} target="_blank" rel="noopener noreferrer">
                            Scarica ({patch.file_name})
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Export Patch Distribuibile */}
          <Card className="border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 to-slate-950/30">
            <CardHeader className="py-1.5 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Archive className="w-3 h-3 text-emerald-400" />
                Esporta Patch Distribuibile
                <span className="text-[10px] font-normal text-muted-foreground ml-1">.zip con WAD, installer e istruzioni</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2 space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  onClick={exportPatch}
                  disabled={!selectedSteamGame || exporting}
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-500 text-xs"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4 mr-2" />
                  )}
                  {exporting ? 'Creazione ZIP...' : 'Esporta .zip'}
                </Button>
                {!selectedSteamGame && (
                  <span className="text-xs text-muted-foreground">
                    Seleziona prima un gioco dalla lista Steam
                  </span>
                )}
              </div>

              {exporting && (
                <div className="space-y-2">
                  <Progress value={undefined} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Compressione WAD (~626 MB)... potrebbe richiedere qualche minuto
                  </p>
                </div>
              )}

              {exportResult && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">ZIP creato con successo!</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground truncate">
                      <span className="text-emerald-400/70">Percorso:</span> {exportResult.zipPath}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="text-emerald-400/70">Dimensione:</span> {exportResult.zipSizeMb.toFixed(1)} MB
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {exportResult.filesIncluded.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground space-y-1 p-2 rounded bg-slate-950/50 border border-slate-800">
                <p className="font-medium text-slate-400">Contenuto dello ZIP:</p>
                <p>&#x2022; <span className="text-emerald-400/70">dr1_data_keyboard_us.wad</span> — WAD patchato italiano</p>
                <p>&#x2022; <span className="text-emerald-400/70">install.bat</span> — Installer automatico Steam</p>
                <p>&#x2022; <span className="text-emerald-400/70">LEGGIMI.txt</span> — Istruzioni installazione</p>
                <p>&#x2022; <span className="text-emerald-400/70">translations.json</span> — Traduzioni sorgente</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIN Tab */}
        <TabsContent value="lin" className="space-y-1.5">
          {/* LIN Stats */}
          {linStats && linStats.total > 0 && (
            <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
              <CardContent className="pt-2 px-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{linStats.percentage}%</p>
                      <p className="text-[10px] text-muted-foreground">Completato</p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>{linStats.translated} tradotte</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <X className="w-4 h-4 text-red-500" />
                        <span>{linStats.untranslated} mancanti</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(linStats.by_speaker).slice(0, 5).map(([speaker, count]) => (
                        <Badge key={speaker} variant="outline" className="text-[10px]">
                          {speaker}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="default" 
                      onClick={translateWithAI} 
                      disabled={loading || linDialogues.filter(d => !d.translated).length === 0}
                      size="sm" 
                      className="h-8 bg-purple-600 hover:bg-purple-500"
                    >
                      {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Globe className="w-3 h-3 mr-1" />}
                      Traduci con AI
                    </Button>
                    <Button variant="outline" onClick={importFromDrat} size="sm" className="h-8">
                      <Upload className="w-3 h-3 mr-1" />
                      Import DRAT
                    </Button>
                    <Button variant="outline" onClick={loadLinDialogues} size="sm" className="h-8">
                      <Upload className="w-3 h-3 mr-1" />
                      Carica JSON
                    </Button>
                    <Button onClick={saveLinDialogues} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500">
                      <Download className="w-3 h-3 mr-1" />
                      Salva
                    </Button>
                  </div>
                </div>
                <Progress value={linStats.percentage} className="h-2 bg-slate-800" />
              </CardContent>
            </Card>
          )}

          {/* LIN Editor */}
          <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex-1">
            <CardHeader className="py-1.5 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-emerald-400" />
                  Dialoghi Script LIN
                  {linDialogues.length > 0 && (
                    <Badge variant="outline" className="ml-2">{filteredLinDialogues.length} / {linDialogues.length}</Badge>
                  )}
                </CardTitle>
                <Button onClick={openLinFile} disabled={extractingLin} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500">
                  {extractingLin ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                  Apri .LIN
                </Button>
              </div>
              {linDialogues.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca dialoghi o personaggi..."
                        value={linSearchTerm}
                        onChange={(e) => setLinSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <select
                      value={linSpeakerFilter}
                      onChange={(e) => setLinSpeakerFilter(e.target.value)}
                      className="h-9 px-3 rounded-md border border-slate-700 bg-slate-900 text-sm"
                    >
                      <option value="all">Tutti i personaggi</option>
                      {linStats && Object.keys(linStats.by_speaker).map(speaker => (
                        <option key={speaker} value={speaker}>{speaker}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={linShowUntranslated}
                        onChange={(e) => setLinShowUntranslated(e.target.checked)}
                        className="rounded border-slate-700"
                      />
                      Solo non tradotti
                    </label>
                    <div className="flex gap-1 ml-auto">
                      <Button
                        size="sm"
                        variant={linViewMode === 'full' ? 'default' : 'outline'}
                        onClick={() => setLinViewMode('full')}
                        className="h-7 px-2"
                      >
                        Espansa
                      </Button>
                      <Button
                        size="sm"
                        variant={linViewMode === 'compact' ? 'default' : 'outline'}
                        onClick={() => setLinViewMode('compact')}
                        className="h-7 px-2"
                      >
                        Compatta
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-3 pb-2">
              <ScrollArea className="h-[320px]">
                {filteredLinDialogues.length > 0 ? (
                  <div className="space-y-3">
                    {filteredLinDialogues.slice(0, 100).map((dialogue) => {
                      const isEditing = editingLinId === dialogue.id;
                      const isUntranslated = !dialogue.translated;
                      
                      // Vista compatta
                      if (linViewMode === 'compact' && !isEditing) {
                        return (
                          <div
                            key={dialogue.id}
                            onClick={() => {
                              setEditingLinId(dialogue.id);
                              setEditedLinTranslation(dialogue.translated);
                            }}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-slate-800/30 transition-colors ${
                              isUntranslated ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-800/50'
                            }`}
                          >
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] shrink-0">
                              {dialogue.speaker}
                            </Badge>
                            <span className="text-xs font-mono truncate flex-1 text-muted-foreground">
                              {dialogue.original.substring(0, 50)}{dialogue.original.length > 50 ? '...' : ''}
                            </span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className={`text-xs truncate flex-1 ${isUntranslated ? 'italic text-yellow-500/70' : ''}`}>
                              {dialogue.translated || '(da tradurre)'}
                            </span>
                          </div>
                        );
                      }
                      
                      // Vista espansa (default)
                      return (
                        <div
                          key={dialogue.id}
                          className={`p-3 rounded-lg border ${isUntranslated ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-800'}`}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-2">
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              {dialogue.speaker}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {dialogue.file} #{dialogue.line_index}
                            </span>
                          </div>
                          
                          {/* Original */}
                          <div className="mb-2">
                            <p className="text-sm font-mono bg-slate-950/50 p-2 rounded border border-slate-800">
                              {dialogue.original}
                            </p>
                          </div>
                          
                          {/* Translation */}
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editedLinTranslation}
                                onChange={(e) => setEditedLinTranslation(e.target.value)}
                                className="font-mono text-sm bg-slate-950/50 border-slate-700"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateLinDialogue(dialogue.id, editedLinTranslation)}
                                  className="h-7 bg-emerald-600 hover:bg-emerald-500"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Salva
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingLinId(null)}
                                  className="h-7"
                                >
                                  Annulla
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingLinId(dialogue.id);
                                setEditedLinTranslation(dialogue.translated);
                              }}
                              className={`p-2 rounded cursor-pointer hover:bg-slate-800/50 transition-colors text-sm ${
                                isUntranslated ? 'text-muted-foreground italic' : 'font-mono'
                              }`}
                            >
                              {dialogue.translated || 'Clicca per tradurre...'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredLinDialogues.length > 100 && (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        Mostrando 100 di {filteredLinDialogues.length} dialoghi. Usa la ricerca per filtrare.
                      </p>
                    )}
                  </div>
                ) : linDialogues.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Nessun file LIN caricato</p>
                    <p className="text-xs mt-1">Estrai i file .LIN dal WAD con DRAT</p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nessun risultato</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        {/* WAD Extractor Tab */}
        <TabsContent value="wad-extract" className="space-y-1.5">
          <WadExtractor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
