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
      case 'settings': return <Settings className="h-4 w-4 text-cyan-400" />;
      default: return <HardDrive className="h-4 w-4 text-slate-400" />;
    }
  };

  const getBackupTypeLabel = (type: string) => {
    switch (type) {
      case 'translation_memory': return t('settings.translationMemory');
      case 'dictionaries': return t('settings.dictionaries');
      case 'settings': return t('settings.settingsLabel');
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
    <div className="space-y-3">
      {/* Header Card */}
      <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-700/50 p-3">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Save className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="font-semibold text-emerald-100">{t('settings.autoBackupTitle')}</p>
              <p className="text-xs text-emerald-300/70">{t('settings.autoBackupSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config.lastBackup && (
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-300 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {formatDate(config.lastBackup)}
              </Badge>
            )}
            <Button size="sm" onClick={runBackup} disabled={isRunning} className="bg-emerald-600 hover:bg-emerald-500 h-8">
              {isRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Backup
            </Button>
          </div>
        </div>
      </Card>

      {/* Settings Card */}
      <Card className="bg-slate-900/50 border-slate-700/50 p-3">
        <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5" />
          {t('settings.configuration')}
        </p>
        <div className="space-y-3">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">{t('settings.autoBackupActive')}</Label>
              <p className="text-xs text-slate-500">{t('settings.autoBackupActiveDesc')}</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
            />
          </div>

          {/* Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('settings.backupIntervalMinutes')}</Label>
              <Badge variant="secondary">{config.intervalMinutes} {t('settings.minutes')}</Badge>
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
            <Label className="text-sm font-medium">{t('settings.whatToSave')}</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div 
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer",
                  config.backupTranslationMemory 
                    ? "bg-blue-500/10 border-blue-500/50" 
                    : "bg-slate-800/50 border-slate-700/50"
                )}
                onClick={() => setConfig({ ...config, backupTranslationMemory: !config.backupTranslationMemory })}
              >
                <Database className={cn("h-5 w-5", config.backupTranslationMemory ? "text-blue-400" : "text-slate-500")} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('settings.translationMemory')}</p>
                  <p className="text-xs text-slate-500">{t('settings.savedTranslations')}</p>
                </div>
                {config.backupTranslationMemory && <CheckCircle2 className="h-4 w-4 text-blue-400" />}
              </div>

              <div 
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer",
                  config.backupDictionaries 
                    ? "bg-green-500/10 border-green-500/50" 
                    : "bg-slate-800/50 border-slate-700/50"
                )}
                onClick={() => setConfig({ ...config, backupDictionaries: !config.backupDictionaries })}
              >
                <FileText className={cn("h-5 w-5", config.backupDictionaries ? "text-green-400" : "text-slate-500")} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('settings.dictionaries')}</p>
                  <p className="text-xs text-slate-500">{t('settings.gameGlossaries')}</p>
                </div>
                {config.backupDictionaries && <CheckCircle2 className="h-4 w-4 text-green-400" />}
              </div>

              <div 
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer",
                  config.backupSettings 
                    ? "bg-cyan-500/10 border-cyan-500/50" 
                    : "bg-slate-800/50 border-slate-700/50"
                )}
                onClick={() => setConfig({ ...config, backupSettings: !config.backupSettings })}
              >
                <Settings className={cn("h-5 w-5", config.backupSettings ? "text-cyan-400" : "text-slate-500")} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('settings.settingsLabel')}</p>
                  <p className="text-xs text-slate-500">{t('settings.userProfiles')}</p>
                </div>
                {config.backupSettings && <CheckCircle2 className="h-4 w-4 text-cyan-400" />}
              </div>
            </div>
          </div>

          {/* Max backups */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('settings.backupsToKeep')}</Label>
              <Badge variant="secondary">{config.maxBackups} {t('settings.backup')}</Badge>
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
              {t('settings.oldBackupsDeleted')}
            </p>
          </div>
        </div>
      </Card>

      {/* Backup History */}
      <Card className="bg-slate-900/50 border-slate-700/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            {t('settings.backupHistory')} ({backups.length})
          </p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={loadBackups}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
          {backups.length === 0 ? (
            <div className="text-center py-4 text-slate-500">
              <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('settings.noBackupsFound')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
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
      </Card>

      {/* Restore Dialog */}
      <AlertDialog open={!!restoreDialog} onOpenChange={() => setRestoreDialog(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-400">
              <RotateCcw className="h-5 w-5" />
              {t('settings.restoreBackup')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t('settings.restoreConfirm')}
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
              {t('settings.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRestore}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {t('settings.restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
