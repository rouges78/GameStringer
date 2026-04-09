'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { invoke } from '@/lib/tauri-api';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';
import {
  Film, FolderOpen, Search, Play, Download, Settings2,
  CheckCircle2, XCircle, Loader2, Info, HardDrive,
  Maximize2, Zap, FileVideo, ChevronDown, ChevronRight,
  AlertTriangle, RefreshCw, Trash2, Eye, Gamepad2, Library
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { clientLogger } from '@/lib/client-logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ──────────────────────────────────────────────────────────────

interface VideoFormat {
  VMD?: null; BIK?: null; SMK?: null; USM?: null; ROQ?: null;
  THP?: null; BK2?: null; RBT?: null; DUK?: null; AVI?: null;
  WMV?: null; Unknown?: null;
}

interface GameVideoFile {
  name: string;
  path: string;
  relative_path: string;
  size_bytes: number;
  format: string;
  format_name: string;
  width: number | null;
  height: number | null;
  frame_count: number | null;
  ffmpeg_convertible: boolean;
}

interface VideoScanResult {
  game_path: string;
  total_files: number;
  total_size_bytes: number;
  files: GameVideoFile[];
  format_summary: { format: string; count: number; total_bytes: number }[];
}

interface ConversionOptions {
  output_format: string;
  video_codec: string;
  crf: number | null;
  scale: string | null;
  scale_filter: string | null;
  fps: number | null;
  audio_codec: string;
  output_dir: string | null;
}

interface ConversionResult {
  success: boolean;
  input_path: string;
  output_path: string;
  error: string | null;
  output_size: number | null;
}

interface VideoHeaderInfo {
  format_name: string;
  width: number | null;
  height: number | null;
  frame_count: number | null;
  audio_sample_rate: number | null;
  audio_channels: number | null;
  has_audio: boolean;
  extra_info: [string, string][];
}

type ConversionPreset = [string, string, ConversionOptions];

// ── Helpers ────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getFormatColor(format: string): string {
  if (format.includes('Sierra') || format.includes('VMD') || format.includes('RBT') || format.includes('DUK'))
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (format.includes('Bink') || format.includes('BIK'))
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  if (format.includes('Smacker') || format.includes('SMK'))
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  if (format.includes('CRI') || format.includes('Sofdec'))
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (format.includes('ROQ'))
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
}

// ── Main Component ─────────────────────────────────────────────────────

interface LibraryGame {
  id: string;
  app_id: string;
  title: string;
  install_dir?: string;
  is_installed?: boolean;
}

export default function VideoExtractorPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  // State
  const [gamePath, setGamePath] = useState('');
  const [gameName, setGameName] = useState('');
  const [gameId, setGameId] = useState('');
  const [scanResult, setScanResult] = useState<VideoScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);
  const [conversionResults, setConversionResults] = useState<ConversionResult[]>([]);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [presets, setPresets] = useState<ConversionPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('standard');
  const [customOptions, setCustomOptions] = useState<ConversionOptions>({
    output_format: 'mp4',
    video_codec: 'libx264',
    crf: 18,
    scale: null,
    scale_filter: 'lanczos',
    fps: null,
    audio_codec: 'aac',
    output_dir: null,
  });
  const [outputDir, setOutputDir] = useState('');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [headerInfo, setHeaderInfo] = useState<Record<string, VideoHeaderInfo>>({});
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [realesrganAvailable, setRealesrganAvailable] = useState<boolean | null>(null);
  const [upscaling, setUpscaling] = useState(false);
  const [upscaleModel, setUpscaleModel] = useState('realesrgan-x4plus');
  const [upscaleScale, setUpscaleScale] = useState(4);
  const [libraryGames, setLibraryGames] = useState<LibraryGame[]>([]);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [gamePickerSearch, setGamePickerSearch] = useState('');

  // Read query params on mount (when coming from game detail page)
  const [autoScanDone, setAutoScanDone] = useState(false);
  useEffect(() => {
    const qGamePath = searchParams?.get('gamePath');
    const qGameName = searchParams?.get('gameName');
    const qGameId = searchParams?.get('gameId');
    if (qGamePath) {
      setGamePath(qGamePath);
      if (qGameName) setGameName(qGameName);
      if (qGameId) setGameId(qGameId);
    }
  }, [searchParams]);

  // Auto-scan when arriving from game detail with a gamePath
  useEffect(() => {
    if (gamePath && !autoScanDone && !scanResult && !scanning && searchParams?.get('gamePath')) {
      setAutoScanDone(true);
      handleScan();
    }
  }, [gamePath, autoScanDone, scanResult, scanning]);

  // Load library games for the picker
  useEffect(() => {
    loadLibraryGames();
  }, []);

  const loadLibraryGames = async () => {
    try {
      const games = await invoke<LibraryGame[]>('get_all_games');
      if (games) {
        setLibraryGames(games.filter(g => g.is_installed && g.install_dir));
      }
    } catch {
      // Library not available
    }
  };

  const selectGameFromLibrary = async (game: LibraryGame) => {
    if (game.install_dir) {
      try {
        const path = await invoke<string>('find_game_install_path', { installDir: game.install_dir });
        if (path) {
          setGamePath(path);
          setGameName(game.title);
          setGameId(game.id || game.app_id);
          setShowGamePicker(false);
          setGamePickerSearch('');
          return;
        }
      } catch {
        // Fallback
      }
    }
    setGameName(game.title);
    setGameId(game.id || game.app_id);
    setShowGamePicker(false);
    setGamePickerSearch('');
  };

  // Check FFmpeg on mount
  useEffect(() => {
    checkFfmpeg();
    checkRealesrgan();
    loadPresets();
  }, []);

  const checkFfmpeg = async () => {
    try {
      const available = await invoke<boolean>('check_ffmpeg_available');
      setFfmpegAvailable(available);
    } catch {
      setFfmpegAvailable(false);
    }
  };

  const checkRealesrgan = async () => {
    try {
      const available = await invoke<boolean>('check_realesrgan_available');
      setRealesrganAvailable(available);
    } catch {
      setRealesrganAvailable(false);
    }
  };

  const loadThumbnail = useCallback(async (filePath: string) => {
    if (thumbnails[filePath] || !ffmpegAvailable) return;
    try {
      const b64 = await invoke<string>('extract_video_thumbnail_base64', { filePath });
      setThumbnails(prev => ({ ...prev, [filePath]: b64 }));
    } catch {
      // Thumbnail non disponibile
    }
  }, [thumbnails, ffmpegAvailable]);

  const handleUpscale = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    setUpscaling(true);
    setConversionResults([]);
    const paths = Array.from(selectedFiles);
    const results: ConversionResult[] = [];
    for (const path of paths) {
      try {
        const result = await invoke<ConversionResult>('upscale_video_realesrgan', {
          inputPath: path, scale: upscaleScale, model: upscaleModel,
          outputDir: outputDir || null,
        });
        results.push(result);
      } catch (e: unknown) {
        results.push({ success: false, input_path: path, output_path: '', error: String(e), output_size: null });
      }
    }
    setConversionResults(results);
    setUpscaling(false);
  }, [selectedFiles, upscaleScale, upscaleModel, outputDir]);

  const loadPresets = async () => {
    try {
      const p = await invoke<ConversionPreset[]>('get_conversion_presets');
      setPresets(p);
    } catch (e: unknown) {
      clientLogger.error('Errore caricamento preset:', e);
    }
  };

  // Scan game folder
  const handleScan = useCallback(async () => {
    if (!gamePath.trim()) return;
    setScanning(true);
    setScanResult(null);
    setSelectedFiles(new Set());
    setConversionResults([]);

    try {
      const result = await invoke<VideoScanResult>('scan_game_video_files', {
        gamePath: gamePath.trim(),
      });
      setScanResult(result);
    } catch (e: unknown) {
      clientLogger.error('Errore scansione:', e);
    } finally {
      setScanning(false);
    }
  }, [gamePath]);

  // Analyze single file header
  const analyzeHeader = useCallback(async (filePath: string) => {
    if (headerInfo[filePath]) {
      setExpandedFile(expandedFile === filePath ? null : filePath);
      return;
    }
    try {
      const info = await invoke<VideoHeaderInfo>('analyze_video_header', {
        filePath,
      });
      setHeaderInfo(prev => ({ ...prev, [filePath]: info }));
      setExpandedFile(filePath);
    } catch (e: unknown) {
      clientLogger.error('Errore analisi header:', e);
    }
  }, [headerInfo, expandedFile]);

  // Toggle file selection
  const toggleFile = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAll = () => {
    if (!scanResult) return;
    const filtered = getFilteredFiles();
    if (selectedFiles.size === filtered.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filtered.map(f => f.path)));
    }
  };

  const selectAllConvertible = () => {
    if (!scanResult) return;
    setSelectedFiles(new Set(
      getFilteredFiles().filter(f => f.ffmpeg_convertible).map(f => f.path)
    ));
  };

  // Get active conversion options (from preset or custom)
  const getActiveOptions = (): ConversionOptions => {
    const preset = presets.find(([id]) => id === selectedPreset);
    if (preset) {
      return {
        ...preset[2],
        output_dir: outputDir || null,
      };
    }
    return { ...customOptions, output_dir: outputDir || null };
  };

  // Convert selected files
  const handleConvert = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    setConverting(true);
    setConversionResults([]);
    setConversionProgress(0);

    const paths = Array.from(selectedFiles);
    const opts = getActiveOptions();

    try {
      const results = await invoke<ConversionResult[]>('convert_video_batch', {
        inputPaths: paths,
        options: opts,
      });
      setConversionResults(results);
      setConversionProgress(100);
    } catch (e: unknown) {
      clientLogger.error('Errore conversione:', e);
    } finally {
      setConverting(false);
    }
  }, [selectedFiles, selectedPreset, customOptions, outputDir, presets]);

  // Filter & search
  const getFilteredFiles = (): GameVideoFile[] => {
    if (!scanResult) return [];
    return scanResult.files.filter(f => {
      if (filterFormat !== 'all' && f.format_name !== filterFormat) return false;
      if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !f.relative_path.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  };

  const filteredFiles = getFilteredFiles();

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 animate-shimmer p-4 shadow-xl shadow-purple-900/50 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Video Extractor</h1>
              <p className="text-white/80 text-xs">Estrai e converti video FMV da giochi retro e moderni</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10">
              <FileVideo className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">VMD / BIK / SMK / USM / ROQ</span>
            </div>
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10 ${
              ffmpegAvailable === true ? 'bg-emerald-500/30' :
              ffmpegAvailable === false ? 'bg-red-500/30' : 'bg-black/30'
            }`}>
              {ffmpegAvailable === true ? <CheckCircle2 className="w-3.5 h-3.5" /> :
               ffmpegAvailable === false ? <XCircle className="w-3.5 h-3.5" /> :
               <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span className="text-xs font-medium">
                FFmpeg {ffmpegAvailable === true ? 'OK' : ffmpegAvailable === false ? 'Non trovato' : '...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FFmpeg Warning ──────────────────────────────────────────── */}
      {ffmpegAvailable === false && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">FFmpeg non trovato nel PATH di sistema</p>
            <p className="text-amber-300/70 mt-1">
              Per convertire i video dei giochi, installa FFmpeg e assicurati che sia nel PATH.
              La scansione e l&apos;analisi dei file funzionano comunque senza FFmpeg.
            </p>
          </div>
        </div>
      )}

      {/* ── Scan Section ───────────────────────────────────────────── */}
      <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-white">Scansiona Cartella Gioco</h2>
            {gameName && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                {gameName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Link back to game detail */}
            {gameId && (
              <Link
                href={`/library/?id=${encodeURIComponent(gameId)}&name=${encodeURIComponent(gameName)}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-all no-underline"
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                Scheda Gioco
              </Link>
            )}
            {/* Game picker from library */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGamePicker(!showGamePicker)}
                className="text-xs gap-1.5"
              >
                <Library className="w-3.5 h-3.5" />
                Scegli dalla Libreria
                <ChevronDown className={`w-3 h-3 transition-transform ${showGamePicker ? 'rotate-180' : ''}`} />
              </Button>
              {showGamePicker && (
                <div className="absolute right-0 top-full mt-1 w-80 max-h-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-zinc-800">
                    <Input
                      value={gamePickerSearch}
                      onChange={(e) => setGamePickerSearch(e.target.value)}
                      placeholder="Cerca gioco installato..."
                      className="h-7 text-xs bg-zinc-800/50 border-zinc-700"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {libraryGames
                      .filter(g => !gamePickerSearch || g.title.toLowerCase().includes(gamePickerSearch.toLowerCase()))
                      .slice(0, 50)
                      .map(game => (
                        <button
                          key={game.id || game.app_id}
                          className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-purple-500/10 hover:text-white transition-colors border-b border-zinc-800/50 last:border-0"
                          onClick={() => selectGameFromLibrary(game)}
                        >
                          <div className="font-medium truncate">{game.title}</div>
                          {game.install_dir && (
                            <div className="text-[10px] text-zinc-500 truncate mt-0.5">{game.install_dir}</div>
                          )}
                        </button>
                      ))
                    }
                    {libraryGames.filter(g => !gamePickerSearch || g.title.toLowerCase().includes(gamePickerSearch.toLowerCase())).length === 0 && (
                      <div className="p-4 text-center text-xs text-zinc-500">Nessun gioco installato trovato</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={gamePath}
            onChange={(e) => setGamePath(e.target.value)}
            placeholder="Percorso della cartella del gioco (es. C:\Steam\steamapps\common\Gabriel Knight 2)"
            className="flex-1 bg-zinc-800/50 border-zinc-700"
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
          />
          <Button
            onClick={handleScan}
            disabled={scanning || !gamePath.trim()}
            className="bg-purple-600 hover:bg-purple-500"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            {scanning ? 'Scansione...' : 'Scansiona'}
          </Button>
        </div>
      </div>

      {/* ── Scan Results ───────────────────────────────────────────── */}
      {scanResult && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3">
              <div className="text-xs text-zinc-500 mb-1">File Video</div>
              <div className="text-xl font-bold text-white">{scanResult.total_files}</div>
            </div>
            <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3">
              <div className="text-xs text-zinc-500 mb-1">Dimensione Totale</div>
              <div className="text-xl font-bold text-white">{formatSize(scanResult.total_size_bytes)}</div>
            </div>
            <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3">
              <div className="text-xs text-zinc-500 mb-1">Formati Trovati</div>
              <div className="text-xl font-bold text-white">{scanResult.format_summary.length}</div>
            </div>
            <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3">
              <div className="text-xs text-zinc-500 mb-1">Selezionati</div>
              <div className="text-xl font-bold text-purple-400">{selectedFiles.size}</div>
            </div>
          </div>

          {/* Format Summary Badges */}
          <div className="flex flex-wrap gap-2">
            {scanResult.format_summary.map(fs => (
              <Badge
                key={fs.format}
                variant="outline"
                className={`cursor-pointer transition-all ${getFormatColor(fs.format)} ${
                  filterFormat === fs.format ? 'ring-1 ring-white/30' : ''
                }`}
                onClick={() => setFilterFormat(filterFormat === fs.format ? 'all' : fs.format)}
              >
                {fs.format}: {fs.count} file ({formatSize(fs.total_bytes)})
              </Badge>
            ))}
            {filterFormat !== 'all' && (
              <Badge
                variant="outline"
                className="cursor-pointer bg-zinc-700/30 text-zinc-400 border-zinc-600 hover:bg-zinc-600/30"
                onClick={() => setFilterFormat('all')}
              >
                Mostra tutti
              </Badge>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
                {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? 'Deseleziona' : 'Seleziona'} Tutti
              </Button>
              <Button variant="outline" size="sm" onClick={selectAllConvertible} className="text-xs">
                Solo Convertibili
              </Button>
            </div>

            <div className="flex-1" />

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca file..."
                className="pl-8 h-8 w-48 bg-zinc-800/50 border-zinc-700 text-xs"
              />
            </div>
          </div>

          {/* File List */}
          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              {filteredFiles.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  <FileVideo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nessun file video trovato{filterFormat !== 'all' ? ' per questo formato' : ''}</p>
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <div key={file.path}>
                    <div
                      className={`flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer ${
                        selectedFiles.has(file.path) ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.path)}
                        onChange={() => toggleFile(file.path)}
                        className="w-4 h-4 rounded border-zinc-600 text-purple-500 focus:ring-purple-500 bg-zinc-800"
                      />

                      {/* Thumbnail */}
                      <div
                        className="w-12 h-8 rounded bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0 cursor-pointer"
                        onClick={() => { loadThumbnail(file.path); }}
                      >
                        {thumbnails[file.path] ? (
                          <img src={thumbnails[file.path]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileVideo className="w-3 h-3 text-zinc-600" />
                          </div>
                        )}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0" onClick={() => analyzeHeader(file.path)}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{file.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${getFormatColor(file.format_name)}`}>
                            {file.format_name}
                          </Badge>
                          {file.ffmpeg_convertible && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                              Convertibile
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                          <span>{file.relative_path}</span>
                          <span>{formatSize(file.size_bytes)}</span>
                          {file.width && file.height && (
                            <span className="text-zinc-400">{file.width}x{file.height}</span>
                          )}
                          {file.frame_count && (
                            <span>{file.frame_count} frame</span>
                          )}
                        </div>
                      </div>

                      {/* Expand button */}
                      <button
                        onClick={() => analyzeHeader(file.path)}
                        className="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
                      >
                        {expandedFile === file.path ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Expanded Header Info */}
                    {expandedFile === file.path && headerInfo[file.path] && (
                      <div className="px-12 py-3 bg-zinc-800/30 border-b border-zinc-800/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-zinc-500">Formato:</span>
                            <span className="ml-2 text-white">{headerInfo[file.path].format_name}</span>
                          </div>
                          {headerInfo[file.path].width && (
                            <div>
                              <span className="text-zinc-500">Risoluzione:</span>
                              <span className="ml-2 text-white">{headerInfo[file.path].width}x{headerInfo[file.path].height}</span>
                            </div>
                          )}
                          {headerInfo[file.path].frame_count && (
                            <div>
                              <span className="text-zinc-500">Frame:</span>
                              <span className="ml-2 text-white">{headerInfo[file.path].frame_count}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-500">Audio:</span>
                            <span className="ml-2 text-white">
                              {headerInfo[file.path].has_audio
                                ? `${headerInfo[file.path].audio_sample_rate || '?'} Hz`
                                : 'No'}
                            </span>
                          </div>
                          {headerInfo[file.path].extra_info.map(([key, val]) => (
                            <div key={key}>
                              <span className="text-zinc-500">{key}:</span>
                              <span className="ml-2 text-white">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Conversion Section ──────────────────────────────────── */}
          {selectedFiles.size > 0 && (
            <div className="bg-zinc-900/50 rounded-lg border border-purple-500/30 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold text-white">Opzioni Conversione</h2>
                <Badge className="bg-purple-500/20 text-purple-400">
                  {selectedFiles.size} file selezionati
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Preset */}
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Preset</label>
                  <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map(([id, label]) => (
                        <SelectItem key={id} value={id}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Output Directory */}
                <div className="md:col-span-2">
                  <label className="text-xs text-zinc-500 mb-1 block">Directory Output (vuoto = stessa cartella)</label>
                  <Input
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    placeholder="Lascia vuoto per salvare accanto ai file originali"
                    className="bg-zinc-800/50 border-zinc-700"
                  />
                </div>
              </div>

              {/* Convert Button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleConvert}
                  disabled={converting || ffmpegAvailable !== true}
                  className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 px-6"
                >
                  {converting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {converting ? 'Conversione in corso...' : `Converti ${selectedFiles.size} Video`}
                </Button>

                {ffmpegAvailable !== true && (
                  <span className="text-xs text-amber-400">FFmpeg richiesto per la conversione</span>
                )}
              </div>

              {/* Conversion Progress */}
              {converting && (
                <div className="space-y-2">
                  <Progress value={conversionProgress} className="h-2" />
                  <p className="text-xs text-zinc-500">Conversione in corso...</p>
                </div>
              )}

              {/* Conversion Results */}
              {conversionResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Risultati Conversione
                  </h3>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {conversionResults.map((result, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                          result.success
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-red-500/10 border border-red-500/20'
                        }`}
                      >
                        {result.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">
                            {result.input_path.split(/[/\\]/).pop()}
                          </p>
                          {result.success && result.output_size && (
                            <p className="text-zinc-500 truncate">
                              → {result.output_path.split(/[/\\]/).pop()} ({formatSize(result.output_size)})
                            </p>
                          )}
                          {result.error && (
                            <p className="text-red-400 truncate">{result.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2 text-xs text-zinc-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {conversionResults.filter(r => r.success).length} / {conversionResults.length} convertiti con successo
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── AI Upscale Section ────────────────────────────────── */}
          {selectedFiles.size > 0 && (
            <div className="bg-zinc-900/50 rounded-lg border border-fuchsia-500/30 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Maximize2 className="w-5 h-5 text-fuchsia-400" />
                <h2 className="font-semibold text-white">AI Upscaling (Real-ESRGAN)</h2>
                {realesrganAvailable === true ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400">Disponibile</Badge>
                ) : realesrganAvailable === false ? (
                  <Badge className="bg-amber-500/20 text-amber-400">Non installato</Badge>
                ) : null}
              </div>

              {realesrganAvailable === false && (
                <div className="text-xs text-zinc-400 space-y-1">
                  <p>Per usare l&apos;AI upscaling, scarica <a href="https://github.com/xinntao/Real-ESRGAN/releases" target="_blank" rel="noopener" className="text-fuchsia-400 underline">Real-ESRGAN ncnn Vulkan</a> e aggiungilo al PATH.</p>
                  <p className="text-zinc-500">Funziona su GPU (Vulkan) — ideale per upscalare video FMV retro come Gabriel Knight 2.</p>
                </div>
              )}

              {realesrganAvailable === true && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Modello</label>
                      <Select value={upscaleModel} onValueChange={setUpscaleModel}>
                        <SelectTrigger className="bg-zinc-800/50 border-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realesrgan-x4plus">RealESRGAN x4plus (generale)</SelectItem>
                          <SelectItem value="realesrgan-x4plus-anime">RealESRGAN x4plus Anime</SelectItem>
                          <SelectItem value="realesr-animevideov3">AnimVideo v3 (video)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Scala</label>
                      <Select value={String(upscaleScale)} onValueChange={(v) => setUpscaleScale(Number(v))}>
                        <SelectTrigger className="bg-zinc-800/50 border-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2x</SelectItem>
                          <SelectItem value="4">4x (consigliato per FMV retro)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Directory Output</label>
                      <Input
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        placeholder="Stessa cartella"
                        className="bg-zinc-800/50 border-zinc-700"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleUpscale}
                    disabled={upscaling || selectedFiles.size === 0}
                    className="bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 px-6"
                  >
                    {upscaling ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    {upscaling ? 'Upscaling AI in corso...' : `Upscale ${selectedFiles.size} Video con AI`}
                  </Button>

                  <p className="text-[11px] text-zinc-500">
                    Estrae i frame → upscale AI su GPU → riassembla in MP4 H.264. Può richiedere diversi minuti per video.
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Supported Formats Info ──────────────────────────────── */}
          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-400">Formati Supportati</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { name: 'VMD (Sierra)', games: 'Gabriel Knight 2, Phantasmagoria', ffmpeg: true },
                { name: 'BIK (Bink)', games: 'Molti giochi AAA (2000-2015)', ffmpeg: true },
                { name: 'SMK (Smacker)', games: 'Giochi anni 90-2000', ffmpeg: true },
                { name: 'USM (CRI Sofdec)', games: 'Persona, Yakuza, Tales of', ffmpeg: false },
                { name: 'ROQ (id Software)', games: 'Quake III, Jedi Knight', ffmpeg: true },
                { name: 'THP (Nintendo)', games: 'GameCube/Wii', ffmpeg: true },
                { name: 'BK2 (Bink 2)', games: 'Giochi moderni', ffmpeg: false },
                { name: 'AVI/WMV', games: 'Giochi PC vari', ffmpeg: true },
              ].map(fmt => (
                <div key={fmt.name} className="p-2 rounded bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-white">{fmt.name}</span>
                    {fmt.ffmpeg ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                    )}
                  </div>
                  <p className="text-zinc-500 mt-0.5">{fmt.games}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
