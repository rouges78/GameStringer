"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  analyzeForAdaptation,
  AdaptationResult,
  ADAPTATION_CATEGORIES,
  CULTURE_PROFILES,
  CultureCode
} from "@/lib/cultural-adaptation"
import {
  Globe2,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

const AVAILABLE_CULTURES: CultureCode[] = ['en', 'it', 'de', 'fr', 'es', 'ja', 'ko', 'zh', 'pt', 'ru']

export default function CulturalAdaptationPage() {
  const { t, language } = useTranslation()
  const [inputText, setInputText] = useState("")
  const [sourceCulture, setSourceCulture] = useState<CultureCode>("en")
  const [targetCulture, setTargetCulture] = useState<CultureCode>("it")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AdaptationResult | null>(null)

  const handleAnalyze = useCallback(() => {
    if (!inputText.trim()) return
    
    setIsAnalyzing(true)
    setTimeout(() => {
      const analysisResult = analyzeForAdaptation(inputText, sourceCulture, targetCulture)
      setResult(analysisResult)
      setIsAnalyzing(false)
    }, 400)
  }, [inputText, sourceCulture, targetCulture])

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500'
    if (score >= 70) return 'text-yellow-500'
    if (score >= 50) return 'text-orange-500'
    return 'text-red-500'
  }

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-500'
    if (score >= 70) return 'bg-yellow-500'
    if (score >= 50) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const loadExample = (text: string) => {
    setInputText(text)
    setResult(null)
  }

  const exampleTexts = [
    "It's 95°F outside and I walked 5 miles to get here. This is a piece of cake!",
    "The player hit a home run and scored $1,000,000 in the tournament.",
    "Happy Thanksgiving! The parade starts at 10 AM on the 4th of July.",
    "She's green with envy because he won the Super Bowl lottery."
  ]

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Globe2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('culturalAdaptation.title')}
              </h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('culturalAdaptation.subtitle')}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20">
              <Globe2 className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">10</span>
              <span className="text-[10px] text-white/70">{t('culturalAdaptation.cultures')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">13</span>
              <span className="text-[10px] text-white/70">{t('culturalAdaptation.categories')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Input Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-4">
              {/* Culture Selection */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {t('culturalAdaptation.from')}
                  </Label>
                  <Select value={sourceCulture} onValueChange={(v) => setSourceCulture(v as CultureCode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_CULTURES.map(code => (
                        <SelectItem key={code} value={code}>
                          <span className="flex items-center gap-2">
                            <span>{CULTURE_PROFILES[code].flag}</span>
                            <span>{CULTURE_PROFILES[code].name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-5" />
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {t('culturalAdaptation.to')}
                  </Label>
                  <Select value={targetCulture} onValueChange={(v) => setTargetCulture(v as CultureCode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_CULTURES.map(code => (
                        <SelectItem key={code} value={code}>
                          <span className="flex items-center gap-2">
                            <span>{CULTURE_PROFILES[code].flag}</span>
                            <span>{CULTURE_PROFILES[code].name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Input */}
              <div className="space-y-1">
                <Label className="text-xs">{t('culturalAdaptation.textToAnalyze')}</Label>
                <Textarea
                  placeholder="Enter text with cultural references, idioms, units..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              {/* Examples + Analyze */}
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1 flex-1">
                  {exampleTexts.map((text, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => loadExample(text)}
                    >
                      Ex.{i + 1}
                    </Button>
                  ))}
                </div>
                <Button
                onClick={handleAnalyze}
                disabled={!inputText.trim() || isAnalyzing}
                size="sm"
                  className="gap-1 bg-gradient-to-r from-emerald-500 to-teal-500"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {t('culturalAdaptation.analyze')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {result.suggestions.length === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    {t('culturalAdaptation.analysisResult')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-2xl font-bold", getScoreColor(result.culturalScore))}>
                      {result.culturalScore}
                    </span>
                    <span className="text-muted-foreground text-sm">/100</span>
                  </div>
                </div>
                <Progress value={result.culturalScore} className={cn("h-2", getScoreBg(result.culturalScore))} />
              </CardHeader>
              <CardContent className="space-y-3">
                {result.suggestions.length === 0 ? (
                  <div className="text-center py-4 text-green-600">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-medium">
                      {t('culturalAdaptation.noAdaptationNeeded')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {result.suggestions.length} {t('culturalAdaptation.suggestionsFound')}
                    </p>
                    {result.suggestions.map((suggestion, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-muted/50 border"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">{ADAPTATION_CATEGORIES[suggestion.category].icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: ADAPTATION_CATEGORIES[suggestion.category].color }}
                              >
                                {language === 'it' 
                                  ? ADAPTATION_CATEGORIES[suggestion.category].labelIt 
                                  : ADAPTATION_CATEGORIES[suggestion.category].label}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {suggestion.confidence}% {t('culturalAdaptation.confidence')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <code className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                                {suggestion.originalText}
                              </code>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              <code className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                                {suggestion.suggestedText}
                              </code>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {language === 'it' ? suggestion.reasonIt : suggestion.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Target Culture Info */}
          <Card>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{CULTURE_PROFILES[targetCulture].flag}</span>
                <span>{CULTURE_PROFILES[targetCulture].name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm py-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('culturalAdaptation.formality')}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {CULTURE_PROFILES[targetCulture].formality}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('culturalAdaptation.humor')}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {CULTURE_PROFILES[targetCulture].humor}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('culturalAdaptation.date')}</span>
                <span className="font-mono text-xs">{CULTURE_PROFILES[targetCulture].dateFormat}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('culturalAdaptation.numbers')}</span>
                <span className="font-mono text-xs">
                  1{CULTURE_PROFILES[targetCulture].numberFormat.thousand}234{CULTURE_PROFILES[targetCulture].numberFormat.decimal}56
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('culturalAdaptation.currency')}</span>
                <span>{CULTURE_PROFILES[targetCulture].currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('culturalAdaptation.system')}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {CULTURE_PROFILES[targetCulture].measurementSystem}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-sm">
                {t('culturalAdaptation.analyzedCategories')}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap gap-1">
                {Object.entries(ADAPTATION_CATEGORIES).slice(0, 10).map(([key, cat]) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className="text-xs gap-1"
                    style={{ borderColor: cat.color }}
                  >
                    {cat.icon} {language === 'it' ? cat.labelIt : cat.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
