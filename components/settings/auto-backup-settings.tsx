'use client';

import { useState } from 'react';
import { 
  Save, Clock, Database, Settings, FileText, 
  RefreshCw, Download, Trash2, RotateCcw, HardDrive,
  CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAutoBackup, type AutoBackupInfo } from '@/hooks/use-auto-backup';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export function AutoBackupSettings() {
  const { t } = useTranslation();
  const {
    config,
    setConfig,
    isRunning,
    backups,
    loading,
    runBackup,
    restoreBackup,
    loadBackups,
  } = useAutoBackup();

  const [restoreDialog, setRestoreDialog] = useState<AutoBackupInfo | null>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getBackupTypeIcon = (type: string) => {
    switch (type) {
      case 'translation_memory': return <Database className="h-4 w-4 text-blue-400" />;
      case 'dictionaries': return <FileText className="h-4 w-4 text-green-400" />;
      case 'settings': return <Settings className="h-4 w-4 text-purple-400" />;
      default: return <HardDrive className="h-4 w-4 text-slate-400" />;
    }
  };

  const getBackupTypeLabel = (type: string) => {
    switch (type) {
      case 'translation_memory': return 'Translation Memory';
      case 'dictionaries': return 'Dizionari';
      case 'settings': return 'Impostazioni';
      default: return type;
    }
  };

  const handleRestore = async () => {
    if (!restoreDialog) return;
    try {
      await restoreBackup(restoreDialog.path, restoreDialog.backupType);
      setRestoreDialog(null);
    } catch (e) {
      // Toast già gestito nell'hook
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Save className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-emerald-100">Auto-Backup</CardTitle>
                <CardDescription className="text-emerald-300/70">
                  Salvataggio automatico del tuo lavoro
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {config.lastBackup && (
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-300">
                  <Clock className="h-3 w-3 mr-1" />
                  Ultimo: {formatDate(config.lastBackup)}
                </Badge>
              )}
              <Button 
                onClick={runBackup} 
                disabled={isRunning}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {isRunning ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Backup Ora
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Settings Card */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurazione
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Auto-Backup Attivo</Label>
              <p className="text-xs text-slate-500">Salva automaticamente a intervalli regolari</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
            />
          </div>

          {/* Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Intervallo Backup</Label>
              <Badge variant="secondary">{config.intervalMinutes} minuti</Badge>
            </div>
            <Slider
              value={[config.intervalMinutes]}
              onValueChange={([value]) => setConfig({ ...config, intervalMinutes: value })}
              min={5}
              max={60}
              step={5}
              disabled={!config.enabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>5 min</span>
              <span>30 min</span>
              <span>60 min</span>
            </div>
          </div>

          {/* What to backup */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Cosa salvare</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                  config.backupTranslationMemory 
                    ? "bg-blue-500/10 border-blue-500/50" 
                    : "bg-slate-800/50 border-slate-700/50"
                )}
                onClick={() => setConfig({ ...config, backupTranslationMemory: !config.backupTranslationMemory })}
              >
                <Database className={cn("h-5 w-5", config.backupTranslationMemory ? "text-blue-400" : "text-slate-500")} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Translation Memory</p>
                  <p className="text-xs text-slate-500">Traduzioni salvate</p>
                </div>
                {config.backupTranslationMemory && <CheckCircle2 className="h-4 w-4 text-blue-400" />}
              </div>

              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                  config.backupDictionaries 
                    ? "bg-green-500/10 border-green-500/50" 
                    : "bg-slate-800/50 border-slate-700/50"
                )}
                onClick={() => setConfig({ ...config, backupDictionaries: !config.backupDictionaries })}
              >
                <FileText className={cn("h-5 w-5", config.backupDictionaries ? "text-green-400" : "text-slate-500")} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Dizionari</p>
                  <p className="text-xs text-slate-500">Glossari giochi</p>
                </div>
                {config.backupDictionaries && <CheckCircle2 className="h-4 w-4 text-green-400" />}
              </div>

              <div 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                  config.backupSettings 
                    ? "bg-purple-500/10 border-purple-500/50" 
                    : "bg-slate-800/50 border-slate-700/50"
                )}
                onClick={() => setConfig({ ...config, backupSettings: !config.backupSettings })}
              >
                <Settings className={cn("h-5 w-5", config.backupSettings ? "text-purple-400" : "text-slate-500")} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Impostazioni</p>
                  <p className="text-xs text-slate-500">Profili utente</p>
                </div>
                {config.backupSettings && <CheckCircle2 className="h-4 w-4 text-purple-400" />}
              </div>
            </div>
          </div>

          {/* Max backups */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Backup da mantenere</Label>
              <Badge variant="secondary">{config.maxBackups} backup</Badge>
            </div>
            <Slider
              value={[config.maxBackups]}
              onValueChange={([value]) => setConfig({ ...config, maxBackups: value })}
              min={5}
              max={50}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-slate-500">
              I backup più vecchi verranno eliminati automaticamente
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Cronologia Backup ({backups.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadBackups}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nessun backup automatico trovato</p>
              <p className="text-sm">Esegui il primo backup manualmente</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {backups.map((backup, idx) => (
                  <div 
                    key={backup.path}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      "bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50"
                    )}
                  >
                    {getBackupTypeIcon(backup.backupType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getBackupTypeLabel(backup.backupType)}</p>
                      <p className="text-xs text-slate-500">{formatDate(backup.createdAt)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatSize(backup.sizeBytes)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-emerald-500/20 hover:text-emerald-400"
                      onClick={() => setRestoreDialog(backup)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <AlertDialog open={!!restoreDialog} onOpenChange={() => setRestoreDialog(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-400">
              <RotateCcw className="h-5 w-5" />
              Ripristina Backup
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Vuoi ripristinare questo backup? I dati attuali verranno sovrascritti.
              {restoreDialog && (
                <div className="mt-3 p-3 rounded-lg bg-slate-800/50 text-sm">
                  <p className="flex items-center gap-2">
                    {getBackupTypeIcon(restoreDialog.backupType)}
                    <span className="font-medium">{getBackupTypeLabel(restoreDialog.backupType)}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDate(restoreDialog.createdAt)} • {formatSize(restoreDialog.sizeBytes)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 hover:bg-slate-700">
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRestore}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Ripristina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
