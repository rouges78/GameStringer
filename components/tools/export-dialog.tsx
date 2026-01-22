'use client';

import { useState, useEffect } from 'react';
import { 
  Download, FileSpreadsheet, FileCode, FileText, 
  Database, Check, Loader2, FolderOpen, FileJson
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { invoke } from '@/lib/tauri-api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TranslationEntry {
  id: string;
  source: string;
  target: string;
  context?: string;
  notes?: string;
}

interface FormatInfo {
  id: string;
  name: string;
  extension: string;
  description: string;
  supportsImport: boolean;
  supportsExport: boolean;
}

interface ExportResult {
  success: boolean;
  format: string;
  path: string;
  entriesCount: number;
  fileSize: number;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: TranslationEntry[];
  sourceLang?: string;
  targetLang?: string;
  defaultFileName?: string;
}

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  csv: <FileSpreadsheet className="h-5 w-5" />,
  xliff: <FileCode className="h-5 w-5" />,
  xliff2: <FileCode className="h-5 w-5" />,
  po: <FileText className="h-5 w-5" />,
  pot: <FileText className="h-5 w-5" />,
  json: <FileJson className="h-5 w-5" />,
  tmx: <Database className="h-5 w-5" />,
};

export function ExportDialog({
  open,
  onOpenChange,
  entries,
  sourceLang = 'en',
  targetLang = 'it',
  defaultFileName = 'translations'
}: ExportDialogProps) {
  const [formats, setFormats] = useState<FormatInfo[]>([]);
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [includeContext, setIncludeContext] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadFormats = async () => {
      try {
        const fmts = await invoke<FormatInfo[]>('get_supported_formats');
        setFormats(fmts.filter(f => f.supportsExport));
      } catch (e) {
        console.error('[Export] Error loading formats:', e);
      }
    };
    if (open) {
      loadFormats();
      setResult(null);
    }
  }, [open]);

  const handleExport = async () => {
    setIsExporting(true);
    setResult(null);

    try {
      // Get desktop path for save location
      const desktopPath = await invoke<string>('get_desktop_path');
      const format = formats.find(f => f.id === selectedFormat);
      const extension = format?.extension || '.csv';
      const outputPath = `${desktopPath}/${defaultFileName}_${targetLang}${extension}`;

      const options = {
        format: selectedFormat,
        sourceLang,
        targetLang,
        includeContext,
        includeNotes,
        includeEmpty,
      };

      let exportResult: ExportResult;

      switch (selectedFormat) {
        case 'csv':
          exportResult = await invoke<ExportResult>('export_to_csv', {
            entries,
            outputPath,
            options
          });
          break;
        case 'xliff':
        case 'xliff2':
          exportResult = await invoke<ExportResult>('export_to_xliff', {
            entries,
            outputPath: outputPath.replace('.csv', '.xlf'),
            options: { ...options, format: selectedFormat }
          });
          break;
        case 'po':
        case 'pot':
          exportResult = await invoke<ExportResult>('export_to_po', {
            entries,
            outputPath: outputPath.replace('.csv', selectedFormat === 'pot' ? '.pot' : '.po'),
            options
          });
          break;
        case 'json':
          exportResult = await invoke<ExportResult>('export_to_json', {
            entries,
            outputPath: outputPath.replace('.csv', '.json'),
            options
          });
          break;
        default:
          throw new Error(`Formato non supportato: ${selectedFormat}`);
      }

      setResult(exportResult);
      toast({
        title: '✅ Export completato!',
        description: `${exportResult.entriesCount} traduzioni esportate in ${exportResult.format}`
      });
    } catch (e) {
      console.error('[Export] Error:', e);
      toast({
        title: 'Errore export',
        description: String(e),
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-400" />
            Esporta Traduzioni
          </DialogTitle>
          <DialogDescription>
            {entries.length} traduzioni da esportare ({sourceLang} → {targetLang})
          </DialogDescription>
        </DialogHeader>

        {result ? (
          // Success state
          <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-emerald-400 mb-2">Export Completato!</h3>
            <div className="space-y-1 text-sm text-slate-400">
              <p><strong>Formato:</strong> {result.format}</p>
              <p><strong>Traduzioni:</strong> {result.entriesCount}</p>
              <p><strong>Dimensione:</strong> {formatSize(result.fileSize)}</p>
              <p className="text-xs mt-3 p-2 bg-slate-800/50 rounded truncate">
                📁 {result.path}
              </p>
            </div>
          </div>
        ) : (
          // Form state
          <div className="space-y-6 py-4">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Formato</Label>
              <RadioGroup value={selectedFormat} onValueChange={setSelectedFormat}>
                <div className="grid grid-cols-2 gap-2">
                  {formats.map((format) => (
                    <div
                      key={format.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedFormat === format.id
                          ? "bg-blue-500/10 border-blue-500/50"
                          : "bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50"
                      )}
                      onClick={() => setSelectedFormat(format.id)}
                    >
                      <RadioGroupItem value={format.id} id={format.id} className="sr-only" />
                      <div className={cn(
                        "text-slate-400",
                        selectedFormat === format.id && "text-blue-400"
                      )}>
                        {FORMAT_ICONS[format.id] || <FileText className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{format.name}</p>
                        <p className="text-xs text-slate-500 truncate">{format.extension}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Opzioni</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-context" className="text-sm text-slate-400">
                    Includi contesto
                  </Label>
                  <Switch
                    id="include-context"
                    checked={includeContext}
                    onCheckedChange={setIncludeContext}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-notes" className="text-sm text-slate-400">
                    Includi note
                  </Label>
                  <Switch
                    id="include-notes"
                    checked={includeNotes}
                    onCheckedChange={setIncludeNotes}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-empty" className="text-sm text-slate-400">
                    Includi traduzioni vuote
                  </Label>
                  <Switch
                    id="include-empty"
                    checked={includeEmpty}
                    onCheckedChange={setIncludeEmpty}
                  />
                </div>
              </div>
            </div>

            {/* Format description */}
            {selectedFormat && (
              <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <p className="text-xs text-slate-400">
                  {formats.find(f => f.id === selectedFormat)?.description}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button 
                onClick={handleExport} 
                disabled={isExporting || entries.length === 0}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Esportazione...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Esporta
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
