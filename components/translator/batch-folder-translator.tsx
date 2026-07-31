"use client";

import { useState, useRef } from "react";
import { TARGET_LANGUAGES } from "@/lib/translation/target-languages";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  FileText,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Loader2,
  FolderTree,
  RefreshCw,
  Globe,
  Edit3,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { clientLogger } from '@/lib/client-logger';
import { useDefaultTargetLang } from '@/lib/translation/use-default-target-lang';

/**
 * ⛔ La traduzione batch NON è implementata — 31/07/2026.
 *
 * Fino a oggi questo componente FINGEVA di tradurre: leggeva il file, aspettava
 * mezzo secondo e riscriveva il CONTENUTO ORIGINALE con il suffisso della lingua
 * di destinazione, marcando poi il file come "completed / 100%". Il risultato
 * erano artefatti sul disco dell'utente che sembravano traduzioni e non lo erano.
 *
 * Finché la traduzione vera non è collegata, questa costante resta `false`:
 * scansione, filtri e selezione restano attivi (sono onesti e utili — dicono
 * davvero quali file ci sono), ma l'avvio è disabilitato e la UI lo dichiara.
 *
 * ⚠️ NON metterla a `true` per "sbloccare" il pulsante. Rimetterla a `true`
 * senza aver prima collegato `translateWithFallbackBatched` E aver deciso come
 * segmentare il contenuto di un file generico significa ricominciare a scrivere
 * file falsi. La decisione sul segmentamento è il lavoro vero, non la chiamata.
 */
const BATCH_TRADUZIONE_ATTIVA = false;

interface BatchFile {
  path: string;
  relativePath: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  fileType: string;
  entryCount: number | null;
}

interface BatchScanResult {
  rootPath: string;
  files: BatchFile[];
  totalFiles: number;
  totalSizeBytes: number;
  fileTypeCounts: Array<{ fileType: string; count: number; totalSize: number }>;
  estimatedEntries: number;
}

interface FileStatus {
  path: string;
  status: "pending" | "translating" | "completed" | "error";
  progress: number;
  error?: string;
}

const LANGUAGES = TARGET_LANGUAGES;

const FILE_TYPE_COLORS: Record<string, string> = {
  Json: "bg-yellow-500/20 text-yellow-600",
  Po: "bg-green-500/20 text-green-600",
  Resx: "bg-blue-500/20 text-blue-600",
  Csv: "bg-orange-500/20 text-orange-600",
  Srt: "bg-pink-500/20 text-pink-600",
  Vtt: "bg-rose-500/20 text-rose-600",
  Ass: "bg-purple-500/20 text-purple-600",
  Xml: "bg-cyan-500/20 text-cyan-600",
  Yaml: "bg-indigo-500/20 text-indigo-600",
  Properties: "bg-emerald-500/20 text-emerald-600",
  Txt: "bg-gray-500/20 text-gray-600",
};

export function BatchFolderTranslator() {
  const { t } = useTranslation();
  
  const [scanResult, setScanResult] = useState<BatchScanResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [targetLang, setTargetLang] = useState("en");
  useDefaultTargetLang(setTargetLang);
  const [isScanning, setIsScanning] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<Map<string, FileStatus>>(new Map());
  const [overallProgress, setOverallProgress] = useState(0);
  const [outputFolder, setOutputFolder] = useState<string>("");
  
  const abortRef = useRef(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('batchTranslator.selectFolderTitle'),
      });
      
      if (selected) {
        setIsScanning(true);
        setScanResult(null);
        setSelectedFiles(new Set());
        setFileStatuses(new Map());
        
        const result = await invoke<BatchScanResult>("scan_folder_for_translation", {
          folderPath: selected,
          options: null,
        });
        
        setScanResult(result);
        // Seleziona tutti i file di default
        setSelectedFiles(new Set(result.files.map(f => f.path)));
      }
    } catch (error: unknown) {
      clientLogger.error("Scan error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectOutputFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('batchTranslator.selectOutputTitle'),
    });
    
    if (selected) {
      setOutputFolder(selected as string);
    }
  };

  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (scanResult) {
      setSelectedFiles(new Set(scanResult.files.map(f => f.path)));
    }
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  const selectByType = (type: string) => {
    if (scanResult) {
      const filtered = scanResult.files.filter(f => f.fileType === type);
      setSelectedFiles(new Set(filtered.map(f => f.path)));
    }
  };

  const handleTranslate = async () => {
    if (!scanResult || selectedFiles.size === 0) return;
    // Difesa in profondità: il pulsante è già disabilitato, ma questa funzione
    // scriveva file sul disco dell'utente — non deve poter partire nemmeno per
    // vie traverse (scorciatoie, chiamate programmatiche, un futuro refactor).
    if (!BATCH_TRADUZIONE_ATTIVA) return;

    setIsTranslating(true);
    setIsPaused(false);
    abortRef.current = false;

    const filesToProcess = scanResult.files.filter(f => selectedFiles.has(f.path));
    const total = filesToProcess.length;
    let processed = 0;

    // Inizializza stati
    const initialStatuses = new Map<string, FileStatus>();
    filesToProcess.forEach(f => {
      initialStatuses.set(f.path, { path: f.path, status: "pending", progress: 0 });
    });
    setFileStatuses(initialStatuses);

    for (const file of filesToProcess) {
      if (abortRef.current) break;
      
      while (isPaused && !abortRef.current) {
        await new Promise(r => setTimeout(r, 100));
      }

      setFileStatuses(prev => {
        const next = new Map(prev);
        next.set(file.path, { ...next.get(file.path)!, status: "translating", progress: 0 });
        return next;
      });

      try {
        // ⛔ 31/07/2026 — QUI SI SCRIVEVANO FILE NON TRADOTTI, DICHIARANDO SUCCESSO.
        //
        // Il codice rimosso leggeva il file, aspettava 500 ms (`// Per ora
        // simuliamo`) e poi chiamava `write_translated_file` passando
        // `content: content`, cioè il CONTENUTO ORIGINALE, con tanto di commento
        // `// In realtà dovrebbe essere tradotto`. Lato Rust `fs::write` scrive
        // davvero: l'utente si ritrovava sul disco dei `nome_it.ext` pieni di
        // inglese, e la UI segnava "completed / 100%".
        //
        // È la stessa famiglia di «traduzione completata al 100% con 0 errori»
        // mentre il gioco resta in inglese, ma peggio: lascia artefatti che
        // l'utente crede tradotti e potrebbe distribuire.
        //
        // Nessun gate poteva accorgersene: `read_file_for_translation` e
        // `write_translated_file` esistono entrambi e fanno il loro lavoro
        // correttamente — su dati che mentono.
        //
        // Il motore vero ESISTE (`translateWithFallbackBatched` in
        // lib/ai/ai-translate-direct.ts, con callback di progresso). Quello che
        // manca, ed è il motivo per cui era un TODO, è decidere COSA è
        // traducibile dentro un file generico: spezzare riga per riga corrompe
        // un JSON o un .rpy. Finché quella decisione non è presa, questa
        // funzione NON deve scrivere niente.
        throw new Error("BATCH_NON_IMPLEMENTATO");
      } catch (error: unknown) {
        const grezzo = error instanceof Error ? error.message : String(error);
        setFileStatuses(prev => {
          const next = new Map(prev);
          next.set(file.path, {
            path: file.path,
            status: "error",
            progress: 0,
            error: grezzo === "BATCH_NON_IMPLEMENTATO"
              ? t('batchTranslator.notImplemented')
              : grezzo
          });
          return next;
        });
      }

      processed++;
      setOverallProgress((processed / total) * 100);
    }

    setIsTranslating(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    abortRef.current = true;
    setIsPaused(false);
    setIsTranslating(false);
  };

  const completedCount = Array.from(fileStatuses.values()).filter(s => s.status === "completed").length;
  const errorCount = Array.from(fileStatuses.values()).filter(s => s.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Selezione Cartella */}
      {!scanResult && (
        <Card>
          <CardContent className="p-4">
            <div
              className="border-2 border-dashed border-violet-500/30 rounded-lg p-6 text-center hover:border-violet-400/50 transition-colors cursor-pointer bg-slate-900/30"
              onClick={handleSelectFolder}
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                  <h3 className="text-lg font-medium mb-2">{t('batchTranslator.scanning')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('batchTranslator.analyzingFiles')}
                  </p>
                </>
              ) : (
                <>
                  <FolderOpen className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                  <h3 className="text-base font-medium mb-1">{t('batchTranslator.selectFolder')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('batchTranslator.chooseFolder')}
                  </p>
                  <div className="flex justify-center gap-1.5 flex-wrap">
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">JSON</Badge>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">PO</Badge>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">RESX</Badge>
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">CSV</Badge>
                    <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30">SRT</Badge>
                    <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">VTT</Badge>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">ASS</Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risultati Scansione */}
      {scanResult && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderTree className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-medium">{scanResult.rootPath.split(/[/\\]/).pop()}</h3>
                <p className="text-xs text-muted-foreground">
                  {scanResult.totalFiles} {t('batchTranslator.files')} • {formatSize(scanResult.totalSizeBytes)} • ~{scanResult.estimatedEntries} {t('batchTranslator.strings')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSelectFolder}>
              <RefreshCw className="w-4 h-4 mr-1" />
              {t('batchTranslator.change')}
            </Button>
          </div>

          {/* Stats per tipo */}
          <div className="flex gap-2 flex-wrap">
            {scanResult.fileTypeCounts.map(({ fileType, count }) => (
              <Badge
                key={fileType}
                variant="outline"
                className={`cursor-pointer ${FILE_TYPE_COLORS[fileType] || ""}`}
                onClick={() => selectByType(fileType)}
              >
                {fileType}: {count}
              </Badge>
            ))}
          </div>

          {/* Controlli Traduzione */}
          <Card>
            <CardContent className="p-4">
              {/* Dirlo prima che l'utente selezioni i file, non dopo averglieli
                  "tradotti": la scansione qui sopra è reale e utile, la
                  traduzione no. */}
              {!BATCH_TRADUZIONE_ATTIVA && (
                <div
                  role="status"
                  className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-sm text-amber-200/90">
                    {t('batchTranslator.notImplemented')}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">{t('batchTranslator.targetLanguage')}</label>
                  <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <span className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">{t('batchTranslator.output')}</label>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleSelectOutputFolder}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {outputFolder ? outputFolder.split(/[/\\]/).pop() : t('batchTranslator.sameFolder')}
                  </Button>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  {!isTranslating ? (
                    <Button
                      onClick={handleTranslate}
                      disabled={!BATCH_TRADUZIONE_ATTIVA || selectedFiles.size === 0}
                      title={!BATCH_TRADUZIONE_ATTIVA ? t('batchTranslator.notImplemented') : undefined}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {t('batchTranslator.translateFiles')} {selectedFiles.size} {t('batchTranslator.files')}
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={handlePause}>
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </Button>
                      <Button variant="destructive" onClick={handleStop}>
                        {t('batchTranslator.stop')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Progress */}
              {isTranslating && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{completedCount} / {selectedFiles.size} {t('batchTranslator.completed')}</span>
                    {errorCount > 0 && (
                      <span className="text-red-500">{errorCount} {t('batchTranslator.errors')}</span>
                    )}
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>
              )}

              {/* Post-traduzione: CTA Agorà */}
              {!isTranslating && completedCount > 0 && completedCount === selectedFiles.size && (
                <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-green-950/40 to-emerald-950/40 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-medium text-green-300">
                        {completedCount} file tradotti con successo!
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/editor">
                        <Button variant="outline" size="xs" className="text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                          <Edit3 className="h-3 w-3 mr-1" />
                          Apri in Editor
                        </Button>
                      </Link>
                      <Link href="/community-hub?action=publish">
                        <Button size="xs" className="text-xs bg-purple-600 hover:bg-purple-500 text-white">
                          <Globe className="h-3 w-3 mr-1" />
                          Condividi
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista File */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('batchTranslator.file')} ({selectedFiles.size}/{scanResult.files.length} {t('batchTranslator.filesSelected')})
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    {t('batchTranslator.all')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    {t('batchTranslator.none')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>{t('batchTranslator.file')}</TableHead>
                    <TableHead className="w-20">{t('batchTranslator.type')}</TableHead>
                    <TableHead className="w-20">{t('batchTranslator.size')}</TableHead>
                    <TableHead className="w-20">{t('batchTranslator.stringsCol')}</TableHead>
                    <TableHead className="w-24">{t('batchTranslator.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanResult.files.map((file) => {
                    const status = fileStatuses.get(file.path);
                    return (
                      <TableRow key={file.path} className="hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedFiles.has(file.path)}
                            onCheckedChange={() => toggleFileSelection(file.path)}
                            disabled={isTranslating}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{file.fileName}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {file.relativePath}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={FILE_TYPE_COLORS[file.fileType] || ""}>
                            {file.extension.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatSize(file.sizeBytes)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {file.entryCount ?? "-"}
                        </TableCell>
                        <TableCell>
                          {status?.status === "pending" && (
                            <span className="text-xs text-muted-foreground">{t('batchTranslator.pending')}</span>
                          )}
                          {status?.status === "translating" && (
                            <span className="text-xs text-blue-500 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {t('batchTranslator.translating')}
                            </span>
                          )}
                          {status?.status === "completed" && (
                            <span className="text-xs text-green-500 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {t('batchTranslator.done')}
                            </span>
                          )}
                          {status?.status === "error" && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              {t('batchTranslator.error')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </>
      )}
    </div>
  );
}

export default BatchFolderTranslator;

