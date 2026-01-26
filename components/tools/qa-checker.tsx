'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, AlertCircle, Info, 
  CheckCircle2, XCircle, RefreshCw, Wand2, FileText,
  Tag, Hash, Type, Space, Binary, ChevronDown, BookOpen, Plus, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import { useTranslation } from '@/lib/i18n';

// Glossary term interface
interface GlossaryTerm {
  source: string;
  target: string;
}

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
  checkGlossary: boolean;
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
  checkGlossary: true,
  maxLengthRatio: 1.8,
  minLengthRatio: 0.4,
};

const GLOSSARY_STORAGE_KEY = 'gamestringer_qa_glossary';

export function QAChecker() {
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [issues, setIssues] = useState<QAIssue[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [config, setConfig] = useState<QAConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [newTermSource, setNewTermSource] = useState('');
  const [newTermTarget, setNewTermTarget] = useState('');
  const { toast } = useToast();

  // Load glossary from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GLOSSARY_STORAGE_KEY);
      if (saved) {
        setGlossary(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load glossary:', e);
    }
  }, []);

  // Save glossary to localStorage
  const saveGlossary = useCallback((terms: GlossaryTerm[]) => {
    setGlossary(terms);
    localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify(terms));
  }, []);

  // Add glossary term
  const addGlossaryTerm = useCallback(() => {
    if (!newTermSource.trim() || !newTermTarget.trim()) {
      toast({ title: t('qaCheck.enterBothTerms'), variant: 'destructive' });
      return;
    }
    const newTerms = [...glossary, { source: newTermSource.trim(), target: newTermTarget.trim() }];
    saveGlossary(newTerms);
    setNewTermSource('');
    setNewTermTarget('');
    toast({ title: `✅ ${t('qaCheck.termAdded')}` });
  }, [glossary, newTermSource, newTermTarget, saveGlossary, toast, t]);

  // Remove glossary term
  const removeGlossaryTerm = useCallback((index: number) => {
    const newTerms = glossary.filter((_, i) => i !== index);
    saveGlossary(newTerms);
  }, [glossary, saveGlossary]);

  // Check glossary terms in translation
  const checkGlossaryTerms = useCallback((): QAIssue[] => {
    if (!config.checkGlossary || glossary.length === 0) return [];
    
    const glossaryIssues: QAIssue[] = [];
    const sourceLower = source.toLowerCase();
    const targetLower = target.toLowerCase();

    for (const term of glossary) {
      const sourceTermLower = term.source.toLowerCase();
      const targetTermLower = term.target.toLowerCase();
      
      // Check if source contains the term
      if (sourceLower.includes(sourceTermLower)) {
        // Check if target contains the expected translation
        if (!targetLower.includes(targetTermLower)) {
          glossaryIssues.push({
            id: `glossary_${Date.now()}_${Math.random()}`,
            issueType: 'glossary_mismatch',
            severity: 'warning',
            message: `"${term.source}" → "${term.target}"`,
            sourceText: term.source,
            targetText: term.target,
            suggestion: t('qaCheck.glossarySuggestion').replace('{term}', term.target)
          });
        }
      }
    }
    
    return glossaryIssues;
  }, [source, target, glossary, config.checkGlossary, t]);

  const runCheck = useCallback(async () => {
    if (!source.trim() || !target.trim()) {
      toast({ title: t('qaCheck.enterBothTexts'), variant: 'destructive' });
      return;
    }

    setIsChecking(true);
    try {
      // Backend QA checks
      const result = await invoke<QAIssue[]>('qa_check_translation', {
        source,
        target,
        config
      });
      
      // Add glossary checks (frontend)
      const glossaryIssues = checkGlossaryTerms();
      const allIssues = [...result, ...glossaryIssues];
      
      setIssues(allIssues);
      
      if (allIssues.length === 0) {
        toast({ title: `✅ ${t('qaCheck.noIssues')}` });
      } else {
        const errors = allIssues.filter(i => i.severity === 'error').length;
        const warnings = allIssues.filter(i => i.severity === 'warning').length;
        toast({ 
          title: `${allIssues.length} ${t('qaCheck.issuesFound')}`,
          description: `${errors} ${t('qaCheck.errors')}, ${warnings} ${t('qaCheck.warnings')}`
        });
      }
    } catch (e) {
      console.error('[QA] Check error:', e);
      toast({ title: 'Errore', description: String(e), variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  }, [source, target, config, toast, checkGlossaryTerms]);

  const autoFix = useCallback(async (issueTypes: string[]) => {
    try {
      const fixed = await invoke<string>('qa_auto_fix', {
        target,
        issueTypes
      });
      setTarget(fixed);
      toast({ title: `✨ ${t('qaCheck.fixApplied')}` });
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
      case 'error': return <Badge variant="destructive">{t('qaCheck.error')}</Badge>;
      case 'warning': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">{t('qaCheck.warning')}</Badge>;
      case 'info': return <Badge variant="secondary">{t('qaCheck.info')}</Badge>;
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
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('qaCheck.title')}
              </h2>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('qaCheck.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {issues.length > 0 && (
              <>
                {errorCount > 0 && (
                  <Badge className="bg-white/20 text-white border-white/30 gap-1">
                    <XCircle className="h-3 w-3" /> {errorCount}
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge className="bg-white/20 text-white border-white/30 gap-1">
                    <AlertTriangle className="h-3 w-3" /> {warningCount}
                  </Badge>
                )}
                {infoCount > 0 && (
                  <Badge className="bg-white/20 text-white border-white/30 gap-1">
                    <Info className="h-3 w-3" /> {infoCount}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('qaCheck.originalText')}</Label>
          <Textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={t('qaCheck.enterOriginal')}
            className="h-32 bg-slate-800/50 border-slate-700 resize-none"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('qaCheck.translation')}</Label>
          <Textarea
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t('qaCheck.enterTranslation')}
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
              {t('qaCheck.qaOptions')}
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
                    <Label htmlFor="check-tags" className="text-sm">{t('qaCheck.htmlTags')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkPlaceholders}
                      onCheckedChange={(v) => setConfig({...config, checkPlaceholders: v})}
                      id="check-ph"
                    />
                    <Label htmlFor="check-ph" className="text-sm">{t('qaCheck.placeholder')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkLength}
                      onCheckedChange={(v) => setConfig({...config, checkLength: v})}
                      id="check-len"
                    />
                    <Label htmlFor="check-len" className="text-sm">{t('qaCheck.length')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkPunctuation}
                      onCheckedChange={(v) => setConfig({...config, checkPunctuation: v})}
                      id="check-punct"
                    />
                    <Label htmlFor="check-punct" className="text-sm">{t('qaCheck.punctuation')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkNumbers}
                      onCheckedChange={(v) => setConfig({...config, checkNumbers: v})}
                      id="check-num"
                    />
                    <Label htmlFor="check-num" className="text-sm">{t('qaCheck.numbers')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkWhitespace}
                      onCheckedChange={(v) => setConfig({...config, checkWhitespace: v})}
                      id="check-ws"
                    />
                    <Label htmlFor="check-ws" className="text-sm">{t('qaCheck.whitespace')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkEncoding}
                      onCheckedChange={(v) => setConfig({...config, checkEncoding: v})}
                      id="check-enc"
                    />
                    <Label htmlFor="check-enc" className="text-sm">{t('qaCheck.encoding')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.checkGlossary}
                      onCheckedChange={(v) => setConfig({...config, checkGlossary: v})}
                      id="check-glossary"
                    />
                    <Label htmlFor="check-glossary" className="text-sm flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {t('qaCheck.glossary')}
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Glossary Section */}
        <Collapsible open={showGlossary} onOpenChange={setShowGlossary}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronDown className={cn("h-4 w-4 transition-transform", showGlossary && "rotate-180")} />
              <BookOpen className="h-4 w-4" />
              {t('qaCheck.glossary')} ({glossary.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card className="bg-teal-900/20 border-teal-700/50">
              <CardContent className="pt-4 space-y-3">
                {/* Add new term */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('qaCheck.sourceTerm')}
                    value={newTermSource}
                    onChange={(e) => setNewTermSource(e.target.value)}
                    className="h-8 text-sm bg-slate-800/50 border-slate-700"
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    placeholder={t('qaCheck.targetTerm')}
                    value={newTermTarget}
                    onChange={(e) => setNewTermTarget(e.target.value)}
                    className="h-8 text-sm bg-slate-800/50 border-slate-700"
                    onKeyDown={(e) => e.key === 'Enter' && addGlossaryTerm()}
                  />
                  <Button size="sm" onClick={addGlossaryTerm} className="h-8 px-2">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Terms list */}
                {glossary.length > 0 ? (
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {glossary.map((term, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 rounded bg-slate-800/30 group">
                          <span className="text-sm text-teal-300 flex-1">{term.source}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-sm text-teal-200 flex-1">{term.target}</span>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                            onClick={() => removeGlossaryTerm(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {t('qaCheck.noTerms')}
                  </p>
                )}
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
              {t('qaCheck.autoFix')} ({fixableIssues.length})
            </Button>
          )}
          <Button
            onClick={runCheck}
            disabled={isChecking || !source.trim() || !target.trim()}
            variant="outline"
            className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10 hover:border-teal-400 gap-2"
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {t('qaCheck.runCheck')}
          </Button>
        </div>
      </div>

      {/* Results */}
      {issues.length > 0 ? (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {issues.length} {t('qaCheck.issuesFound')}
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
              <p className="text-emerald-300 font-medium">{t('qaCheck.noIssues')}</p>
              <p className="text-emerald-400/70 text-sm">{t('qaCheck.subtitle')}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
