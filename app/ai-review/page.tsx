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
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('aiReview.title')}
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('aiReview.subtitle')}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20">
              <BarChart3 className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">8</span>
              <span className="text-[10px] text-white/70">{t('aiReview.checks')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20">
              <Wand2 className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">{t('aiReview.autoFix')}</span>
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
                    {t('aiReview.single')}
                  </TabsTrigger>
                  <TabsTrigger value="batch">{t('aiReview.batch')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-3">
              {inputMode === 'single' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('aiReview.original')}</Label>
                      <Textarea
                        placeholder="Press {button} to continue..."
                        value={original}
                        onChange={(e) => setOriginal(e.target.value)}
                        rows={3}
                        className="resize-none text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('aiReview.translation')}</Label>
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
                      {t('aiReview.review')}
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
                      {t('aiReview.batchFormat')}
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
                    {t('aiReview.reviewBatch')}
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
                    {t('aiReview.reviewResult')}
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
                      {t('aiReview.noIssues')}
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
                    {t('aiReview.batchResults')}
                  </CardTitle>
                  <Badge variant="outline">
                    {batchResults.stats.total} {t('aiReview.translations')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-xl font-bold text-green-500">{batchResults.stats.passed}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('aiReview.passed')}
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-xl font-bold text-red-500">{batchResults.stats.failed}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('aiReview.failed')}
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <p className={cn("text-xl font-bold", getScoreColor(batchResults.stats.avgScore))}>
                      {batchResults.stats.avgScore}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('aiReview.average')}
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-xl font-bold text-orange-500">
                      {Object.values(batchResults.stats.issuesBySeverity).reduce((a, b) => a + b, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('aiReview.issues')}
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
                {t('aiReview.activeChecks')}
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
                {t('aiReview.severityLevels')}
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
