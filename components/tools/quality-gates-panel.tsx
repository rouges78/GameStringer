'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { 
  ShieldCheck, AlertTriangle, XCircle, Info, CheckCircle, 
  Play, RefreshCw, FileText, Settings, Sparkles, Download
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { runQualityGates, QualityReport, QualityCheck } from '@/lib/quality-gates';

export function QualityGatesPanel() {
  const { t } = useTranslation();
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [context, setContext] = useState<'ui' | 'dialogue' | 'narrative' | 'system' | 'item' | 'general'>('general');
  const [minScore, setMinScore] = useState(70);
  const [maxLength, setMaxLength] = useState<number | undefined>(undefined);
  const [isValidating, setIsValidating] = useState(false);
  const [report, setReport] = useState<QualityReport | null>(null);

  const handleValidate = async () => {
    if (!sourceText.trim() || !translatedText.trim()) {
      toast.error(t('qualityGates.fillBoth'));
      return;
    }

    setIsValidating(true);
    try {
      const result = runQualityGates({
        sourceText,
        translatedText,
        context,
        minQualityScore: minScore,
        maxLength,
      });
      setReport(result);
      
      if (result.passed) {
        toast.success(t('qualityGates.passed'));
      } else {
        toast.warning(t('qualityGates.failed'));
      }
    } catch (error: any) {
      toast.error(error.message || t('qualityGates.error'));
    }
    setIsValidating(false);
  };

  const getCheckIcon = (check: QualityCheck) => {
    if (check.passed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    switch (check.severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  const exportReport = () => {
    if (!report) return;
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Hero Header - Stile verde */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {t('qualityGates.title')}
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('qualityGates.subtitle')}
              </p>
            </div>
          </div>
          
          {report && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportReport}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white"
            >
              <Download className="h-4 w-4 mr-1" />
              {t('qualityGates.export')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" />
              {t('qualityGates.input')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">{t('qualityGates.sourceText')}</Label>
              <Textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={t('qualityGates.sourcePlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t('qualityGates.translatedText')}</Label>
              <Textarea
                value={translatedText}
                onChange={(e) => setTranslatedText(e.target.value)}
                placeholder={t('qualityGates.translatedPlaceholder')}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">{t('qualityGates.context')}</Label>
                <Select value={context} onValueChange={(v: any) => setContext(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="ui">UI/Menu</SelectItem>
                    <SelectItem value="dialogue">Dialogue</SelectItem>
                    <SelectItem value="narrative">Narrative</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="item">Item/Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">{t('qualityGates.minScore')}</Label>
                  <span className="text-xs text-muted-foreground">{minScore}%</span>
                </div>
                <Slider
                  value={[minScore]}
                  onValueChange={([v]) => setMinScore(v)}
                  min={50}
                  max={100}
                  step={5}
                />
              </div>
            </div>

            <Button
              onClick={handleValidate}
              disabled={isValidating || !sourceText.trim() || !translatedText.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500"
            >
              {isValidating ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {t('qualityGates.validate')}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              {t('qualityGates.results')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!report ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{t('qualityGates.noResults')}</p>
                <p className="text-xs mt-1">{t('qualityGates.runValidation')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Score */}
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <div className={`text-4xl font-bold ${getScoreColor(report.overallScore)}`}>
                    {report.overallScore}%
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t('qualityGates.qualityScore')}
                  </div>
                  <Badge 
                    className={`mt-2 ${report.passed ? 'bg-green-500' : 'bg-red-500'}`}
                  >
                    {report.passed ? t('qualityGates.passedBadge') : t('qualityGates.failedBadge')}
                  </Badge>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <div className="text-lg font-bold text-red-500">{report.summary.errors}</div>
                    <div className="text-xs text-muted-foreground">{t('qualityGates.errors')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <div className="text-lg font-bold text-amber-500">{report.summary.warnings}</div>
                    <div className="text-xs text-muted-foreground">{t('qualityGates.warnings')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <div className="text-lg font-bold text-blue-500">{report.summary.infos}</div>
                    <div className="text-xs text-muted-foreground">{t('qualityGates.infos')}</div>
                  </div>
                </div>

                {/* Checks */}
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {report.checks.map((check) => (
                      <div
                        key={check.id}
                        className={`p-2 rounded-lg border ${
                          check.passed 
                            ? 'border-green-500/20 bg-green-500/5' 
                            : check.severity === 'error'
                              ? 'border-red-500/20 bg-red-500/5'
                              : 'border-amber-500/20 bg-amber-500/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {getCheckIcon(check)}
                          <span className="text-sm font-medium">{check.name}</span>
                        </div>
                        {check.message && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            {check.message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Suggestions */}
                {report.suggestions.length > 0 && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="text-xs font-medium text-blue-500 mb-2">
                      {t('qualityGates.suggestions')}
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {report.suggestions.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
