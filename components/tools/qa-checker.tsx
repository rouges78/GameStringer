'use client';

import { useState, useCallback } from 'react';
import { 
  ShieldCheck, AlertTriangle, AlertCircle, Info, 
  CheckCircle2, XCircle, RefreshCw, Wand2, FileText,
  Tag, Hash, Type, Space, Binary, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { invoke } from '@/lib/tauri-api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface QAIssue {
  id: string;
  issueType: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  sourceText: string;
  targetText: string;
  position?: number;
  suggestion?: string;
}

interface QAConfig {
  checkTags: boolean;
  checkPlaceholders: boolean;
  checkLength: boolean;
  checkPunctuation: boolean;
  checkNumbers: boolean;
  checkWhitespace: boolean;
  checkEncoding: boolean;
  maxLengthRatio: number;
  minLengthRatio: number;
}

const DEFAULT_CONFIG: QAConfig = {
  checkTags: true,
  checkPlaceholders: true,
  checkLength: true,
  checkPunctuation: true,
  checkNumbers: true,
  checkWhitespace: true,
  checkEncoding: true,
  maxLengthRatio: 1.8,
  minLengthRatio: 0.4,
};

export function QAChecker() {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [issues, setIssues] = useState<QAIssue[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [config, setConfig] = useState<QAConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const { toast } = useToast();

  const runCheck = useCallback(async () => {
    if (!source.trim() || !target.trim()) {
      toast({ title: 'Inserisci testo source e target', variant: 'destructive' });
      return;
    }

    setIsChecking(true);
    try {
      const result = await invoke<QAIssue[]>('qa_check_translation', {
        source,
        target,
        config
      });
      setIssues(result);
      
      if (result.length === 0) {
        toast({ title: '✅ Nessun problema trovato!' });
      } else {
        const errors = result.filter(i => i.severity === 'error').length;
        const warnings = result.filter(i => i.severity === 'warning').length;
        toast({ 
          title: `Trovati ${result.length} problemi`,
          description: `${errors} errori, ${warnings} warning`
        });
      }
    } catch (e) {
      console.error('[QA] Check error:', e);
      toast({ title: 'Errore', description: String(e), variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  }, [source, target, config, toast]);

  const autoFix = useCallback(async (issueTypes: string[]) => {
    try {
      const fixed = await invoke<string>('qa_auto_fix', {
        target,
        issueTypes
      });
      setTarget(fixed);
      toast({ title: '✨ Correzioni applicate' });
      // Re-run check
      setTimeout(runCheck, 100);
    } catch (e) {
      toast({ title: 'Errore', description: String(e), variant: 'destructive' });
    }
  }, [target, toast, runCheck]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error': return <Badge variant="destructive">Errore</Badge>;
      case 'warning': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">Warning</Badge>;
      case 'info': return <Badge variant="secondary">Info</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getIssueTypeIcon = (type: string) => {
    if (type.includes('tag')) return <Tag className="h-4 w-4" />;
    if (type.includes('placeholder')) return <Hash className="h-4 w-4" />;
    if (type.includes('length')) return <Type className="h-4 w-4" />;
    if (type.includes('whitespace') || type.includes('space')) return <Space className="h-4 w-4" />;
    if (type.includes('encoding')) return <Binary className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  // Auto-fixable issues
  const fixableIssues = issues.filter(i => 
    ['leading_whitespace', 'trailing_whitespace', 'double_space'].includes(i.issueType)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-br from-violet-900/30 to-purple-900/30 border-violet-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <ShieldCheck className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-violet-100">QA Check</CardTitle>
                <p className="text-violet-300/70 text-sm">
                  Verifica automatica qualità traduzioni
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {issues.length > 0 && (
                <>
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" /> {errorCount}
                    </Badge>
                  )}
                  {warningCount > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50 gap-1">
                      <AlertTriangle className="h-3 w-3" /> {warningCount}
                    </Badge>
                  )}
                  {infoCount > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Info className="h-3 w-3" /> {infoCount}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Input Area */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Testo Originale</Label>
          <Textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Inserisci il testo originale..."
            className="h-32 bg-slate-800/50 border-slate-700 resize-none"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Traduzione</Label>
          <Textarea
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Inserisci la traduzione..."
            className="h-32 bg-slate-800/50 border-slate-700 resize-none"
          />
        </div>
      </div>

      {/* Config & Actions */}
      <div className="flex items-center justify-between">
        <Collapsible open={showConfig} onOpenChange={setShowConfig}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronDown className={cn("h-4 w-4 transition-transform", showConfig && "rotate-180")} />
              Opzioni QA
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card className="bg-slate-800/30 border-slate-700/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkTags}
                      onCheckedChange={(v) => setConfig({...config, checkTags: v})}
                      id="check-tags"
                    />
                    <Label htmlFor="check-tags" className="text-sm">Tag HTML</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkPlaceholders}
                      onCheckedChange={(v) => setConfig({...config, checkPlaceholders: v})}
                      id="check-ph"
                    />
                    <Label htmlFor="check-ph" className="text-sm">Placeholder</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkLength}
                      onCheckedChange={(v) => setConfig({...config, checkLength: v})}
                      id="check-len"
                    />
                    <Label htmlFor="check-len" className="text-sm">Lunghezza</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkPunctuation}
                      onCheckedChange={(v) => setConfig({...config, checkPunctuation: v})}
                      id="check-punct"
                    />
                    <Label htmlFor="check-punct" className="text-sm">Punteggiatura</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkNumbers}
                      onCheckedChange={(v) => setConfig({...config, checkNumbers: v})}
                      id="check-num"
                    />
                    <Label htmlFor="check-num" className="text-sm">Numeri</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkWhitespace}
                      onCheckedChange={(v) => setConfig({...config, checkWhitespace: v})}
                      id="check-ws"
                    />
                    <Label htmlFor="check-ws" className="text-sm">Spazi</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkEncoding}
                      onCheckedChange={(v) => setConfig({...config, checkEncoding: v})}
                      id="check-enc"
                    />
                    <Label htmlFor="check-enc" className="text-sm">Encoding</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center gap-2">
          {fixableIssues.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => autoFix(fixableIssues.map(i => i.issueType))}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Auto-Fix ({fixableIssues.length})
            </Button>
          )}
          <Button
            onClick={runCheck}
            disabled={isChecking || !source.trim() || !target.trim()}
            className="bg-violet-600 hover:bg-violet-500 gap-2"
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verifica
          </Button>
        </div>
      </div>

      {/* Results */}
      {issues.length > 0 ? (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Problemi Trovati ({issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      issue.severity === 'error' && "bg-red-500/10 border-red-500/30",
                      issue.severity === 'warning' && "bg-amber-500/10 border-amber-500/30",
                      issue.severity === 'info' && "bg-blue-500/10 border-blue-500/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getIssueTypeIcon(issue.issueType)}
                          <span className="font-medium text-sm">{issue.message}</span>
                          {getSeverityBadge(issue.severity)}
                        </div>
                        {issue.suggestion && (
                          <p className="text-xs text-slate-400 mt-1">
                            💡 {issue.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : source && target && !isChecking ? (
        <Card className="bg-emerald-900/20 border-emerald-700/50">
          <CardContent className="py-8">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
              <p className="text-emerald-300 font-medium">Nessun problema trovato!</p>
              <p className="text-emerald-400/70 text-sm">La traduzione supera tutti i controlli QA</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
