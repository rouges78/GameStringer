'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Package,
  Download,
  Upload,
  Check,
  AlertTriangle,
  FileText,
  Loader2,
  CheckCircle,
  Globe,
  User,
  Gamepad2,
  X,
} from 'lucide-react';
import {
  createGspack,
  importGspack,
  saveGspackToFile,
  loadGspackFromFile,
  installPack,
  type ExportOptions,
  type GspackManifest,
  type GspackFile,
  type ImportResult,
} from '@/lib/gspack-manager';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

// ═══════════════════════════════════════════════════════════════════
// EXPORT DIALOG
// ═══════════════════════════════════════════════════════════════════

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameName: string;
  gameAppId?: number;
  platform: string;
  engine?: string;
  files?: Array<{ path: string; content: string; format: string }>;
}

export function GspackExportDialog({
  open, onOpenChange, gameName, gameAppId, platform, engine, files = [],
}: ExportDialogProps) {
  const { t } = useTranslation();
  const [packName, setPackName] = useState(`${gameName} — Traduzione IT`);
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [quality, setQuality] = useState<'draft' | 'reviewed' | 'final'>('draft');
  const [includeGlossary, setIncludeGlossary] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    if (!packName.trim() || !authorName.trim()) {
      toast.error(t('gspack.nameAndAuthorRequired'));
      return;
    }
    setExporting(true);
    try {
      const options: ExportOptions = {
        gameName,
        gameAppId,
        platform,
        engine,
        sourceLanguage: 'en',
        targetLanguage: 'it',
        authorName: authorName.trim(),
        packName: packName.trim(),
        description: description.trim(),
        quality,
        includeGlossary,
        includeNotes,
        notes: notes.trim(),
        files,
      };

      const { data, filename, manifest } = createGspack(options);
      const saved = await saveGspackToFile(data, filename);

      if (saved) {
        toast.success(`${t('gspack.packExported')}: ${filename}`, {
          description: `${manifest.translation.totalStrings} ${t('gspack.strings')}, ${(data.length / 1024).toFixed(0)}KB`,
        });
        setExported(true);
        setTimeout(() => {
          onOpenChange(false);
          setExported(false);
        }, 1500);
      }
    } catch (e: unknown) {
      toast.error(`${t('gspack.exportError')}: ${(e as Error).message}`);
    }
    setExporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-400" />
            {t('gspack.exportTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('gspack.exportDesc')} {gameName}
          </DialogDescription>
        </DialogHeader>

        {exported ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-emerald-400">{t('gspack.exportSuccess')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gioco info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/50">
              <Gamepad2 className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-sm font-bold text-slate-200">{gameName}</p>
                <p className="text-2xs text-slate-500">{platform} {engine ? `• ${engine}` : ''} {gameAppId ? `• ID ${gameAppId}` : ''}</p>
              </div>
              <Badge className="ml-auto text-micro bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                {files.length} {t('gspack.file')}
              </Badge>
            </div>

            {/* Nome pack */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('gspack.packName')}</Label>
              <Input value={packName} onChange={(e) => setPackName(e.target.value)} placeholder={t('gspack.packNamePlaceholder')} className="text-sm" />
            </div>

            {/* Autore */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('gspack.authorLabel')}</Label>
              <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={t('gspack.authorPlaceholder')} className="text-sm" />
            </div>

            {/* Descrizione */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('gspack.descriptionLabel')}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('gspack.descriptionPlaceholder')} className="h-16 text-sm" />
            </div>

            {/* Qualità */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('gspack.quality')}</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as "reviewed" | "draft" | "final")}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('gspack.qualityDraft')}</SelectItem>
                    <SelectItem value="reviewed">{t('gspack.qualityReviewed')}</SelectItem>
                    <SelectItem value="final">{t('gspack.qualityFinal')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 pt-5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('gspack.includeGlossary')}</Label>
                  <Switch checked={includeGlossary} onCheckedChange={setIncludeGlossary} />
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('gspack.translatorNotes')}</Label>
              <Switch checked={includeNotes} onCheckedChange={setIncludeNotes} />
            </div>
            {includeNotes && (
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('gspack.notesPlaceholder')} className="h-16 text-xs" />
            )}
          </div>
        )}

        {!exported && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('gspack.cancel')}</Button>
            <Button onClick={handleExport} disabled={exporting || !packName.trim() || !authorName.trim()}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {t('gspack.exportBtn')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// IMPORT DIALOG
// ═══════════════════════════════════════════════════════════════════

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (manifest: GspackManifest, files: GspackFile[]) => void;
}

export function GspackImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const { t } = useTranslation();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleLoad = async () => {
    setLoading(true);
    try {
      const content = await loadGspackFromFile();
      if (content) {
        const importResult = importGspack(content);
        setResult(importResult);
        if (!importResult.success) {
          toast.error(importResult.error || t('gspack.invalidPack'));
        }
      }
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  const handleInstall = () => {
    if (!result?.success || !result.manifest || !result.files) return;
    setInstalling(true);

    try {
      installPack(result.manifest, result.files.length);
      toast.success(`${result.manifest.name} ${t('gspack.packInstalled')}`);
      onImported?.(result.manifest, result.files);
      onOpenChange(false);
      setResult(null);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
    setInstalling(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setResult(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-400" />
            {t('gspack.importTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('gspack.importDesc')}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="py-8 text-center space-y-4">
            <Package className="h-12 w-12 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">{t('gspack.selectFile')}</p>
            <Button onClick={handleLoad} disabled={loading} className="mx-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {t('gspack.loadGspack')}
            </Button>
          </div>
        ) : result.success && result.manifest ? (
          <div className="space-y-4">
            {/* Pack info */}
            <div className="p-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/15 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">{result.manifest.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{result.manifest.description || t('gspack.noDescription')}</p>
                </div>
                <Badge className="text-micro bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  {result.manifest.translation.quality || 'draft'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-400">{result.manifest.game.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-400">{result.manifest.author.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-400">{result.manifest.translation.sourceLanguage} → {result.manifest.translation.targetLanguage}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-slate-400">{result.files?.length || 0} {t('gspack.file')}, {result.manifest.translation.totalStrings} {t('gspack.strings')}</span>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-slate-500">{t('gspack.completion')}</span>
                  <span className="font-bold text-emerald-400">{result.manifest.translation.completionPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${result.manifest.translation.completionPercent}%` }} />
                </div>
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/[0.05] border border-amber-500/15 space-y-1">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-2xs text-amber-400/80">{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Files list */}
            {result.files && result.files.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest">{t('gspack.includedFiles')}</span>
                {result.files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-300 truncate flex-1">{f.path}</span>
                    <Badge variant="secondary" className="font-mono text-micro">{f.format}</Badge>
                    <span className="text-micro text-slate-500">{f.translatedCount}/{f.stringCount}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Glossary */}
            {result.glossary && result.glossary.length > 0 && (
              <div className="text-2xs text-slate-500">
                {t('gspack.glossaryIncluded')}: {result.glossary.length} {t('gspack.terms')}
              </div>
            )}

            {/* Notes */}
            {result.notes && (
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-micro font-bold text-slate-500 uppercase tracking-widest block mb-1">{t('gspack.translatorNotes')}</span>
                <p className="text-xs text-slate-400">{result.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <X className="h-10 w-10 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">{result.error}</p>
          </div>
        )}

        {result?.success && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResult(null); }}>{t('gspack.changeFile')}</Button>
            <Button onClick={handleInstall} disabled={installing} className="bg-emerald-600 hover:bg-emerald-500">
              {installing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {t('gspack.installPack')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
