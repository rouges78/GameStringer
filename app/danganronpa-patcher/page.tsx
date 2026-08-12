'use client';

import { useState, useEffect, useCallback } from 'react';
import { translateSingleSmart } from '@/lib/ai/ai-translate-direct';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { WadExtractor } from '@/components/tools/wad-extractor';
import { useTranslation } from '@/lib/i18n';
import { generatePOString, entriesToGeneric, type PoMetadata } from '@/lib/po-export';
import { WizardStepper, type WizardStep } from '@/components/ui/wizard-stepper';
import { clientLogger } from '@/lib/client-logger';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

interface DanganronpaGame {
  path: string;
  game_type: string;
  pak_files: string[];
}

interface PakEntry {
  name: string;
  /** Offset ASSOLUTO dall'inizio del file (rebasato dal backend). */
  offset: number;
  size: number;
  /**
   * `false` = la voce si vede nell'elenco ma NON si può estrarre, perché per
   * quel formato non conosciamo la posizione dei dati (oggi: i `.cpk`).
   * Prima del 12/08/2026 questo campo non esisteva e l'estrazione produceva
   * file VUOTI senza errore: vedi la nota su `PakEntry` in danganronpa_patcher.rs.
   */
  extractable: boolean;
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
  const { t } = useTranslation();
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
  const [targetLanguage, setTargetLanguage] = useState('en');
  useDefaultTargetLang(setTargetLanguage);

  useEffect(() => {
    const saved = localStorage.getItem('gameStringerSettings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.translation?.defaultTargetLang) setTargetLanguage(s.translation.defaultTargetLang);
      } catch {}
    }
  }, []);

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
    } catch (e: unknown) {
      clientLogger.error(t('danganronpaPatcher.errLoadDrat'), e);
    }
  };

  const loadAlliceInfo = async () => {
    try {
      const info = await invoke<AllIcePatchInfo>('get_allice_patch_info');
      setAlliceInfo(info);
    } catch (e: unknown) {
      clientLogger.error(t('danganronpaPatcher.errLoadAllIce'), e);
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
    } catch (e: unknown) {
      clientLogger.error(t('danganronpaPatcher.errSearchSteam'), e);
    }
  };

  const loadBackups = async (gamePath: string) => {
    try {
      const backupList = await invoke<WadFileInfo[]>('list_danganronpa_backups', { gamePath });
      setBackups(backupList);
    } catch (e: unknown) {
      clientLogger.error(t('danganronpaPatcher.errLoadBackup'), e);
    }
  };

  const selectPatchFile = async () => {
    if (!selectedSteamGame) {
      toast.error(t('common.selezionaPrimaUnGioco'));
      return;
    }
    
    try {
      const selected = await open({
        filters: [{ name: 'WAD Files', extensions: ['wad'] }],
        title: t('common.selezionaFilePatchWad'),
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
            toast.info(t('common.backupCreatoAutomaticamente'));
          }
          loadBackups(selectedSteamGame.path);
          findSteamGames(); // Refresh
        } else {
          toast.error(result.message);
        }
      }
    } catch (e: unknown) {
      toast.error(`${t('common.error')}: ${e}`);
    } finally {
      setApplyingPatch(false);
    }
  };

  // Ciclo IN-APP (09/08/2026): ricostruisce i WAD con le traduzioni
  // GameStringer (rebuild .lin a lunghezza variabile, zero troncamenti).
  // Prima il repack esisteva solo negli script Node fuori dalla app.
  const rebuildWad = async () => {
    if (!selectedSteamGame) {
      toast.error(t('common.selezionaPrimaUnGioco'));
      return;
    }
    setApplyingPatch(true);
    const tid = toast.loading(t('danganronpaPatcher.rebuildingWad'));
    try {
      const r = await invoke<{
        success: boolean; wads_rebuilt: string[]; lin_files_rebuilt: number;
        strings_written: number; strings_matched_by_text: number;
        strings_skipped_mismatch: number; strings_missing_translation: number;
        verified_sample: number; verified_sample_total: number;
      }>('rebuild_danganronpa_wad', { gamePath: selectedSteamGame.path });
      const detail = `${r.wads_rebuilt.join(', ')} · ${r.lin_files_rebuilt} .lin · ${r.strings_written} ${t('danganronpaPatcher.rebuildStrings')}`
        + (r.strings_skipped_mismatch > 0 ? ` · ${r.strings_skipped_mismatch} mismatch` : '')
        + ` · verifica ${r.verified_sample}/${r.verified_sample_total}`;
      if (r.success) {
        toast.success(t('danganronpaPatcher.rebuildDone'), { id: tid, description: detail });
      } else {
        // Contatori onesti anche quando qualcosa non torna
        toast.warning(t('danganronpaPatcher.rebuildPartial'), { id: tid, description: detail });
      }
      loadBackups(selectedSteamGame.path);
    } catch (e: unknown) {
      toast.error(t('danganronpaPatcher.rebuildError'), { id: tid, description: String(e).slice(0, 180) });
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
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorRestore')} ${e}`);
    } finally {
      setApplyingPatch(false);
    }
  };

  const exportPatch = async () => {
    if (!selectedSteamGame) {
      toast.error(t('common.selezionaPrimaUnGioco'));
      return;
    }

    try {
      const outputPath = await save({
        defaultPath: 'Danganronpa_ITA_Patch_GameStringer.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        title: t('common.salvaPatchDistribuibile'),
      });

      if (!outputPath) return;

      setExporting(true);
      setExportResult(null);
      toast.info(t('danganronpaPatcher.creatingZip'));

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
        toast.success(`${t('danganronpaPatcher.zipCreatedShort')} ${result.zip_size_mb.toFixed(1)} MB`);
      }
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorExport')} ${e}`);
    } finally {
      setExporting(false);
    }
  };

  const openLinFile = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'LIN Files', extensions: ['lin'] }],
        title: t('danganronpaPatcher.selectLinFile'),
      });
      
      if (selected && typeof selected === 'string') {
        setExtractingLin(true);
        const result = await invoke<LinExtractionResult>('extract_lin_dialogues', {
          linPath: selected,
        });
        
        if (result.success) {
          setLinDialogues(result.dialogues);
          updateLinStats(result.dialogues);
          toast.success(`${t('danganronpaPatcher.extractedLabel')} ${result.total_count} ${t('danganronpaPatcher.dialoguesLabel')}`);
        } else {
          toast.error(result.message);
        }
      }
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorLinExtraction')} ${e}`);
    } finally {
      setExtractingLin(false);
    }
  };

  const updateLinStats = async (dialogues: LinDialogue[]) => {
    try {
      const stats = await invoke<LinDialogueStats>('get_lin_dialogue_stats', { dialogues });
      setLinStats(stats);
    } catch (e: unknown) {
      clientLogger.error(t('danganronpaPatcher.errCalcLin'), e);
    }
  };

  const saveLinDialogues = async () => {
    try {
      const filePath = await open({
        directory: true,
        title: t('common.selezionaCartellaDestinazione'),
      });

      if (filePath) {
        const outputPath = `${filePath}/danganronpa_dialogues.json`;
        const count = await invoke<number>('save_lin_dialogues', {
          outputPath,
          dialogues: linDialogues,
        });
        toast.success(`${t('danganronpaPatcher.savedLabel')} ${count} ${t('danganronpaPatcher.dialoguesLabel')}`);
      }
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorSave')} ${e}`);
    }
  };

  const handleExportPO = useCallback(() => {
    const generic = entriesToGeneric(linDialogues, 'danganronpa');
    const metadata: PoMetadata = {
      project_name: selectedSteamGame?.game_name || 'Danganronpa',
      language: 'it',
      source_language: 'ja',
      game_engine: 'danganronpa',
      generator: 'GameStringer',
    };
    const poContent = generatePOString(generic, metadata);
    const blob = new Blob([poContent], { type: 'text/x-gettext; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSteamGame?.game_name || 'danganronpa'}.po`;
    a.click();
    URL.revokeObjectURL(url);
  }, [linDialogues, selectedSteamGame]);

  const loadLinDialogues = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        title: t('common.caricaDialoghi'),
      });
      
      if (filePath && typeof filePath === 'string') {
        const dialogues = await invoke<LinDialogue[]>('load_lin_dialogues', {
          inputPath: filePath,
        });
        setLinDialogues(dialogues);
        updateLinStats(dialogues);
        toast.success(`${t('danganronpaPatcher.loadedLabel')} ${dialogues.length} ${t('danganronpaPatcher.dialoguesLabel')}`);
      }
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorLoad')} ${e}`);
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
      toast.info(t('common.tuttiIDialoghiSonoGiàTradotti'));
      return;
    }

    setLoading(true);
    let translatedCount = 0;
    const batchSize = 5;
    
    try {
      const toTranslate = untranslated.slice(0, 50); // Max 50 alla volta
      toast.info(`${t('danganronpaPatcher.translatingLabel')} ${toTranslate.length} ${t('danganronpaPatcher.dialoguesInProgress')}`);
      
      for (let i = 0; i < toTranslate.length; i += batchSize) {
        const batch = toTranslate.slice(i, i + batchSize);
        
        const translations = await Promise.all(
          batch.map(async (dialogue) => {
            try {
              const result = await translateSingleSmart(
                dialogue.original,
                targetLanguage,
                'en'
              );
              if (result?.translated) {
                return { id: dialogue.id, translation: result.translated };
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
      
      toast.success(`${t('danganronpaPatcher.translatedLabel')} ${translatedCount} ${t('danganronpaPatcher.dialoguesWithAi')}`);
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorTranslation')} ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const importFromDrat = async () => {
    try {
      if (linDialogues.length === 0) {
        toast.error(t('common.primaCaricaUnFileLin'));
        return;
      }
      
      const filePath = await open({
        filters: [
          { name: 'DRAT Export', extensions: ['json', 'txt'] }
        ],
        title: t('common.importaTraduzioniDaDrat'),
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
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorImport')} ${e}`);
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
        title: t('common.selezionaCartellaGiocoDanganronpa'),
      });
      
      if (selected) {
        setLoading(true);
        const detected = await invoke<DanganronpaGame>('detect_danganronpa_game', {
          gamePath: selected,
        });
        setGame(detected);
        setSelectedPak(null);
        setPoFile(null);
        toast.success(`${t('danganronpaPatcher.detectedLabel')} ${getGameTypeName(detected.game_type)}`);
      }
    } catch (e: unknown) {
      toast.error(`${t('common.error')}: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const getGameTypeName = (type: string): string => {
    switch (type) {
      case 'TriggerHappyHavoc': return 'Danganronpa: Trigger Happy Havoc';
      case 'GoodbyeDespair': return 'Danganronpa 2: Goodbye Despair';
      case 'AnotherEpisode': return 'Danganronpa Another Episode';
      default: return t('danganronpaPatcher.gameUnknown');
    }
  };

  const selectPakFile = async (pakPath: string) => {
    try {
      setLoading(true);
      const archive = await invoke<PakArchive>('read_pak_archive', { pakPath });
      setSelectedPak(archive);
      toast.success(`${t('danganronpaPatcher.pakLoadedLabel')} ${archive.entries.length} ${t('danganronpaPatcher.filesLabel')}`);
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorReadPak')} ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const extractAllPak = async () => {
    if (!selectedPak) return;
    
    try {
      const outputDir = await open({
        directory: true,
        title: t('common.selezionaCartellaDiDestinazione'),
      });
      
      if (outputDir) {
        setLoading(true);
        const count = await invoke<number>('extract_all_pak', {
          pakPath: selectedPak.path,
          outputDir,
        });
        toast.success(`${t('danganronpaPatcher.extractedLabel')} ${count} ${t('danganronpaPatcher.filesLabel')}`);
      }
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorExtraction')} ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const openPoFile = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'PO Files', extensions: ['po', 'pot'] }],
        title: t('common.selezionaFilePo'),
      });
      
      if (selected && typeof selected === 'string') {
        setLoading(true);
        const po = await invoke<PoFile>('read_po_file', { poPath: selected });
        const stats = await invoke<PoStats>('get_po_stats', { poPath: selected });
        setPoFile(po);
        setPoStats(stats);
        toast.success(`${t('danganronpaPatcher.poLoadedLabel')} ${po.entries.length} ${t('danganronpaPatcher.entriesLabel')}`);
      }
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorReadPo')} ${e}`);
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
      
      toast.success(t('common.filePoSalvato'));
    } catch (e: unknown) {
      toast.error(`${t('danganronpaPatcher.errorSave')} ${e}`);
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
      case 'Text': return <Badge variant="default">{t('visualNovelPage.texts')}</Badge>;
      case 'Script': return <Badge variant="secondary">{t('visualNovelPage.script')}</Badge>;
      case 'Font': return <Badge variant="outline">{t('visualNovelPage.font')}</Badge>;
      case 'Texture': return <Badge className="bg-purple-500">{t('textureTranslator.textures')}</Badge>;
      default: return <Badge variant="outline">{t('visualNovelPage.unknown')}</Badge>;
    }
  };

  const DANGANRONPA_STEPS: WizardStep[] = [
    { num: 1, label: t('common.selezioneGioco') },
    { num: 2, label: t('danganronpaPatcher.stepFilesTranslations') },
    { num: 3, label: t('common.applicaPatch') },
  ];
  const danganronpaCurrentStep = poFile || selectedPak ? 2 : game ? 2 : 1;

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
              <h1 className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('visualNovelPage.title')}</h1>
              <p className="text-white/70 text-2xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('visualNovelPage.subtitle')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {dratInfo && (
              dratInfo.available ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-sm font-bold text-white">DRAT</span>
                  <span className="text-2xs text-white/70">{t('workshop.installed')}</span>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="bg-black/30 border-white/20 text-white hover:bg-black/50" asChild>
                  <a href={dratInfo.download_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    {t('danganronpaPatcher.downloadDrat')}<ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <WizardStepper steps={DANGANRONPA_STEPS} currentStep={danganronpaCurrentStep} size="sm" />

      {/* Game Selection */}
      <Card variant="muted">
        <CardHeader className="py-1.5 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <FolderOpen className="w-3 h-3 text-emerald-400" />{t('telltale.selectGame')}</CardTitle>
            <span className="text-2xs text-muted-foreground">{t('visualNovelPage.selectFolder')}</span>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-2">
          {!game ? (
            <Button onClick={selectGameFolder} disabled={loading} size="xs" className="bg-emerald-600 hover:bg-emerald-500">
              {loading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FolderOpen className="w-3 h-3 mr-2" />}
              {t('danganronpaPatcher.browse')}</Button>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold">{getGameTypeName(game.game_type)}</h3>
                  <p className="text-2xs text-muted-foreground truncate max-w-[500px]">{game.path}</p>
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
            {t('danganronpaPatcher.filePak')}</TabsTrigger>
          <TabsTrigger value="po" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <FileText className="w-3 h-3" />
            {t('danganronpaPatcher.translationsPo')}</TabsTrigger>
          <TabsTrigger value="patch" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Download className="w-3 h-3" />
            {t('danganronpaPatcher.applyPatch')}</TabsTrigger>
          <TabsTrigger value="lin" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <FileText className="w-3 h-3" />
            {t('danganronpaPatcher.scriptLin')}</TabsTrigger>
          <TabsTrigger value="wad-extract" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Search className="w-3 h-3" />
            {t('danganronpaPatcher.wadExtractor')}</TabsTrigger>
        </TabsList>

        {/* PAK Tab */}
        <TabsContent value="pak" className="space-y-1.5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* PAK List */}
            <Card variant="muted" className="lg:col-span-1">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Package className="w-3 h-3 text-emerald-400" />
                  {t('danganronpaPatcher.filePak')}</CardTitle>
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
                    {t('danganronpaPatcher.translatable')} ({game?.pak_files.filter(isTranslatablePak).length || 0})
                  </Button>
                  <Button
                    size="sm"
                    variant={pakFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setPakFilter('all')}
                    className="h-6 text-xs"
                  >
                    {t('common.all')} ({game?.pak_files.length || 0})
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
                      <p className="text-xs">{t('gamePatcher.selectGame')}</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* PAK Contents */}
            <Card variant="muted" className="lg:col-span-2">
              <CardHeader className="py-1.5 px-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-emerald-400" />
                      {t('danganronpaPatcher.pakContent')}</CardTitle>
                    {selectedPak && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {getPakTypeBadge(selectedPak.pak_type)}
                        <span>{selectedPak.entries.length} {t('danganronpaPatcher.filesLabel')}</span>
                      </div>
                    )}
                  </div>
                  {selectedPak && (
                    <Button
                      onClick={extractAllPak}
                      // Se NESSUNA voce è estraibile il pulsante non promette un
                      // lavoro che finirebbe in un errore: lo dice prima del click.
                      disabled={loading || !selectedPak.entries.some((e) => e.extractable)}
                      title={selectedPak.entries.some((e) => e.extractable) ? undefined : t('danganronpaPatcher.notExtractableHint')}
                      size="xs"
                      className="bg-emerald-600 hover:bg-emerald-500"
                    >
                      {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                      {t('danganronpaPatcher.extract')}</Button>
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
                          {/*
                            Una voce non estraibile lo DICE. Prima il .cpk mostrava
                            righe identiche alle altre e l'estrazione consegnava file
                            vuoti senza un errore: l'utente non aveva modo di sapere
                            che quei nomi non portavano da nessuna parte.
                          */}
                          {entry.extractable ? (
                            <span className="text-xs text-muted-foreground">
                              {(entry.size / 1024).toFixed(1)} KB
                            </span>
                          ) : (
                            <span
                              className="text-xs text-amber-500 shrink-0"
                              title={t('danganronpaPatcher.notExtractableHint')}
                            >
                              {t('danganronpaPatcher.notExtractable')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">{t('visualNovelPage.selectPak')}</p>
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
            <Card variant="muted">
              <CardContent className="pt-2 px-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-lg font-bold">{poStats.percentage}%</p>
                      <p className="text-2xs text-muted-foreground">{t('batchTranslator.done')}</p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>{poStats.translated} {t('danganronpaPatcher.translated')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <X className="w-4 h-4 text-red-500" />
                        <span>{poStats.untranslated} {t('danganronpaPatcher.missing')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span>{poStats.fuzzy} {t('danganronpaPatcher.fuzzy')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={openPoFile} size="sm" className="h-8">
                      <Upload className="w-3 h-3 mr-1" />
                      {t('danganronpaPatcher.open')}</Button>
                    {poFile && (
                      <Button onClick={savePoFile} disabled={loading} size="xs" className="bg-emerald-600 hover:bg-emerald-500">
                        {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                        {t('danganronpaPatcher.save')}</Button>
                    )}
                  </div>
                </div>
                <Progress value={poStats.percentage} className="h-2 bg-slate-800" />
              </CardContent>
            </Card>
          )}

          {/* PO Editor */}
          <Card variant="muted" className="flex-1">
            <CardHeader className="py-1.5 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-emerald-400" />{t('editor.title')}</CardTitle>
                {!poFile && (
                  <Button onClick={openPoFile} size="xs" className="bg-emerald-600 hover:bg-emerald-500">
                    <Upload className="w-3 h-3 mr-1" />
                    {t('danganronpaPatcher.openPo')}</Button>
                )}
              </div>
              {poFile && (
                <div className="mt-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      aria-label={t('common.cerca')} placeholder={t('danganronpaPatcher.searchTexts')}
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
                            <label className="text-xs font-medium text-muted-foreground uppercase">{t('offlineTranslator.original')}</label>
                            <p className="text-sm mt-1 font-mono bg-slate-950/50 p-2 rounded border border-slate-800">
                              {entry.msgid}
                            </p>
                          </div>
                          
                          {/* Translation */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase">{t('offlineTranslator.translation')}</label>
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
                                    <Check className="w-3 h-3 mr-1" />{t('glossaryManager.save')}</Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingEntry(null)}
                                    className="h-7"
                                  >{t('workshop.unsubscribe')}</Button>
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
                                {entry.msgstr || t('danganronpaPatcher.clickToTranslate')}
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
                    <p className="text-sm font-medium">{t('visualNovelPage.noPoLoaded')}</p>
                    <p className="text-xs mt-1">{t('visualNovelPage.openPoToStart')}</p>
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
            <Card variant="muted">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-emerald-400" />
                  {t('danganronpaPatcher.steamGamesDetected')}<span className="text-2xs font-normal text-muted-foreground ml-1">
                    {steamGames.length > 0
                      ? `${steamGames.length} ${t('danganronpaPatcher.foundLabel')}`
                      : t('common.none')}
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
                            <Badge variant="outline" className="text-2xs">
                              {sg.wad_files.length} WAD
                            </Badge>
                          </div>
                          <p className="text-2xs text-muted-foreground mt-1 truncate">
                            {sg.path}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">{t('emptyStates.noGames')}</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Apply Patch */}
            <Card variant="muted">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Download className="w-3 h-3 text-emerald-400" />
                  {t('danganronpaPatcher.applyItalianPatch')}</CardTitle>
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
                  {t('danganronpaPatcher.selectWadPatch')}</Button>

                {/* Ciclo in-app: WAD ricostruito dalle traduzioni GameStringer */}
                <Button
                  onClick={rebuildWad}
                  disabled={!selectedSteamGame || applyingPatch}
                  size="sm"
                  className="w-full h-8 bg-violet-600 hover:bg-violet-500 text-xs"
                >
                  {applyingPatch ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wrench className="w-4 h-4 mr-2" />
                  )}
                  {t('danganronpaPatcher.rebuildWadButton')}</Button>

                {selectedSteamGame && selectedSteamGame.wad_files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t('visualNovelPage.currentWadFiles')}</p>
                    {selectedSteamGame.wad_files.map((wad, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                        <span className="text-xs font-mono">{wad.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xs text-muted-foreground">
                            {(wad.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                          {wad.is_patched && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-2xs">
                              <Check className="w-2.5 h-2.5 mr-1" />
                              {t('danganronpaPatcher.patched')}</Badge>
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
            <Card variant="muted">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  {t('danganronpaPatcher.backupsAvailable')}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <ScrollArea className="h-[100px]">
                  {backups.length > 0 ? (
                    <div className="space-y-2">
                      {backups.map((backup, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-950/50 border border-slate-800">
                          <div>
                            <span className="text-xs font-mono">{backup.name}</span>
                            <p className="text-2xs text-muted-foreground">
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
                            <RefreshCw className="w-3 h-3 mr-1" />{t('telltale.restore')}</Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-muted-foreground">
                      <p className="text-xs">{t('visualNovelPage.noBackup')}</p>
                      <p className="text-2xs mt-0.5">{t('visualNovelPage.autoCreated')}</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* All-Ice Team Info */}
            {alliceInfo && (
              <Card variant="muted">
                <CardHeader className="py-1.5 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-emerald-400" />
                    {alliceInfo.team_name}
                    <span className="text-2xs font-normal text-muted-foreground ml-1">{t('visualNovelPage.officialTeam')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2 space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="xs" className="text-xs" asChild>
                      <a href={alliceInfo.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-3 h-3 mr-1" />
                        {t('danganronpaPatcher.website')}</a>
                    </Button>
                    <Button variant="outline" size="xs" className="text-xs" asChild>
                      <a href={alliceInfo.discord} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Discord
                      </a>
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t('visualNovelPage.availablePatches')}</p>
                    {alliceInfo.patches.map((patch, i) => (
                      <div key={i} className="p-2 rounded bg-slate-950/50 border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{patch.game}</span>
                          <Badge variant="outline" className="text-2xs">v{patch.version}</Badge>
                        </div>
                        <p className="text-2xs text-muted-foreground mt-1">{patch.notes}</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-6 p-0 text-2xs text-emerald-400"
                          asChild
                        >
                          <a href={patch.download_url} target="_blank" rel="noopener noreferrer">
                            {t('danganronpaPatcher.download')} ({patch.file_name})
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
                {t('danganronpaPatcher.exportPatch')}<span className="text-2xs font-normal text-muted-foreground ml-1">{t('danganronpaPatcher.exportPatchDesc')}</span>
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
                  {exporting ? t('danganronpaPatcher.creatingZipShort') : t('danganronpaPatcher.exportZip')}
                </Button>
                {!selectedSteamGame && (
                  <span className="text-xs text-muted-foreground">
                    {t('danganronpaPatcher.selectGameFirst')}</span>
                )}
              </div>

              {exporting && (
                <div className="space-y-2">
                  <Progress value={undefined} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {t('danganronpaPatcher.compressingWad')}</p>
                </div>
              )}

              {exportResult && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">{t('visualNovelPage.zipCreated')}</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground truncate">
                      <span className="text-emerald-400/70">{t('visualNovelPage.path')}</span> {exportResult.zipPath}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="text-emerald-400/70">{t('visualNovelPage.size')}</span> {exportResult.zipSizeMb.toFixed(1)} MB
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {exportResult.filesIncluded.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-2xs">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-2xs text-muted-foreground space-y-1 p-2 rounded bg-slate-950/50 border border-slate-800">
                <p className="font-medium text-slate-400">{t('visualNovelPage.zipContent')}</p>
                <p>&#x2022; <span className="text-emerald-400/70">dr1_data_keyboard_us.wad</span> {t('danganronpaPatcher.descWadPatched')}</p>
                <p>&#x2022; <span className="text-emerald-400/70">install.bat</span> {t('danganronpaPatcher.descInstaller')}</p>
                <p>&#x2022; <span className="text-emerald-400/70">LEGGIMI.txt</span> {t('danganronpaPatcher.descReadme')}</p>
                <p>&#x2022; <span className="text-emerald-400/70">translations.json</span> {t('danganronpaPatcher.descTranslations')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIN Tab */}
        <TabsContent value="lin" className="space-y-1.5">
          {/* LIN Stats */}
          {linStats && linStats.total > 0 && (
            <Card variant="muted">
              <CardContent className="pt-2 px-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{linStats.percentage}%</p>
                      <p className="text-2xs text-muted-foreground">{t('batchTranslator.done')}</p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>{linStats.translated} {t('danganronpaPatcher.translated')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <X className="w-4 h-4 text-red-500" />
                        <span>{linStats.untranslated} {t('danganronpaPatcher.missing')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(linStats.by_speaker).slice(0, 5).map(([speaker, count]) => (
                        <Badge key={speaker} variant="outline" className="text-2xs">
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
                      {t('danganronpaPatcher.translateWithAi')}</Button>
                    <Button variant="outline" onClick={importFromDrat} size="sm" className="h-8">
                      <Upload className="w-3 h-3 mr-1" />
                      {t('danganronpaPatcher.importDrat')}</Button>
                    <Button variant="outline" onClick={loadLinDialogues} size="sm" className="h-8">
                      <Upload className="w-3 h-3 mr-1" />
                      {t('danganronpaPatcher.loadJson')}</Button>
                    <Button onClick={saveLinDialogues} size="xs" className="bg-emerald-600 hover:bg-emerald-500">
                      <Download className="w-3 h-3 mr-1" />{t('glossaryManager.save')}</Button>
                    <Button size="sm" variant="outline" onClick={handleExportPO} disabled={linDialogues.length === 0} className="h-8" aria-label={t('common.esportaFilePo')}>
                      <Download className="h-4 w-4 mr-1.5" />
                      PO
                    </Button>
                  </div>
                </div>
                <Progress value={linStats.percentage} className="h-2 bg-slate-800" />
              </CardContent>
            </Card>
          )}

          {/* LIN Editor */}
          <Card variant="muted" className="flex-1">
            <CardHeader className="py-1.5 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-emerald-400" />
                  {t('danganronpaPatcher.linDialogues')}{linDialogues.length > 0 && (
                    <Badge variant="outline" className="ml-2">{filteredLinDialogues.length} / {linDialogues.length}</Badge>
                  )}
                </CardTitle>
                <Button onClick={openLinFile} disabled={extractingLin} size="xs" className="bg-emerald-600 hover:bg-emerald-500">
                  {extractingLin ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                  {t('danganronpaPatcher.openLin')}</Button>
              </div>
              {linDialogues.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        aria-label={t('common.cerca')} placeholder={t('danganronpaPatcher.searchDialogues')}
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
                      <option value="all">{t('visualNovelPage.allCharacters')}</option>
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
                      {t('danganronpaPatcher.onlyUntranslated')}</label>
                    <div className="flex gap-1 ml-auto">
                      <Button
                        size="sm"
                        variant={linViewMode === 'full' ? 'default' : 'outline'}
                        onClick={() => setLinViewMode('full')}
                        className="h-7 px-2"
                      >
                        {t('danganronpaPatcher.expanded')}</Button>
                      <Button
                        size="sm"
                        variant={linViewMode === 'compact' ? 'default' : 'outline'}
                        onClick={() => setLinViewMode('compact')}
                        className="h-7 px-2"
                      >
                        {t('danganronpaPatcher.compact')}</Button>
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
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-2xs shrink-0">
                              {dialogue.speaker}
                            </Badge>
                            <span className="text-xs font-mono truncate flex-1 text-muted-foreground">
                              {dialogue.original.substring(0, 50)}{dialogue.original.length > 50 ? '...' : ''}
                            </span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className={`text-xs truncate flex-1 ${isUntranslated ? 'italic text-yellow-500/70' : ''}`}>
                              {dialogue.translated || t('danganronpaPatcher.toTranslate')}
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
                            <span className="text-2xs text-muted-foreground">
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
                                  <Check className="w-3 h-3 mr-1" />{t('glossaryManager.save')}</Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingLinId(null)}
                                  className="h-7"
                                >{t('workshop.unsubscribe')}</Button>
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
                              {dialogue.translated || t('danganronpaPatcher.clickToTranslate')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredLinDialogues.length > 100 && (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        {t('danganronpaPatcher.showing100Of')} {filteredLinDialogues.length} {t('danganronpaPatcher.dialoguesUseSearchToFilter')}
                      </p>
                    )}
                  </div>
                ) : linDialogues.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">{t('visualNovelPage.noLinLoaded')}</p>
                    <p className="text-xs mt-1">{t('visualNovelPage.extractLinFromWad')}</p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('workshop.noResults')}</p>
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

