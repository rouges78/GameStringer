'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Search,
  Settings,
  Sparkles,
  Wrench,
  XCircle,
  Info,
  Zap
} from 'lucide-react';
import {
  TranslationIssue,
  IssueType,
  detectIssues,
  generateXUnityConfig,
  analyzeTranslationFile,
  detectGameType,
  GAME_SPECIFIC_FIXES,
} from '@/lib/translation-fixer';

const ISSUE_ICONS: Record<IssueType, React.ReactNode> = {
  markup_tag_visible: <AlertTriangle className="h-4 w-4" />,
  placeholder_corrupted: <XCircle className="h-4 w-4" />,
  encoding_error: <XCircle className="h-4 w-4" />,
  untranslated_mixed: <Info className="h-4 w-4" />,
  html_entity: <FileText className="h-4 w-4" />,
  escape_sequence: <FileText className="h-4 w-4" />,
  rpgmaker_tag: <Sparkles className="h-4 w-4" />,
  unity_richtext: <Zap className="h-4 w-4" />,
  unreal_format: <Settings className="h-4 w-4" />,
};

const ISSUE_COLORS: Record<IssueType, string> = {
  markup_tag_visible: 'bg-yellow-500',
  placeholder_corrupted: 'bg-red-500',
  encoding_error: 'bg-red-600',
  untranslated_mixed: 'bg-blue-500',
  html_entity: 'bg-orange-500',
  escape_sequence: 'bg-orange-500',
  rpgmaker_tag: 'bg-purple-500',
  unity_richtext: 'bg-cyan-500',
  unreal_format: 'bg-indigo-500',
};

const ISSUE_NAMES: Record<IssueType, string> = {
  markup_tag_visible: 'Visible Markup Tag',
  placeholder_corrupted: 'Corrupted Placeholder',
  encoding_error: 'Encoding Error',
  untranslated_mixed: 'Mixed Text',
  html_entity: 'HTML Entity',
  escape_sequence: 'Escape Sequence',
  rpgmaker_tag: 'RPG Maker Tag',
  unity_richtext: 'Unity Rich Text',
  unreal_format: 'Unreal Format',
};

export function TranslationFixer() {
  const [inputText, setInputText] = useState('');
  const [issues, setIssues] = useState<TranslationIssue[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState('');
  const [detectedGame, setDetectedGame] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleAnalyze = () => {
    if (!inputText.trim()) return;
    
    const result = analyzeTranslationFile(inputText, 'input');
    setIssues(result.issues);
    setAnalyzed(true);
    
    if (result.issues.length > 0) {
      const gameType = detectGameType(result.issues);
      setDetectedGame(gameType);
    }
  };

  const handleGenerateConfig = () => {
    const config = generateXUnityConfig(issues);
    setGeneratedConfig(config);
    setShowConfigDialog(true);
  };

  const handleCopyConfig = async () => {
    await navigator.clipboard.writeText(generatedConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadConfig = () => {
    const blob = new Blob([generatedConfig], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AutoTranslatorConfig_fix.ini';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleQuickFix = () => {
    // Applica fix automatici dove possibile
    let fixed = inputText;
    
    // Fix escape sequences
    fixed = fixed.replace(/\\n(?![a-z\[])/g, '\n');
    fixed = fixed.replace(/\\t/g, '\t');
    
    // Fix HTML entities
    fixed = fixed.replace(/&nbsp;/gi, ' ');
    fixed = fixed.replace(/&amp;/gi, '&');
    fixed = fixed.replace(/&lt;/gi, '<');
    fixed = fixed.replace(/&gt;/gi, '>');
    
    setInputText(fixed);
    handleAnalyze();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-500 border-red-500/30 bg-red-500/10';
      case 'warning': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      default: return 'text-blue-500 border-blue-500/30 bg-blue-500/10';
    }
  };

  const issuesByType = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {} as Record<IssueType, number>);

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">Translation Fixer</h2>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Detect and fix visible markup tags</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button onClick={handleAnalyze} className="bg-white text-orange-600 hover:bg-white/90 shadow-lg" size="lg">
              <Search className="h-5 w-5 mr-2" />
              Analyze
            </Button>
            {issues.length > 0 && (
              <Button onClick={handleQuickFix} className="bg-white/20 text-white hover:bg-white/30 border border-white/30" size="lg">
                <Zap className="h-5 w-5 mr-2" />
                Quick Fix
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/20">
              <FileText className="h-4 w-4 text-orange-400" />
            </div>
            <span className="text-orange-100">Text to Analyze</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setAnalyzed(false);
            }}
            placeholder="Paste text with visible tags here, e.g.: <index sprite=6 tint=1> Back"
            className="min-h-[120px] font-mono text-sm bg-black/20 border-orange-500/30 focus:border-orange-500/50"
          />
        </CardContent>
      </Card>

      {/* Results */}
      {analyzed && (
        <>
          {issues.length === 0 ? (
            <Alert className="border-green-500/30 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">No issues detected!</AlertTitle>
              <AlertDescription className="text-green-400/80">
                The text does not contain problematic markup tags.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Summary Alert */}
              <Alert className="border-yellow-500/30 bg-yellow-500/10">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertTitle className="text-yellow-500">
                  {issues.length} issue{issues.length > 1 ? 's' : ''} detected
                </AlertTitle>
                <AlertDescription className="text-yellow-400/80">
                  {detectedGame && GAME_SPECIFIC_FIXES[detectedGame] && (
                    <span>Detected: <strong>{GAME_SPECIFIC_FIXES[detectedGame].description}</strong></span>
                  )}
                </AlertDescription>
              </Alert>

              {/* Issue Type Summary */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(issuesByType).map(([type, count]) => (
                  <Badge 
                    key={type} 
                    className={`${ISSUE_COLORS[type as IssueType]} text-white`}
                  >
                    {ISSUE_ICONS[type as IssueType]}
                    <span className="ml-1">{ISSUE_NAMES[type as IssueType]}: {count}</span>
                  </Badge>
                ))}
              </div>

              {/* Actions */}
              <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-green-500/20">
                      <Sparkles className="h-4 w-4 text-green-400" />
                    </div>
                    <span className="text-green-100">Soluzioni Consigliate</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    onClick={handleGenerateConfig}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600"
                    size="sm"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Genera Config XUnity Automatica
                  </Button>
                  
                  {detectedGame && GAME_SPECIFIC_FIXES[detectedGame] && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-2">
                        📋 Istruzioni per {GAME_SPECIFIC_FIXES[detectedGame].description}:
                      </p>
                      <ol className="text-xs text-muted-foreground space-y-1">
                        {GAME_SPECIFIC_FIXES[detectedGame].instructions.map((inst, i) => (
                          <li key={i}>{i + 1}. {inst}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detailed Issues */}
              <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-red-500/20">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    </div>
                    <span className="text-red-100">Dettaglio Problemi</span>
                    <Badge variant="secondary" className="bg-red-500/20 text-red-300 text-xs ml-2">
                      {issues.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {issues.map((issue) => (
                        <div 
                          key={issue.id}
                          className={`p-2 rounded-md border ${getSeverityColor(issue.severity)}`}
                        >
                          <div className="flex items-start gap-2">
                            <Badge className={ISSUE_COLORS[issue.type]}>
                              {ISSUE_ICONS[issue.type]}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{ISSUE_NAMES[issue.type]}</p>
                              <p className="text-xs font-mono bg-black/20 p-1 rounded mt-1 truncate">
                                {issue.problematicPart}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                💡 {issue.suggestedFix}
                              </p>
                            </div>
                            {issue.autoFixable && (
                              <Badge variant="outline" className="text-[10px] border-green-500 text-green-500">
                                Auto-Fix
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>⚙️ Configurazione XUnity Generata</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copia questa configurazione nel file <code className="bg-muted px-1 rounded">BepInEx/config/AutoTranslatorConfig.ini</code>
            </p>
            
            <Textarea
              value={generatedConfig}
              readOnly
              className="min-h-[250px] font-mono text-xs"
            />
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Dopo aver modificato la configurazione, riavvia il gioco per applicare le modifiche.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCopyConfig}>
              <Copy className="h-4 w-4 mr-2" />
              {copied ? 'Copiato!' : 'Copia'}
            </Button>
            <Button onClick={handleDownloadConfig}>
              <Download className="h-4 w-4 mr-2" />
              Scarica .ini
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
