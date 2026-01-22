"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  reviewTranslation,
  reviewBatch,
  autoFix,
  ReviewResult,
  ReviewStats,
  REVIEW_CATEGORIES,
  SEVERITY_CONFIG,
  ReviewCategory,
  ReviewSeverity
} from "@/lib/ai-review-agent"
import {
  Bot,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Wand2,
  FileText,
  BarChart3,
  ChevronRight,
  Copy,
  Check
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export default function AIReviewPage() {
  const { t, language } = useTranslation()
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('single')
  const [original, setOriginal] = useState("")
  const [translated, setTranslated] = useState("")
  const [batchInput, setBatchInput] = useState("")
  const [isReviewing, setIsReviewing] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [batchResults, setBatchResults] = useState<{ results: ReviewResult[]; stats: ReviewStats } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSingleReview = useCallback(() => {
    if (!original.trim() || !translated.trim()) return
    
    setIsReviewing(true)
    setTimeout(() => {
      const reviewResult = reviewTranslation(original, translated, 'it')
      setResult(reviewResult)
      setIsReviewing(false)
    }, 300)
  }, [original, translated])

  const handleBatchReview = useCallback(() => {
    if (!batchInput.trim()) return
    
    setIsReviewing(true)
    setTimeout(() => {
      const lines = batchInput.trim().split('\n')
      const translations = lines
        .filter(line => line.includes('|'))
        .map((line, i) => {
          const [orig, trans] = line.split('|').map(s => s.trim())
          return { id: `batch-${i}`, original: orig, translated: trans }
        })
      
      const results = reviewBatch(translations, 'it')
      setBatchResults(results)
      setIsReviewing(false)
    }, 500)
  }, [batchInput])

  const handleAutoFix = useCallback(() => {
    if (!translated) return
    const fixed = autoFix(translated)
    setTranslated(fixed)
    // Re-review after fix
    if (original) {
      const reviewResult = reviewTranslation(original, fixed, 'it')
      setResult(reviewResult)
    }
  }, [original, translated])

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500'
    if (score >= 75) return 'text-emerald-500'
    if (score >= 60) return 'text-yellow-500'
    if (score >= 40) return 'text-orange-500'
    return 'text-red-500'
  }

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-500'
    if (score >= 75) return 'bg-emerald-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-4">
      {/* Hero Header - Compact */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 p-4 text-white">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Review Agent</h1>
              <p className="text-white/80 text-sm">
                {language === 'it' ? 'Revisione automatica delle traduzioni' : 'Automatic translation review'}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-md text-sm">
              <BarChart3 className="h-4 w-4" />
              <span>8 {language === 'it' ? 'Controlli' : 'Checks'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-md text-sm">
              <Wand2 className="h-4 w-4" />
              <span>Auto-Fix</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Input Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'single' | 'batch')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single">
                    {language === 'it' ? 'Singola' : 'Single'}
                  </TabsTrigger>
                  <TabsTrigger value="batch">Batch</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-3">
              {inputMode === 'single' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{language === 'it' ? 'Originale' : 'Original'}</Label>
                      <Textarea
                        placeholder="Press {button} to continue..."
                        value={original}
                        onChange={(e) => setOriginal(e.target.value)}
                        rows={3}
                        className="resize-none text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{language === 'it' ? 'Traduzione' : 'Translation'}</Label>
                      <Textarea
                        placeholder="Premi per continuare..."
                        value={translated}
                        onChange={(e) => setTranslated(e.target.value)}
                        rows={3}
                        className="resize-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSingleReview}
                      disabled={!original.trim() || !translated.trim() || isReviewing}
                      className="gap-2 bg-gradient-to-r from-violet-500 to-purple-500"
                    >
                      {isReviewing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {language === 'it' ? 'Analizza' : 'Review'}
                    </Button>
                    {result?.autoFixAvailable && (
                      <Button variant="outline" onClick={handleAutoFix} className="gap-2">
                        <Wand2 className="h-4 w-4" />
                        Auto-Fix
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {language === 'it' 
                        ? 'Formato: originale|traduzione (una per riga)' 
                        : 'Format: original|translation (one per line)'}
                    </Label>
                    <Textarea
                      placeholder={`Press Start|Premi Start\nLoading...|Caricamento...\nGame Over|Fine del Gioco`}
                      value={batchInput}
                      onChange={(e) => setBatchInput(e.target.value)}
                      rows={6}
                      className="resize-none text-sm font-mono"
                    />
                  </div>
                  <Button
                    onClick={handleBatchReview}
                    disabled={!batchInput.trim() || isReviewing}
                    className="gap-2 bg-gradient-to-r from-violet-500 to-purple-500"
                  >
                    {isReviewing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    {language === 'it' ? 'Analizza Batch' : 'Review Batch'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Single Result */}
          {result && inputMode === 'single' && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {result.score >= 80 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    {language === 'it' ? 'Risultato Revisione' : 'Review Result'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-2xl font-bold", getScoreColor(result.score))}>
                      {result.score}
                    </span>
                    <span className="text-muted-foreground text-sm">/100</span>
                  </div>
                </div>
                <Progress value={result.score} className={cn("h-2", getScoreBg(result.score))} />
              </CardHeader>
              <CardContent className="space-y-3">
                {result.issues.length === 0 ? (
                  <div className="text-center py-4 text-green-600">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-medium">
                      {language === 'it' ? 'Nessun problema rilevato!' : 'No issues found!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {result.issues.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-lg"
                        style={{ backgroundColor: SEVERITY_CONFIG[issue.severity].bgColor }}
                      >
                        <span className="text-lg">{SEVERITY_CONFIG[issue.severity].icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: REVIEW_CATEGORIES[issue.category].color }}
                            >
                              {REVIEW_CATEGORIES[issue.category].icon} {
                                language === 'it' 
                                  ? REVIEW_CATEGORIES[issue.category].labelIt 
                                  : REVIEW_CATEGORIES[issue.category].label
                              }
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: SEVERITY_CONFIG[issue.severity].color }}
                            >
                              {language === 'it' 
                                ? SEVERITY_CONFIG[issue.severity].labelIt 
                                : SEVERITY_CONFIG[issue.severity].label}
                            </Badge>
                          </div>
                          <p className="text-sm mt-1">
                            {language === 'it' ? issue.messageIt : issue.message}
                          </p>
                          {issue.suggestion && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <ChevronRight className="h-3 w-3" />
                              {language === 'it' ? issue.suggestionIt : issue.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Batch Results */}
          {batchResults && inputMode === 'batch' && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {language === 'it' ? 'Risultati Batch' : 'Batch Results'}
                  </CardTitle>
                  <Badge variant="outline">
                    {batchResults.stats.total} {language === 'it' ? 'traduzioni' : 'translations'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-xl font-bold text-green-500">{batchResults.stats.passed}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'it' ? 'Passate' : 'Passed'}
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-xl font-bold text-red-500">{batchResults.stats.failed}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'it' ? 'Fallite' : 'Failed'}
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <p className={cn("text-xl font-bold", getScoreColor(batchResults.stats.avgScore))}>
                      {batchResults.stats.avgScore}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'it' ? 'Media' : 'Average'}
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-xl font-bold text-orange-500">
                      {Object.values(batchResults.stats.issuesBySeverity).reduce((a, b) => a + b, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'it' ? 'Problemi' : 'Issues'}
                    </p>
                  </div>
                </div>

                {/* Results list */}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {batchResults.results.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 text-sm"
                    >
                      <div className={cn("w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold", getScoreBg(r.score))}>
                        {r.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{r.original}</p>
                        <p className="truncate text-muted-foreground text-xs">{r.translated}</p>
                      </div>
                      <div className="flex gap-1">
                        {r.issues.slice(0, 3).map((issue, j) => (
                          <span key={j} title={language === 'it' ? issue.messageIt : issue.message}>
                            {SEVERITY_CONFIG[issue.severity].icon}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Categories Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {language === 'it' ? 'Controlli Attivi' : 'Active Checks'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {Object.entries(REVIEW_CATEGORIES).map(([key, cat]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 text-sm"
                >
                  <span>{cat.icon}</span>
                  <span className="flex-1">{language === 'it' ? cat.labelIt : cat.label}</span>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {language === 'it' ? 'Livelli Severità' : 'Severity Levels'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {Object.entries(SEVERITY_CONFIG).map(([key, sev]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-1.5 rounded text-sm"
                  style={{ backgroundColor: sev.bgColor }}
                >
                  <span>{sev.icon}</span>
                  <span style={{ color: sev.color }}>
                    {language === 'it' ? sev.labelIt : sev.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
