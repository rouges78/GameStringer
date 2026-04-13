"use client"

import { useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  ScanEye,
  Upload,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Copy,
  Settings,
  Zap,
  Clock,
  Image as ImageIcon,
  Monitor,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  recognizeMultiEngine,
  probeAllEngines,
  getEngineInfoList,
  getOCRSettings,
  saveOCRSettings,
  type OCREngineId,
  type OCREngineInfo,
  type MultiOCRResult,
  type EngineProbeResult,
} from "@/lib/ocr-engines"
import type { OCRLanguage } from "@/lib/ocr-service"
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';

const LANGUAGE_OPTIONS: { code: OCRLanguage; name: string }[] = [
  { code: "eng", name: "English" },
  { code: "ita", name: "Italiano" },
  { code: "fra", name: "Français" },
  { code: "deu", name: "Deutsch" },
  { code: "spa", name: "Español" },
  { code: "por", name: "Português" },
  { code: "jpn", name: "日本語" },
  { code: "kor", name: "한국어" },
  { code: "chi_sim", name: "简体中文" },
  { code: "chi_tra", name: "繁體中文" },
  { code: "rus", name: "Русский" },
]

const ENGINE_COLORS: Record<OCREngineId, string> = {
  oneocr: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  paddleocr: "bg-green-500/15 text-green-400 border-green-500/30",
  rapidocr: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  tesseract: "bg-slate-500/15 text-slate-400 border-slate-500/30",
}

const ENGINE_ICONS: Record<OCREngineId, string> = {
  oneocr: "🪟",
  paddleocr: "🐲",
  rapidocr: "⚡",
  tesseract: "📝",
}

export default function OCREnginesPage() {
  const { t } = useTranslation();
  const [probeResults, setProbeResults] = useState<EngineProbeResult[]>([])
  const [engineInfos, setEngineInfos] = useState<OCREngineInfo[]>([])
  const [isProbing, setIsProbing] = useState(false)
  const [ocrResult, setOcrResult] = useState<MultiOCRResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<string>("")
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [language, setLanguage] = useState<OCRLanguage>("eng")
  const [preferredEngine, setPreferredEngine] = useState<OCREngineId>("tesseract")
  const [compareAll, setCompareAll] = useState(false)
  const [showSetup, setShowSetup] = useState<OCREngineId | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [_settings] = useState(() => getOCRSettings())

  const handleProbe = useCallback(async () => {
    setIsProbing(true)
    try {
      const [probes, infos] = await Promise.all([probeAllEngines(), getEngineInfoList()])
      setProbeResults(probes)
      setEngineInfos(infos)
    } catch (e: unknown) {
      clientLogger.error("[OCR] Probe failed:", e)
    } finally {
      setIsProbing(false)
    }
  }, [])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setSelectedImage(ev.target?.result as string)
      setOcrResult(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleOCR = useCallback(async () => {
    if (!selectedImage) return
    setIsProcessing(true)
    setOcrResult(null)
    setProgress("Avvio OCR...")

    try {
      const result = await recognizeMultiEngine(selectedImage, {
        preferredEngine,
        language,
        compareAll,
        timeout: 15000,
        onProgress: (p) => setProgress(p.status),
      })
      setOcrResult(result)
    } catch (e: unknown) {
      clientLogger.error("[OCR] Error:", e)
      setProgress(`Errore: ${e instanceof Error ? e.message : "Sconosciuto"}`)
    } finally {
      setIsProcessing(false)
    }
  }, [selectedImage, preferredEngine, language, compareAll])

  const handleCopyText = useCallback(() => {
    if (ocrResult?.text) {
      navigator.clipboard.writeText(ocrResult.text)
    }
  }, [ocrResult])

  const _handleSaveSettings = useCallback(() => {
    saveOCRSettings({ preferredEngine, compareMode: compareAll })
  }, [preferredEngine, compareAll])

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <ScanEye className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('nav.ocrMultiEngine')}</h1>
              <p className="text-white/70 text-sm">{t('ocrEnginesPage.engines')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleProbe} disabled={isProbing}
            className="h-8 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
            {isProbing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Rileva Engine
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Engine Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["oneocr", "paddleocr", "rapidocr", "tesseract"] as OCREngineId[]).map((engineId) => {
            const probe = probeResults.find(p => p.engine === engineId)
            const info = engineInfos.find(i => i.id === engineId)
            const isAvailable = probe?.available ?? (engineId === "tesseract")

            return (
              <Card key={engineId} className={cn("p-3 cursor-pointer transition-all",
                preferredEngine === engineId && "ring-2 ring-primary"
              )} onClick={() => setPreferredEngine(engineId)}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{ENGINE_ICONS[engineId]}</span>
                    <span className="text-xs font-medium">
                      {engineId === "oneocr" ? "OneOCR" :
                       engineId === "paddleocr" ? "PaddleOCR" :
                       engineId === "rapidocr" ? "RapidOCR" : "Tesseract"}
                    </span>
                  </div>
                  {isAvailable ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className={cn("text-micro px-1 py-0 h-4",
                    isAvailable ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"
                  )}>
                    {isAvailable ? "Online" : "Offline"}
                  </Badge>
                  {probe?.latencyMs !== undefined && probe.latencyMs > 0 && (
                    <span className="text-micro text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {probe.latencyMs}ms
                    </span>
                  )}
                  {info && (
                    <span className="text-micro text-muted-foreground flex items-center gap-0.5">
                      <Zap className="h-2.5 w-2.5" /> Q:{info.qualityScore}/10
                    </span>
                  )}
                </div>
                {!isAvailable && engineId !== "tesseract" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-micro mt-1 px-1 text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); setShowSetup(showSetup === engineId ? null : engineId) }}
                  >
                    <Settings className="h-2.5 w-2.5 mr-0.5" />{t('offlineTranslator.setup')}</Button>
                )}
                {showSetup === engineId && info && (
                  <div className="mt-2 p-2 rounded bg-muted/50 text-2xs text-muted-foreground">
                    {info.setupInstructions}
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {/* OCR Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Image Input */}
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> Immagine
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-colors min-h-[200px]",
                  selectedImage ? "border-primary/30" : "border-muted-foreground/30 hover:border-primary/50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedImage ? (
                  <img src={selectedImage} alt="Screenshot" className="max-h-[300px] rounded object-contain" />
                ) : (
                  <div className="text-center p-6">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">{t('ocrEnginesPage.dropImage')}</p>
                    <p className="text-2xs text-muted-foreground/60 mt-1">{t('ocrEnginesPage.formats')}</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">{t('ocrEnginesPage.textLanguage')}</Label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as OCRLanguage)}
                    className="w-full h-7 text-xs bg-background border rounded px-2 mt-1"
                  >
                    {LANGUAGE_OPTIONS.map(l => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={compareAll} onCheckedChange={setCompareAll} />
                  <Label className="text-xs">{t('ocrEnginesPage.compareAll')}</Label>
                </div>
              </div>

              <Button onClick={handleOCR} disabled={!selectedImage || isProcessing} className="w-full h-8 text-xs">
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                {isProcessing ? progress : `OCR con ${preferredEngine}`}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          <Card>
            <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Monitor className="h-4 w-4" /> Risultato
              </CardTitle>
              {ocrResult && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-2xs", ENGINE_COLORS[ocrResult.engine])}>
                    {ENGINE_ICONS[ocrResult.engine]} {ocrResult.engine}
                  </Badge>
                  <Button variant="ghost" size="xs" className="text-xs" onClick={handleCopyText}>
                    <Copy className="h-3 w-3 mr-1" />{t('translationFixer.copy')}</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {ocrResult ? (
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="flex gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">{t('ocrEnginesPage.confidence')}</span>
                      <span className={cn("font-medium",
                        ocrResult.confidence >= 80 ? "text-emerald-400" :
                        ocrResult.confidence >= 50 ? "text-yellow-400" :
                        "text-red-400"
                      )}>{Math.round(ocrResult.confidence)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('ocrEnginesPage.words')}</span>
                      <span className="font-medium">{ocrResult.words.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('ocrEnginesPage.lines')}</span>
                      <span className="font-medium">{ocrResult.lines.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('ocrEnginesPage.time')}</span>
                      <span className="font-medium">{ocrResult.processingTime}ms</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Extracted Text */}
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap p-2 bg-muted/30 rounded">
                      {ocrResult.text || <span className="text-muted-foreground italic">{t('ocrTranslator.noTextsDetected')}</span>}
                    </pre>
                  </ScrollArea>

                  {/* Per-line detail */}
                  {ocrResult.lines.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-2xs text-muted-foreground">Righe ({ocrResult.lines.length})</Label>
                        <div className="space-y-0.5 mt-1 max-h-[150px] overflow-y-auto">
                          {ocrResult.lines.map((line, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] p-1 rounded hover:bg-muted/30">
                              <span className="text-muted-foreground w-4 text-right">{i + 1}</span>
                              <span className="flex-1 truncate">{line.text}</span>
                              <Badge variant="outline" className={cn("text-micro px-1 py-0 h-4",
                                line.confidence >= 80 ? "text-emerald-400" :
                                line.confidence >= 50 ? "text-yellow-400" :
                                "text-red-400"
                              )}>
                                {Math.round(line.confidence)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Compare All Results */}
                  {ocrResult.allResults && ocrResult.allResults.length > 1 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-2xs text-muted-foreground">
                          Confronto Engine ({ocrResult.allResults.length})
                        </Label>
                        <div className="space-y-1 mt-1">
                          {ocrResult.allResults.map((r, i) => (
                            <div key={i} className={cn(
                              "p-2 rounded border text-xs",
                              r.engine === ocrResult.engine ? "border-primary/30 bg-primary/5" : "border-transparent bg-muted/30"
                            )}>
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="outline" className={cn("text-micro", ENGINE_COLORS[r.engine])}>
                                  {ENGINE_ICONS[r.engine]} {r.engine}
                                </Badge>
                                <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                                  <span>{Math.round(r.result.confidence)}% conf.</span>
                                  <span>{r.result.processingTime}ms</span>
                                  {r.engine === ocrResult.engine && (
                                    <Badge className="text-2xs h-3 bg-primary/20">BEST</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-2xs truncate text-muted-foreground">{r.result.text.substring(0, 100)}...</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ScanEye className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">{t('ocrEnginesPage.caricaUnaposimmagineEAvviaLapo')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Engine Details */}
        {engineInfos.length > 0 && (
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-xs">{t('ocrEnginesPage.engineDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {engineInfos.map(info => (
                  <div key={info.id} className="p-2 rounded bg-muted/30 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>{ENGINE_ICONS[info.id]}</span>
                      {info.name}
                      {info.available && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                    </div>
                    <div className="text-2xs text-muted-foreground">{info.description}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {info.strengths.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-2xs px-1 py-0">{s}</Badge>
                      ))}
                    </div>
                    <div className="text-2xs text-muted-foreground">
                      Ottimale: {info.bestFor.join(", ")} · Latenza: ~{info.avgLatencyMs}ms · Qualità: {info.qualityScore}/10
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
