'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, AlertTriangle, FileText, ArrowLeft,
  Search, Sparkles, Upload, ChevronRight, Zap,
  FileCode, CheckCircle, Square, Cpu, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { SUPPORTED_FORMATS, FORMAT_DESCRIPTIONS, type ParseResult, type FileFormat } from '@/lib/neural-translator';
import { LanguageFlags } from '@/components/ui/language-flags';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectedFile {
  name: string;
  path?: string;
  content: string;
  format: FileFormat;
  parseResult: ParseResult;
  checked?: boolean;
}

export interface Game {
  id: string;
  name: string;
  provider: string;
  coverUrl?: string;
  installPath?: string;
  supportedLanguages?: string;
}

export interface EngineInfo {
  is_unity: boolean;
  is_unreal: boolean;
  engine_name: string;
  engine_version?: string;
  can_patch: boolean;
  message: string;
  alternative_tools: Array<{ name: string; url: string; description: string; compatible: boolean }>;
  has_bepinex: boolean;
  has_xunity: boolean;
}

export interface LocalizationInfo {
  has_localization: boolean;
  localization_folder?: string;
  source_file?: { path: string; filename: string; language_code: string; language_name: string; size_bytes: number; format: string };
  available_languages: Array<{ path: string; filename: string; language_code: string; language_name: string; size_bytes: number; format: string }>;
  missing_italian: boolean;
  can_add_language: boolean;
  format: string;
  message: string;
}

export interface FilesWarning {
  type: 'config' | 'empty' | 'xunity_suggested' | null;
  message: string;
  configFiles: string[];
}

export interface FileSelectorProps {
  selectedGame: Game | null;
  selectedFiles: SelectedFile[];
  previewFile: SelectedFile | null;
  isLoadingFiles: boolean;
  isCheckingEngine: boolean;
  engineInfo: EngineInfo | null;
  localizationInfo: LocalizationInfo | null;
  filesWarning: FilesWarning | null;
  totalStrings: number;
  checkedFilesCount: number;
  wizardGameId: string | null;
  wizardMethod: string | null;
  wizardTargetLang: string | null;
  onGoBack: () => void;
  onSearchGameFiles: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (filename: string) => void;
  onPreviewFile: (file: SelectedFile) => void;
  onToggleFileChecked: (filename: string, checked: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onRemoveUnselected: () => void;
  onContinue: () => void;
  onLoadSourceFile: () => void;
  onGoToUnityPatcher: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FileSelector({
  selectedGame,
  selectedFiles,
  previewFile,
  isLoadingFiles,
  isCheckingEngine,
  engineInfo,
  localizationInfo,
  filesWarning,
  totalStrings,
  checkedFilesCount,
  wizardGameId,
  wizardMethod,
  wizardTargetLang,
  onGoBack,
  onSearchGameFiles,
  onFileUpload,
  onRemoveFile,
  onPreviewFile,
  onToggleFileChecked,
  onSelectAll,
  onSelectNone,
  onRemoveUnselected,
  onContinue,
  onLoadSourceFile,
  onGoToUnityPatcher,
}: FileSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {/* Wizard Banner */}
      {wizardGameId && wizardMethod && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-blue-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-300">
              Arrivi dal Translation Wizard
            </p>
            <p className="text-xs text-blue-400/70">
              Metodo consigliato: {wizardMethod === 'file' ? '📁 Modifica File' : wizardMethod === 'bridge' ? '🔌 Translation Bridge' : '🔧 Manuale'}
              {wizardTargetLang && ` • Lingua: ${wizardTargetLang.toUpperCase()}`}
            </p>
          </div>
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={onGoBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Cambia game
      </Button>

      {/* Selected Game - Compact */}
      {selectedGame && (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
          <div className="relative w-10 h-10 rounded overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex-shrink-0">
            {selectedGame.coverUrl ? (
              <Image
                src={selectedGame.coverUrl}
                alt={selectedGame.name}
                fill
                className="object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center -z-10">
              <span className="text-sm font-bold text-white/50">{selectedGame.name?.charAt(0)?.toUpperCase() || '?'}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{selectedGame.name}</h2>
            {selectedGame.supportedLanguages && (
              <div className="flex items-center gap-1 flex-wrap">
                <LanguageFlags supportedLanguages={selectedGame.supportedLanguages} maxFlags={20} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Engine + Localization Info - COMPACT */}
      {(isCheckingEngine || engineInfo || localizationInfo?.has_localization) && (
        <div className="p-2 rounded-lg border text-xs bg-muted/30 space-y-1.5">
          {isCheckingEngine ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analisi game...
            </div>
          ) : (
            <>
              {/* Engine row */}
              {engineInfo && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{engineInfo.engine_name}</span>
                    {engineInfo.has_bepinex && <Badge variant="outline" className="text-2xs h-3.5 px-1 bg-green-500/20">BepInEx</Badge>}
                    {engineInfo.has_xunity && <Badge variant="outline" className="text-2xs h-3.5 px-1 bg-blue-500/20">XUnity</Badge>}
                  </div>
                  <span className={cn("text-2xs", engineInfo.can_patch ? "text-green-500" : "text-amber-500")}>
                    {engineInfo.can_patch ? "✓ Compatibile" : "⚠ Tool esterni"}
                  </span>
                </div>
              )}

              {/* Localization row */}
              {localizationInfo?.has_localization && (
                <>
                  <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span>{localizationInfo.available_languages.length} lingue</span>
                      <Badge variant="outline" className="text-2xs h-3.5 px-1">{localizationInfo.format.toUpperCase()}</Badge>
                    </div>
                    <span className={cn("text-2xs", localizationInfo.missing_italian ? "text-amber-500" : "text-green-500")}>
                      {localizationInfo.missing_italian ? "⚠ IT mancante" : "✓ IT presente"}
                    </span>
                  </div>

                  {/* Quick load button */}
                  {localizationInfo.source_file && localizationInfo.missing_italian && (
                    <Button
                      size="sm"
                      className="w-full h-7 gap-1.5 text-xs bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                      onClick={onLoadSourceFile}
                      disabled={isLoadingFiles}
                    >
                      <Rocket className="h-3 w-3" />
                      Carica EN → Traduci IT
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Search Game Files Button - Compact */}
      <Button
        variant="default"
        size="default"
        className="w-full h-10 gap-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        onClick={onSearchGameFiles}
        disabled={isLoadingFiles}
      >
        {isLoadingFiles ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Ricerca...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Cerca file di traduzione
          </>
        )}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">oppure carica manualmente</span>
        </div>
      </div>

      {/* File Upload - Compact */}
      <div className="border border-dashed rounded-lg p-3 text-center">
        <input
          type="file"
          multiple
          accept=".json,.po,.pot,.xliff,.xlf,.resx,.strings,.ini,.csv,.properties,.txt"
          onChange={onFileUpload}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer flex items-center justify-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">Trascina o clicca • {SUPPORTED_FORMATS.join(', ')}</span>
        </label>
      </div>

      {/* Warning for config or missing files */}
      {filesWarning && (
        <div className={cn(
          "p-4 rounded-lg border",
          filesWarning.type === 'xunity_suggested'
            ? "bg-purple-500/10 border-purple-500/30"
            : filesWarning.type === 'config'
              ? "bg-yellow-500/10 border-yellow-500/30"
              : "bg-blue-500/10 border-blue-500/30"
        )}>
          <p className="text-sm font-medium mb-2">{filesWarning.message}</p>
          {filesWarning.type === 'xunity_suggested' && engineInfo?.is_unity && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                XUnity AutoTranslator intercetta il testo del game in tempo reale e permette di tradurlo.
              </p>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                onClick={onGoToUnityPatcher}
              >
                <Zap className="h-3 w-3 mr-1" />
                Vai a Unity Patcher
              </Button>
            </div>
          )}
          {filesWarning.configFiles.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                File esclusi ({filesWarning.configFiles.length})
              </summary>
              <ul className="text-xs text-muted-foreground mt-1 ml-4 list-disc">
                {filesWarning.configFiles.slice(0, 5).map(f => <li key={f}>{f}</li>)}
                {filesWarning.configFiles.length > 5 && <li>...e altri {filesWarning.configFiles.length - 5}</li>}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              File da tradurre ({selectedFiles.filter(f => f.checked !== false).length}/{selectedFiles.length})
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                className="h-7 text-xs"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Tutti
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectNone}
                className="h-7 text-xs"
              >
                <Square className="h-3 w-3 mr-1" />
                Nessuno
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRemoveUnselected}
                className="h-7 text-xs text-destructive hover:text-destructive"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Remove unselected
              </Button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* File List */}
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={file.path || `${file.name}-${index}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer transition-all",
                    file.checked === false ? "opacity-50 border-dashed" : "",
                    previewFile?.name === file.name ? "border-purple-500 bg-purple-500/5" : "hover:border-purple-500/50"
                  )}
                  onClick={() => onPreviewFile(file)}
                >
                  <input
                    type="checkbox"
                    checked={file.checked !== false}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleFileChecked(file.name, e.target.checked);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <FileCode className="h-5 w-5 text-purple-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {FORMAT_DESCRIPTIONS[file.format]} • {file.parseResult.strings.length} stringhe
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onRemoveFile(file.name); }}
                    className="text-destructive hover:text-destructive"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            {/* File Preview */}
            <div className="border rounded-xl p-4 bg-muted/30">
              {previewFile ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{previewFile.name}</h4>
                    <Badge variant="secondary">{previewFile.format.toUpperCase()}</Badge>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {previewFile.parseResult.strings.slice(0, 50).map((str, i) => (
                        <div key={i} className="p-2 rounded bg-background border text-xs">
                          <p className="font-mono text-muted-foreground truncate">{str.key}</p>
                          <p className="mt-1">{str.value}</p>
                        </div>
                      ))}
                      {previewFile.parseResult.strings.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          ... e altre {previewFile.parseResult.strings.length - 50} stringhe
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <FileText className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">{t('translatorProPage.clickFilePreview')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            <p className="text-sm text-muted-foreground">
              Totale: <strong>{totalStrings}</strong> stringhe da tradurre
            </p>
            <Button onClick={onContinue} disabled={checkedFilesCount === 0}>
              Continua
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
