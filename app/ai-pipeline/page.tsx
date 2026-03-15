"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Workflow,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Sparkles,
  Shield,
  Wrench,
  Eye,
  BarChart3,
  ChevronRight,
  AlertTriangle,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  runPipeline,
  runQuickPipeline,
  runMaxQualityPipeline,
  type PipelineResult,
  type PipelineStep,
  type PipelineStepId,
  type PipelineOptions,
} from "@/lib/ai-pipeline"
import { useTranslation } from '@/lib/i18n';

const STEP_ICONS: Record<PipelineStepId, any> = {
  harvest: Sparkles,
  translate: ChevronRight,
  qa_check: Shield,
  auto_fix: Wrench,
  review: Eye,
  score: BarChart3,
}

const STEP_COLORS: Record<string, string> = {
  pending: "text-muted-foreground",
  running: "text-blue-400 animate-pulse",
  completed: "text-emerald-400",
  failed: "text-red-400",
  skipped: "text-muted-foreground/50",
}

const DEMO_TEXTS = [
  "New Game",
  "Continue",
  "Settings",
  "Guard: Stop right there! You're not allowed in this area.",
  "You dealt {damage} damage to {enemy_name}!",
  "Press {key_interact} to interact with objects",
  "The ancient temple loomed before you, its crumbling walls whispering secrets of a forgotten age.",
  "Quest Updated: Find the Lost Artifact",
  "Health Potion",
  "Restores 50 HP. A basic healing concoction brewed by village herbalists.",
  "CRITICAL HIT!",
  "Achievement Unlocked: Dragon Slayer",
  "Game saved successfully!",
  "Loading...",
  "Buy",
  "Sell",
]

export default function AIPipelinePage() {
  const { t } = useTranslation();
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [inputText, setInputText] = useState(DEMO_TEXTS.join("\n"))
  const [targetLang, setTargetLang] = useState("it")

  useEffect(() => {
    const saved = localStorage.getItem('gameStringerSettings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.translation?.defaultTargetLang) setTargetLang(s.translation.defaultTargetLang);
      } catch {}
    }
  }, []);
  const [sourceLang, setSourceLang] = useState("en")
  const [enableHarvest, setEnableHarvest] = useState(true)
  const [enableAutoFix, setEnableAutoFix] = useState(true)
  const [enableReview, setEnableReview] = useState(true)
  const [pipelineMode, setPipelineMode] = useState<"quick" | "balanced" | "max">("balanced")
  const [selectedString, setSelectedString] = useState<number | null>(null)

  const handleRun = useCallback(async () => {
    const texts = inputText.split("\n").map(l => l.trim()).filter(l => l.length > 0)
    if (texts.length === 0) return

    setIsRunning(true)
    setResult(null)
    setSteps([])
    setSelectedString(null)

    try {
      let pipelineResult: PipelineResult

      const onStepChange = (step: PipelineStep, allSteps: PipelineStep[]) => {
        setSteps([...allSteps])
      }

      switch (pipelineMode) {
        case "quick":
          pipelineResult = await runQuickPipeline(texts, sourceLang, targetLang)
          break
        case "max":
          pipelineResult = await runMaxQualityPipeline(texts, sourceLang, targetLang, { onStepChange })
          break
        default:
          pipelineResult = await runPipeline({
            texts,
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
            enableHarvest,
            enableAutoFix,
            enableReview,
            onStepChange,
          })
      }

      setResult(pipelineResult)
      setSteps(pipelineResult.steps)
    } catch (e) {
      console.error("[Pipeline] Error:", e)
    } finally {
      setIsRunning(false)
    }
  }, [inputText, targetLang, sourceLang, enableHarvest, enableAutoFix, enableReview, pipelineMode])

  const handleExport = useCallback(() => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pipeline-result-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  const selectedReport = selectedString !== null ? result?.qaReports[selectedString] : null

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Workflow className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('aiPipelinePage.title')}</h1>
              <p className="text-white/70 text-sm">{t('aiPipelinePage.multistepHarvestTranslateQaAut')}</p>
            </div>
          </div>
          {result && (
            <Badge className="bg-black/30 rounded-lg px-3 py-1.5 border border-white/10 text-white/90">
              Score medio: {result.averageScore}%
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Config */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">{t('aiPipelinePage.inputStrings')}</CardTitle>
              <CardDescription className="text-xs">{t('aiPipelinePage.inputDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={8}
                className="text-xs font-mono"
                placeholder="Incolla stringhe da tradurre..."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">{t('ueTranslator.configuration')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('mangaTranslator.source')}</Label>
                  <Input value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="h-7 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs">{t('aiPipelinePage.target')}</Label>
                  <Input value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="h-7 text-xs mt-1" />
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs font-medium">{t('aiPipelinePage.pipelineMode')}</Label>
                <div className="flex gap-1 mt-1">
                  {(["quick", "balanced", "max"] as const).map(mode => (
                    <Button
                      key={mode}
                      variant={pipelineMode === mode ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => setPipelineMode(mode)}
                    >
                      {mode === "quick" ? "⚡ Quick" : mode === "balanced" ? "⚖️ Balanced" : "🏆 Max"}
                    </Button>
                  ))}
                </div>
              </div>

              {pipelineMode === "balanced" && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('nav.contextHarvester')}</Label>
                      <Switch checked={enableHarvest} onCheckedChange={setEnableHarvest} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('aiReview.autoFix')}</Label>
                      <Switch checked={enableAutoFix} onCheckedChange={setEnableAutoFix} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('aiPipelinePage.aiReview')}</Label>
                      <Switch checked={enableReview} onCheckedChange={setEnableReview} />
                    </div>
                  </div>
                </>
              )}

              <Button onClick={handleRun} disabled={isRunning} className="w-full h-8 text-xs">
                {isRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                {isRunning ? "Pipeline in esecuzione..." : "Avvia Pipeline"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Steps Progress */}
        {steps.length > 0 && (
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-xs">{t('aiPipelinePage.pipelineSteps')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-1">
                {steps.map((step, i) => {
                  const Icon = STEP_ICONS[step.id] || ChevronRight
                  const StatusIcon = step.status === "completed" ? CheckCircle2
                    : step.status === "failed" ? XCircle
                    : step.status === "running" ? Loader2
                    : step.status === "skipped" ? ChevronRight
                    : Clock

                  return (
                    <div key={step.id} className="flex items-center gap-1">
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded text-xs border",
                        step.status === "completed" ? "bg-emerald-500/10 border-emerald-500/30" :
                        step.status === "failed" ? "bg-red-500/10 border-red-500/30" :
                        step.status === "running" ? "bg-blue-500/10 border-blue-500/30" :
                        step.status === "skipped" ? "bg-muted/30 border-transparent" :
                        "bg-muted/10 border-transparent"
                      )}>
                        <StatusIcon className={cn("h-3 w-3", STEP_COLORS[step.status], step.status === "running" && "animate-spin")} />
                        <span className={cn("text-[10px]", STEP_COLORS[step.status])}>{step.name}</span>
                        {step.durationMs !== undefined && step.status !== "skipped" && (
                          <span className="text-[9px] text-muted-foreground">({step.durationMs}ms)</span>
                        )}
                      </div>
                      {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-3">
                <div className="text-[10px] text-muted-foreground">{t('aiPipelinePage.avgScore')}</div>
                <div className={cn("text-xl font-bold",
                  result.averageScore >= 80 ? "text-emerald-400" :
                  result.averageScore >= 60 ? "text-yellow-400" :
                  "text-red-400"
                )}>{result.averageScore}%</div>
              </Card>
              <Card className="p-3">
                <div className="text-[10px] text-muted-foreground">{t('aiPipelinePage.firstShot')}</div>
                <div className="text-xl font-bold text-emerald-400">{result.stats.passedFirstTime}/{result.stats.totalStrings}</div>
              </Card>
              <Card className="p-3">
                <div className="text-[10px] text-muted-foreground">{t('aiPipelinePage.autoFixed')}</div>
                <div className="text-xl font-bold text-blue-400">{result.stats.fixedByAutoFix}</div>
              </Card>
              <Card className="p-3">
                <div className="text-[10px] text-muted-foreground">{t('aiPipelinePage.reviewImproved')}</div>
                <div className="text-xl font-bold text-purple-400">{result.stats.improvedByReview}</div>
              </Card>
              <Card className="p-3">
                <div className="text-[10px] text-muted-foreground">{t('aiPipelinePage.totalTime')}</div>
                <div className="text-xl font-bold text-muted-foreground">{(result.totalDurationMs / 1000).toFixed(1)}s</div>
              </Card>
            </div>

            {/* Translations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="lg:col-span-2">
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs">Traduzioni ({result.translations.length})</CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleExport}>
                    <Download className="h-3 w-3 mr-1" />{t('projects.export')}</Button>
                </CardHeader>
                <ScrollArea className="h-[400px]">
                  <div className="px-4 pb-3 space-y-1">
                    {result.translations.map((trans, i) => {
                      const report = result.qaReports[i]
                      const score = report?.overallScore ?? 0
                      const passed = report?.passed ?? false
                      const texts = inputText.split("\n").filter(l => l.trim())

                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedString(selectedString === i ? null : i)}
                          className={cn(
                            "p-2 rounded border cursor-pointer transition-colors",
                            selectedString === i ? "bg-accent border-accent-foreground/20" : "hover:bg-muted/50 border-transparent"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-muted-foreground truncate">{texts[i] || `#${i + 1}`}</div>
                              <div className="text-xs mt-0.5">{trans || <span className="text-muted-foreground italic">—</span>}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4",
                                score >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                                score >= 60 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                                "bg-red-500/10 text-red-400 border-red-500/30"
                              )}>
                                {score}%
                              </Badge>
                              {passed ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </Card>

              {/* QA Detail */}
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs">
                    {selectedReport ? `QA Report #${selectedString! + 1}` : "Seleziona una stringa"}
                  </CardTitle>
                </CardHeader>
                {selectedReport ? (
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("text-2xl font-bold",
                        selectedReport.overallScore >= 80 ? "text-emerald-400" :
                        selectedReport.overallScore >= 60 ? "text-yellow-400" :
                        "text-red-400"
                      )}>
                        {selectedReport.overallScore}%
                      </div>
                      <Badge variant={selectedReport.passed ? "default" : "destructive"} className="text-[10px]">
                        {selectedReport.passed ? "PASS" : "FAIL"}
                      </Badge>
                    </div>

                    <Progress value={selectedReport.overallScore} className="h-1.5" />

                    <div className="flex gap-3 text-xs">
                      <div className="text-red-400">{selectedReport.summary.errors} errori</div>
                      <div className="text-yellow-400">{selectedReport.summary.warnings} avvisi</div>
                      <div className="text-blue-400">{selectedReport.summary.infos} info</div>
                    </div>

                    <Separator />

                    <div className="space-y-1.5">
                      {selectedReport.checks.map((check, ci) => (
                        <div key={ci} className={cn(
                          "flex items-start gap-1.5 text-[11px] p-1.5 rounded",
                          !check.passed && check.severity === "error" ? "bg-red-500/10" :
                          !check.passed && check.severity === "warning" ? "bg-yellow-500/10" :
                          "bg-muted/30"
                        )}>
                          {check.passed ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className={cn("h-3 w-3 mt-0.5 shrink-0",
                              check.severity === "error" ? "text-red-400" : "text-yellow-400"
                            )} />
                          )}
                          <div>
                            <div className="font-medium">{check.name}</div>
                            <div className="text-muted-foreground">{check.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedReport.suggestions.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-[10px] text-muted-foreground">{t('aiPipelinePage.suggestions')}</Label>
                          {selectedReport.suggestions.map((s, si) => (
                            <div key={si} className="text-[11px] text-muted-foreground mt-0.5">• {s}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                ) : (
                  <CardContent className="px-4 pb-4">
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Clicca su una traduzione per il QA report
                    </p>
                  </CardContent>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
