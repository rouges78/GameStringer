"use client";

import { useState, useCallback, useRef } from "react";
import { 
  FileText, 
  Upload, 
  Download, 
  Play, 
  Pause,
  Languages,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Type,
  Film,
  Trash2,
  RotateCcw,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import {
  SubtitleFile,
  SubtitleEntry,
  parseSubtitles,
  serializeSubtitles,
  getSubtitleStats,
  validateSubtitles,
  applyTranslations,
  msToSrtTime
} from "@/lib/subtitle-parser";

interface SubtitleTranslatorProps {
  onTranslate?: (texts: string[], targetLang: string) => Promise<string[]>;
}

const LANGUAGES = [
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
];

const OUTPUT_FORMATS = [
  { value: "srt", label: "SRT (SubRip)" },
  { value: "vtt", label: "VTT (WebVTT)" },
  { value: "ass", label: "ASS (Advanced SSA)" },
];

export function SubtitleTranslator({ onTranslate }: SubtitleTranslatorProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [subtitleFile, setSubtitleFile] = useState<SubtitleFile | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [targetLang, setTargetLang] = useState<string>("it");
  const [outputFormat, setOutputFormat] = useState<string>("srt");
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null);
  const [editedText, setEditedText] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Stats e validazione
  const stats = subtitleFile ? getSubtitleStats(subtitleFile) : null;
  const validation = subtitleFile ? validateSubtitles(subtitleFile) : null;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseSubtitles(content);
      
      if (parsed) {
        setSubtitleFile(parsed);
        setOutputFormat(parsed.format);
        setSelectedEntry(null);
      } else {
        alert(t('subtitleTranslator.formatNotRecognized'));
      }
    };
    
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseSubtitles(content);
      
      if (parsed) {
        setSubtitleFile(parsed);
        setOutputFormat(parsed.format);
      }
    };
    
    reader.readAsText(file);
  }, []);

  const handleTranslate = useCallback(async () => {
    if (!subtitleFile || !onTranslate) return;

    setIsTranslating(true);
    setProgress(0);

    try {
      const texts = subtitleFile.entries.map(e => e.text);
      const batchSize = 20;
      const translations: string[] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const translated = await onTranslate(batch, targetLang);
        translations.push(...translated);
        setProgress(Math.min(100, ((i + batchSize) / texts.length) * 100));
      }

      const translatedFile = applyTranslations(subtitleFile, translations);
      setSubtitleFile(translatedFile);
      setProgress(100);
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  }, [subtitleFile, onTranslate, targetLang]);

  const handleExport = useCallback(() => {
    if (!subtitleFile) return;

    const content = serializeSubtitles(subtitleFile, outputFormat as 'srt' | 'vtt' | 'ass');
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const baseName = fileName.replace(/\.[^.]+$/, "");
    const newFileName = `${baseName}_${targetLang}.${outputFormat}`;
    
    const a = document.createElement("a");
    a.href = url;
    a.download = newFileName;
    a.click();
    
    URL.revokeObjectURL(url);
  }, [subtitleFile, outputFormat, fileName, targetLang]);

  const handleEntrySelect = useCallback((entry: SubtitleEntry) => {
    setSelectedEntry(entry.id);
    setEditedText(entry.translatedText || entry.text);
    setPreviewTime(entry.startMs);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!subtitleFile || selectedEntry === null) return;

    setSubtitleFile({
      ...subtitleFile,
      entries: subtitleFile.entries.map(e =>
        e.id === selectedEntry ? { ...e, translatedText: editedText } : e
      )
    });
  }, [subtitleFile, selectedEntry, editedText]);

  const handleClear = useCallback(() => {
    setSubtitleFile(null);
    setFileName("");
    setSelectedEntry(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h > 0 
      ? `${h}h ${m % 60}m ${s % 60}s`
      : m > 0 
        ? `${m}m ${s % 60}s`
        : `${s}s`;
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Upload Area */}
        {!subtitleFile && (
          <Card>
            <CardContent className="p-6">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">{t('subtitleTranslator.uploadSubtitles')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('subtitleTranslator.dragOrClick')}
                </p>
                <div className="flex justify-center gap-2">
                  <Badge variant="outline">SRT</Badge>
                  <Badge variant="outline">VTT</Badge>
                  <Badge variant="outline">ASS/SSA</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {subtitleFile && (
          <>
            {/* Header con stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-medium">{fileName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {stats?.totalEntries} {t('subtitleTranslator.subtitlesCount')} • {stats?.format} • {formatDuration(subtitleFile.entries[subtitleFile.entries.length - 1]?.endMs || 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  {t('subtitleTranslator.new')}
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('subtitleTranslator.lines')}</p>
                    <p className="font-semibold">{stats?.totalEntries}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('subtitleTranslator.duration')}</p>
                    <p className="font-semibold">{formatDuration(subtitleFile.entries[subtitleFile.entries.length - 1]?.endMs || 0)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('subtitleTranslator.characters')}</p>
                    <p className="font-semibold">{stats?.totalCharacters.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  {validation?.valid ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">{t('subtitleTranslator.status')}</p>
                    <p className="font-semibold">
                      {validation?.errors.length || 0} {t('subtitleTranslator.errors')}, {validation?.warnings.length || 0} {t('subtitleTranslator.warnings')}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Translation Controls */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">{t('subtitleTranslator.targetLanguage')}</label>
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
                    <label className="text-xs text-muted-foreground mb-1 block">{t('subtitleTranslator.outputFormat')}</label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTPUT_FORMATS.map((fmt) => (
                          <SelectItem key={fmt.value} value={fmt.value}>
                            {fmt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-5">
                    <Button 
                      onClick={handleTranslate} 
                      disabled={isTranslating || !onTranslate}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600"
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('subtitleTranslator.translating')}
                        </>
                      ) : (
                        <>
                          <Languages className="w-4 h-4 mr-2" />
                          {t('subtitleTranslator.translateAll')}
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="pt-5">
                    <Button 
                      variant="outline" 
                      onClick={handleExport}
                      disabled={!subtitleFile.entries.some(e => e.translatedText)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t('subtitleTranslator.export')}
                    </Button>
                  </div>
                </div>

                {isTranslating && (
                  <div className="mt-4">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      {Math.round(progress)}% {t('subtitleTranslator.completed')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subtitle Editor */}
            <div className="grid grid-cols-2 gap-4">
              {/* Lista sottotitoli */}
              <Card className="h-[500px] flex flex-col">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('subtitleTranslator.subtitles')} ({subtitleFile.entries.length})
                  </CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="w-24">{t('subtitleTranslator.time')}</TableHead>
                        <TableHead>{t('subtitleTranslator.text')}</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subtitleFile.entries.map((entry) => (
                        <TableRow 
                          key={entry.id}
                          className={`cursor-pointer hover:bg-muted/50 ${selectedEntry === entry.id ? 'bg-primary/10' : ''}`}
                          onClick={() => handleEntrySelect(entry)}
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {entry.id}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {msToSrtTime(entry.startMs).slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="line-clamp-2">
                              {entry.translatedText || entry.text}
                            </div>
                            {entry.translatedText && (
                              <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                {entry.text}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.translatedText && (
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>

              {/* Editor singolo */}
              <Card className="h-[500px] flex flex-col">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    {t('subtitleTranslator.editor')}
                    {selectedEntry !== null && (
                      <Badge variant="outline" className="ml-2">
                        #{selectedEntry}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-4 flex flex-col">
                  {selectedEntry !== null ? (
                    <>
                      {/* Originale */}
                      <div className="mb-4">
                        <label className="text-xs text-muted-foreground mb-1 block">{t('subtitleTranslator.original')}</label>
                        <div className="p-3 bg-muted/30 rounded-md text-sm">
                          {subtitleFile.entries.find(e => e.id === selectedEntry)?.text}
                        </div>
                      </div>

                      {/* Traduzione editabile */}
                      <div className="flex-1 flex flex-col">
                        <label className="text-xs text-muted-foreground mb-1 block">{t('subtitleTranslator.translation')}</label>
                        <Textarea
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          className="flex-1 resize-none"
                          placeholder={t('subtitleTranslator.translationPlaceholder')}
                        />
                      </div>

                      {/* Azioni */}
                      <div className="flex justify-between mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const entry = subtitleFile.entries.find(e => e.id === selectedEntry);
                            setEditedText(entry?.text || "");
                          }}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          {t('subtitleTranslator.reset')}
                        </Button>
                        <Button size="sm" onClick={handleEditSave}>
                          {t('subtitleTranslator.save')}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('subtitleTranslator.selectToEdit')}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Warnings */}
            {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    {t('subtitleTranslator.issuesDetected')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {validation.errors.map((err, i) => (
                        <div key={`err-${i}`} className="text-xs text-red-500 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-500" />
                          {err}
                        </div>
                      ))}
                      {validation.warnings.map((warn, i) => (
                        <div key={`warn-${i}`} className="text-xs text-yellow-600 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-yellow-500" />
                          {warn}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

export default SubtitleTranslator;
