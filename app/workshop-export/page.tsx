'use client';

import React, { useState } from 'react';
import { Package, Download, AlertCircle, CheckCircle2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  exportForWorkshop,
  validateWorkshopConfig,
  type WorkshopExportConfig,
  type WorkshopTranslatedFile,
} from '@/lib/workshop-exporter';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { TARGET_LANGUAGES } from '@/lib/translation/target-languages';

const LANGUAGES = TARGET_LANGUAGES;

export default function WorkshopExportPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<WorkshopExportConfig>({
    gameName: '',
    gameAppId: 0,
    title: '',
    description: '',
    language: 'en',
    targetLanguage: 'it',
    author: '',
    version: '1.0.0',
    tags: [],
    engine: 'generic',
    visibility: 'public',
    changeNote: '',
  });
  
  const [files, setFiles] = useState<File[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const validation = validateWorkshopConfig(config);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && config.tags.length < 10) {
      setConfig(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (index: number) => {
    setConfig(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== index) }));
  };

  const handleExport = async () => {
    if (!validation.valid || files.length === 0) return;
    
    setExporting(true);
    try {
      const workshopFiles: WorkshopTranslatedFile[] = [];
      
      for (const file of files) {
        const isBinary = !file.name.match(/\.(json|csv|po|txt|xml|yaml|yml|ini|cfg|locres|lua|rpy)$/i);
        
        if (isBinary) {
          const buffer = await file.arrayBuffer();
          workshopFiles.push({
            relativePath: file.name,
            content: new Uint8Array(buffer),
            isBinary: true,
          });
        } else {
          const text = await file.text();
          workshopFiles.push({
            relativePath: file.name,
            content: text,
            isBinary: false,
          });
        }
      }

      const blob = await exportForWorkshop(config, workshopFiles);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.gameName.replace(/\s+/g, '_')}_Workshop_${config.targetLanguage}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (err: unknown) {
      clientLogger.error('Export failed:', err);
    }
    setExporting(false);
  };

  return (
    <div className="container mx-auto p-4 space-y-3">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 p-3 text-white">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-2.5">
          <div className="p-2 bg-black/30 rounded-lg border border-white/10">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">{t('workshopExportPage.title')}</h1>
            <p className="text-white/60 text-2xs">
              {t('workshopExportPage.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Config Form */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('ueTranslator.configuration')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('workshopExportPage.gameName')}</Label>
                  <Input
                    value={config.gameName}
                    onChange={(e) => setConfig(prev => ({ ...prev, gameName: e.target.value }))}
                    placeholder={t('workshopExportPage.gameNamePlaceholder')}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('workshopExportPage.steamAppId')}</Label>
                  <Input
                    type="number"
                    value={config.gameAppId || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, gameAppId: parseInt(e.target.value) || 0 }))}
                    placeholder={t('workshopExportPage.appIdPlaceholder')}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('workshopExportPage.workshopTitle')}</Label>
                <Input
                  value={config.title}
                  onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t('workshopExportPage.titlePlaceholder')}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('workshopExportPage.targetLang')}</Label>
                  <Select value={config.targetLanguage} onValueChange={(v) => setConfig(prev => ({ ...prev, targetLanguage: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => (
                        <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('gameDetails.engine')}</Label>
                  <Select value={config.engine} onValueChange={(v: 'unity' | 'unreal' | 'generic') => setConfig(prev => ({ ...prev, engine: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unity">{t('workshopExportPage.unity')}</SelectItem>
                      <SelectItem value="unreal">{t('workshopExportPage.unrealEngine')}</SelectItem>
                      <SelectItem value="generic">{t('workshopExportPage.generic')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('workshopExportPage.visibility')}</Label>
                  <Select value={config.visibility} onValueChange={(v: 'public' | 'friends_only' | 'private') => setConfig(prev => ({ ...prev, visibility: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">{t('workshopExportPage.public')}</SelectItem>
                      <SelectItem value="friends_only">{t('workshopExportPage.friendsOnly')}</SelectItem>
                      <SelectItem value="private">{t('workshopExportPage.private')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('workshopExportPage.author')}</Label>
                  <Input
                    value={config.author}
                    onChange={(e) => setConfig(prev => ({ ...prev, author: e.target.value }))}
                    placeholder={t('workshopExportPage.authorPlaceholder')}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('plugins.version')}</Label>
                  <Input
                    value={config.version}
                    onChange={(e) => setConfig(prev => ({ ...prev, version: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('plugins.description')}</Label>
                <Textarea
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('workshopExportPage.descriptionPlaceholder')}
                  className="text-xs min-h-[80px]"
                />
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <Label className="text-xs">{t('workshopExportPage.tags')}</Label>
                <div className="flex items-center gap-1 flex-wrap">
                  {config.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-2xs cursor-pointer" onClick={() => handleRemoveTag(i)}>
                      {tag} &times;
                    </Badge>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder={t('workshopExportPage.addTagPlaceholder')}
                      className="h-6 text-2xs w-28"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Files */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('workshopExportPage.translatedFiles')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center">
                <input
                  type="file"
                  multiple
                  onChange={handleFileAdd}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Package className="h-8 w-8 mx-auto text-zinc-500 mb-2" />
                  <p className="text-xs text-zinc-400">{t('workshopExportPage.clickToAdd')}</p>
                  <p className="text-2xs text-zinc-600">{t('workshopExportPage.supportedFormats')}</p>
                </label>
              </div>

              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded bg-zinc-800/50 text-xs">
                      <span className="truncate">{file.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">{(file.size / 1024).toFixed(1)} KB</span>
                        <button onClick={() => handleRemoveFile(i)} className="text-red-400 hover:text-red-300">&times;</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview & Export */}
        <div className="space-y-3">
          {/* Validation */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('workshopExportPage.validation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {validation.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-1 text-red-400 text-2xs">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" /> {err}
                </div>
              ))}
              {validation.warnings.map((warn, i) => (
                <div key={i} className="flex items-center gap-1 text-amber-400 text-2xs">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" /> {warn}
                </div>
              ))}
              {validation.valid && validation.warnings.length === 0 && (
                <div className="flex items-center gap-1 text-emerald-400 text-2xs">
                  <CheckCircle2 className="h-3 w-3" /> {t('workshopExportPage.configValid')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Package Preview */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1">
                <Eye className="h-3 w-3" /> {t('workshopExportPage.packagePreview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-2xs text-zinc-400">
              <div>workshop_item.json</div>
              <div>README.md</div>
              <div>preview.svg</div>
              <div>install.bat / install.sh</div>
              {files.map((f, i) => (
                <div key={i} className="text-zinc-500">content/{f.name}</div>
              ))}
              <div className="pt-1 border-t border-zinc-800 text-zinc-500">
                {files.length} {t('common.file')}, ~{(files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(0)} KB
              </div>
            </CardContent>
          </Card>

          {/* Export Button */}
          <Button
            className="w-full"
            disabled={!validation.valid || files.length === 0 || exporting}
            onClick={handleExport}
          >
            {exported ? (
              <><CheckCircle2 className="h-4 w-4 mr-1" /> {t('workshopExportPage.exported')}</>
            ) : exporting ? (
              t('workshopExportPage.exporting')
            ) : (
              <><Download className="h-4 w-4 mr-1" />{t('common.esportaPerWorkshop')}</>
            )}
          </Button>
          
          <p className="text-2xs text-zinc-600 text-center">
            {t('workshopExportPage.footerNote')}
          </p>
        </div>
      </div>
    </div>
  );
}

