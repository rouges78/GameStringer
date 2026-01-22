"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfidenceHeatmap } from "@/components/translator/confidence-heatmap"
import {
  calculateBatchConfidence,
  HeatmapData,
  TranslationPair,
  CONFIDENCE_COLORS
} from "@/lib/translation-confidence"
import {
  Map,
  Upload,
  FileText,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Download,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

// Dati di esempio per demo
const EXAMPLE_TRANSLATIONS: TranslationPair[] = [
  {
    id: "1",
    original: "Press {button} to continue",
    translated: "Premi per continuare",  // Missing placeholder!
    context: "Tutorial"
  },
  {
    id: "2", 
    original: "You have collected 100 gold coins!",
    translated: "Hai raccolto 100 monete d'oro!",
    context: "Reward"
  },
  {
    id: "3",
    original: "WARNING: This action cannot be undone.",
    translated: "Attenzione: Questa azione non può essere annullata.",  // Missing emphasis
    context: "Dialog"
  },
  {
    id: "4",
    original: "Save your progress?",
    translated: "Salvare i progressi",  // Missing ?
    context: "Menu"
  },
  {
    id: "5",
    original: "<b>Critical Hit!</b> You dealt 250 damage!",
    translated: "Colpo critico! Hai inflitto 250 danni!",  // Missing tags
    context: "Combat"
  },
  {
    id: "6",
    original: "Player %s has joined the game",
    translated: "Il giocatore ha unito al gioco",  // Missing %s + grammar
    context: "Multiplayer"
  },
  {
    id: "7",
    original: "Level Up! You are now level 25.",
    translated: "Livello aumentato! Sei ora al livello 25.",
    context: "RPG"
  },
  {
    id: "8",
    original: "Loading...",
    translated: "Caricamento...",
    context: "UI"
  },
  {
    id: "9",
    original: "Game Over",
    translated: "",  // Empty!
    context: "Game State"
  },
  {
    id: "10",
    original: "New Game",
    translated: "New Game",  // Not translated
    context: "Menu"
  },
  {
    id: "11",
    original: "Enter your name:",
    translated: "Inserisci il tuo nome:",
    context: "Character Creation"
  },
  {
    id: "12",
    original: "Settings",
    translated: "Impostazioni",
    context: "Menu"
  },
  {
    id: "13",
    original: "Volume: {{value}}%",
    translated: "Volume: %",  // Missing placeholder
    context: "Settings"
  },
  {
    id: "14",
    original: "Are you sure you want to quit?",
    translated: "Sei sicuro di voler uscire?",
    context: "Dialog"
  },
  {
    id: "15",
    original: "ACHIEVEMENT UNLOCKED!",
    translated: "Obiettivo sbloccato!",  // Lost caps emphasis
    context: "Achievement"
  }
]

export default function HeatmapPage() {
  const { t, language } = useTranslation()
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [inputMode, setInputMode] = useState<'demo' | 'paste' | 'file'>('demo')
  const [pasteInput, setPasteInput] = useState('')

  // Analizza i dati di esempio
  const analyzeDemo = useCallback(() => {
    setIsAnalyzing(true)
    // Simula delay per UX
    setTimeout(() => {
      const data = calculateBatchConfidence(EXAMPLE_TRANSLATIONS)
      setHeatmapData(data)
      setIsAnalyzing(false)
    }, 500)
  }, [])

  // Analizza testo incollato (formato: originale|traduzione per riga)
  const analyzePastedText = useCallback(() => {
    if (!pasteInput.trim()) return

    setIsAnalyzing(true)
    
    setTimeout(() => {
      const lines = pasteInput.trim().split('\n')
      const pairs: TranslationPair[] = lines
        .filter(line => line.includes('|'))
        .map((line, i) => {
          const [original, translated] = line.split('|').map(s => s.trim())
          return {
            id: `paste-${i}`,
            original: original || '',
            translated: translated || ''
          }
        })

      if (pairs.length > 0) {
        const data = calculateBatchConfidence(pairs)
        setHeatmapData(data)
      }
      setIsAnalyzing(false)
    }, 300)
  }, [pasteInput])

  // Gestisce upload file
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsAnalyzing(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        
        // Prova a parsare come JSON
        try {
          const json = JSON.parse(content)
          const pairs: TranslationPair[] = []
          
          // Supporta vari formati JSON
          if (Array.isArray(json)) {
            json.forEach((item, i) => {
              if (item.original && item.translated !== undefined) {
                pairs.push({
                  id: item.id || `file-${i}`,
                  original: item.original,
                  translated: item.translated || '',
                  context: item.context
                })
              } else if (item.source && item.target !== undefined) {
                pairs.push({
                  id: item.id || `file-${i}`,
                  original: item.source,
                  translated: item.target || '',
                  context: item.context
                })
              }
            })
          } else if (typeof json === 'object') {
            // Key-value format
            Object.entries(json).forEach(([key, value], i) => {
              if (typeof value === 'object' && value !== null) {
                const v = value as any
                pairs.push({
                  id: key,
                  original: v.original || v.source || key,
                  translated: v.translated || v.target || ''
                })
              }
            })
          }

          if (pairs.length > 0) {
            const data = calculateBatchConfidence(pairs)
            setHeatmapData(data)
          }
        } catch {
          // Prova formato testo semplice
          const lines = content.split('\n')
          const pairs: TranslationPair[] = lines
            .filter(line => line.includes('|') || line.includes('\t'))
            .map((line, i) => {
              const separator = line.includes('\t') ? '\t' : '|'
              const [original, translated] = line.split(separator).map(s => s.trim())
              return {
                id: `file-${i}`,
                original: original || '',
                translated: translated || ''
              }
            })

          if (pairs.length > 0) {
            const data = calculateBatchConfidence(pairs)
            setHeatmapData(data)
          }
        }
      } catch (error) {
      }
      setIsAnalyzing(false)
    }
    reader.readAsText(file)
  }, [])

  // Esporta report
  const exportReport = useCallback(() => {
    if (!heatmapData) return

    const report = {
      summary: heatmapData.summary,
      translations: heatmapData.pairs.map(p => ({
        ...p,
        confidence: heatmapData.results.get(p.id)
      })),
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `heatmap-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [heatmapData])

  return (
      <div className="space-y-6">
        {/* Hero Header - Compact */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 p-4 text-white">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Map className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{t('heatmap.title')}</h1>
                <p className="text-white/80 text-sm">{t('heatmap.subtitle')}</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-md text-sm">
                <BarChart3 className="h-4 w-4" />
                <span>8 {t('heatmap.metrics')}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-md text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>{t('heatmap.issueDetection')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Input Section */}
        {!heatmapData && (
          <Card>
            <CardHeader>
              <CardTitle>{t('heatmap.loadTranslations')}</CardTitle>
              <CardDescription>
                {t('heatmap.loadTranslationsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="demo">{t('heatmap.demo')}</TabsTrigger>
                  <TabsTrigger value="paste">{t('heatmap.paste')}</TabsTrigger>
                  <TabsTrigger value="file">{t('heatmap.file')}</TabsTrigger>
                </TabsList>

                <TabsContent value="demo" className="space-y-2">
                  <div className="text-center py-4">
                    <Map className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <h3 className="text-base font-medium mb-1">{t('heatmap.tryWithExample')}</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      {t('heatmap.exampleDesc')}
                    </p>
                    <Button onClick={analyzeDemo} disabled={isAnalyzing}>
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('heatmap.analyzing')}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          {t('heatmap.analyzeDemo')}
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="paste" className="space-y-2">
                  <div className="space-y-1">
                    <Label>
                      {t('heatmap.pasteFormat')}
                    </Label>
                    <Textarea
                      placeholder="Press Start|Premi Start
Loading...|Caricamento...
Game Over|Fine del Gioco"
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <Button onClick={analyzePastedText} disabled={!pasteInput.trim() || isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('heatmap.analyzing')}
                      </>
                    ) : (
                      <>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        {t('heatmap.analyze')}
                      </>
                    )}
                  </Button>
                </TabsContent>

                <TabsContent value="file" className="space-y-2">
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground mb-2">
                      {t('heatmap.supportedFormats')}
                    </p>
                    <input
                      type="file"
                      accept=".json,.csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <FileText className="h-4 w-4 mr-2" />
                        {t('heatmap.selectFile')}
                      </label>
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Heatmap Results */}
        {heatmapData && (
          <div className="space-y-4">
            {/* Actions Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {heatmapData.summary.total} {t('heatmap.translations')}
                </Badge>
                <Badge
                  variant="outline"
                  style={{
                    borderColor: heatmapData.summary.averageScore >= 80
                      ? CONFIDENCE_COLORS.high.color
                      : heatmapData.summary.averageScore >= 60
                        ? CONFIDENCE_COLORS.medium.color
                        : CONFIDENCE_COLORS.low.color
                  }}
                >
                  {t('heatmap.average')}: {heatmapData.summary.averageScore}%
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportReport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('heatmap.exportReport')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHeatmapData(null)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('heatmap.newAnalysis')}
                </Button>
              </div>
            </div>

            {/* Heatmap Component */}
            <ConfidenceHeatmap data={heatmapData} />
          </div>
        )}

        {/* Legend - Compact */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium">{t('heatmap.colorLegend')}:</span>
          {Object.entries(CONFIDENCE_COLORS).map(([level, config]) => (
            <div key={level} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: config.color }}
              />
              <span>{language === 'it' ? config.labelIt : config.label}</span>
            </div>
          ))}
        </div>
      </div>
  )
}
