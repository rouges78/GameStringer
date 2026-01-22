"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowUpDown,
  Filter,
  BarChart3,
  Eye,
  EyeOff,
  ChevronRight
} from "lucide-react"
import {
  HeatmapData,
  ConfidenceResult,
  ConfidenceLevel,
  CONFIDENCE_COLORS,
  TranslationPair,
  filterByConfidenceLevel,
  sortByConfidence,
  getHeatmapChartData
} from "@/lib/translation-confidence"

interface ConfidenceHeatmapProps {
  data: HeatmapData
  onSelectPair?: (pair: TranslationPair) => void
  className?: string
}

// Componente Badge per singolo livello di confidenza
function ConfidenceBadge({ result, size = 'md' }: { result: ConfidenceResult; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  return (
    <Badge
      variant="outline"
      className={cn(sizeClasses[size], "font-mono")}
      style={{
        backgroundColor: result.bgColor,
        borderColor: result.color,
        color: result.color
      }}
    >
      {result.score}%
    </Badge>
  )
}

// Componente per singola riga della heatmap
function HeatmapRow({
  pair,
  result,
  isSelected,
  onClick,
  showDetails
}: {
  pair: TranslationPair
  result: ConfidenceResult
  isSelected: boolean
  onClick: () => void
  showDetails: boolean
}) {
  const issueIcon = useMemo(() => {
    if (result.issues.some(i => i.type === 'error')) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
    if (result.issues.some(i => i.type === 'warning')) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    }
    if (result.score >= 90) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }
    return <Info className="h-4 w-4 text-blue-500" />
  }, [result])

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
        isSelected 
          ? "bg-primary/10 border-primary" 
          : "hover:bg-muted/50 border-transparent hover:border-muted-foreground/20"
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: result.color }}
      onClick={onClick}
    >
      {/* Score Badge */}
      <div className="flex flex-col items-center gap-1 min-w-[50px]">
        <ConfidenceBadge result={result} size="sm" />
        {issueIcon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-muted-foreground truncate">
          {pair.original}
        </p>
        <p className="text-sm font-medium truncate">
          {pair.translated || <span className="text-red-500 italic">Mancante</span>}
        </p>
        
        {/* Issues inline */}
        {showDetails && result.issues.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {result.issues.map((issue, i) => (
              <Badge
                key={i}
                variant="outline"
                className={cn(
                  "text-xs",
                  issue.type === 'error' && "border-red-500 text-red-500",
                  issue.type === 'warning' && "border-yellow-500 text-yellow-500",
                  issue.type === 'info' && "border-blue-500 text-blue-500"
                )}
              >
                {issue.messageIt}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Arrow indicator */}
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

// Componente Summary Card
function SummaryCard({ data }: { data: HeatmapData }) {
  const chartData = getHeatmapChartData(data)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Riepilogo Qualità
        </CardTitle>
        <CardDescription>
          {data.summary.total} traduzioni analizzate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average Score */}
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-4xl font-bold" style={{
            color: data.summary.averageScore >= 80 
              ? CONFIDENCE_COLORS.high.color 
              : data.summary.averageScore >= 60
                ? CONFIDENCE_COLORS.medium.color
                : CONFIDENCE_COLORS.low.color
          }}>
            {data.summary.averageScore}%
          </p>
          <p className="text-sm text-muted-foreground">Punteggio Medio</p>
        </div>

        {/* Distribution Bars */}
        <div className="space-y-2">
          {chartData.distribution.map(item => (
            <div key={item.level} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.level}
                </span>
                <span className="font-mono">{item.count}</span>
              </div>
              <Progress
                value={(item.count / data.summary.total) * 100}
                className="h-2"
                style={{ 
                  // @ts-ignore
                  '--progress-background': item.color 
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Issues */}
        {data.summary.topIssues.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Problemi Frequenti</p>
            <div className="space-y-1">
              {data.summary.topIssues.slice(0, 3).map((issue, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">{issue.message}</span>
                  <Badge variant="secondary" className="ml-2">{issue.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente Detail Panel
function DetailPanel({ pair, result }: { pair: TranslationPair; result: ConfidenceResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Dettaglio Traduzione</CardTitle>
          <ConfidenceBadge result={result} size="lg" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Texts */}
        <div className="space-y-3">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Originale</p>
            <p className="text-sm">{pair.original}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: result.bgColor }}>
            <p className="text-xs text-muted-foreground mb-1">Traduzione</p>
            <p className="text-sm">{pair.translated || <span className="italic text-red-500">Mancante</span>}</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(result.metrics).map(([key, value]) => (
            <div key={key} className="p-2 bg-muted/50 rounded text-center">
              <p className="text-lg font-bold">{value}%</p>
              <p className="text-xs text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
            </div>
          ))}
        </div>

        {/* Issues */}
        {result.issues.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Problemi Rilevati</p>
            {result.issues.map((issue, i) => (
              <div
                key={i}
                className={cn(
                  "p-2 rounded-lg text-sm flex items-start gap-2",
                  issue.type === 'error' && "bg-red-50 dark:bg-red-950/20",
                  issue.type === 'warning' && "bg-yellow-50 dark:bg-yellow-950/20",
                  issue.type === 'info' && "bg-blue-50 dark:bg-blue-950/20"
                )}
              >
                {issue.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />}
                {issue.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                {issue.type === 'info' && <Info className="h-4 w-4 text-blue-500 mt-0.5" />}
                <span>{issue.messageIt}</span>
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Suggerimenti</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {result.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente principale Heatmap
export function ConfidenceHeatmap({ data, onSelectPair, className }: ConfidenceHeatmapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterLevel, setFilterLevel] = useState<ConfidenceLevel | 'all'>('all')
  const [showDetails, setShowDetails] = useState(true)

  // Filtra e ordina le coppie
  const displayPairs = useMemo(() => {
    let pairs = data.pairs

    // Filtra per livello
    if (filterLevel !== 'all') {
      pairs = filterByConfidenceLevel(data, [filterLevel])
    }

    // Ordina
    pairs = [...pairs].sort((a, b) => {
      const scoreA = data.results.get(a.id)?.score || 0
      const scoreB = data.results.get(b.id)?.score || 0
      return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA
    })

    return pairs
  }, [data, filterLevel, sortOrder])

  const selectedPair = selectedId ? data.pairs.find(p => p.id === selectedId) : null
  const selectedResult = selectedId ? data.results.get(selectedId) : null

  const handleSelectPair = (pair: TranslationPair) => {
    setSelectedId(pair.id)
    onSelectPair?.(pair)
  }

  return (
    <div className={cn("grid lg:grid-cols-3 gap-4", className)}>
      {/* Main List */}
      <div className="lg:col-span-2 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterLevel} onValueChange={(v) => setFilterLevel(v as any)}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="critical">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS.critical.color }} />
                  Critici
                </span>
              </SelectItem>
              <SelectItem value="low">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS.low.color }} />
                  Bassi
                </span>
              </SelectItem>
              <SelectItem value="medium">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS.medium.color }} />
                  Medi
                </span>
              </SelectItem>
              <SelectItem value="high">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS.high.color }} />
                  Alti
                </span>
              </SelectItem>
              <SelectItem value="perfect">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS.perfect.color }} />
                  Perfetti
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {sortOrder === 'asc' ? 'Problemi prima' : 'Migliori prima'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showDetails ? 'Nascondi dettagli' : 'Mostra dettagli'}
          </Button>

          <Badge variant="secondary" className="ml-auto">
            {displayPairs.length} / {data.summary.total}
          </Badge>
        </div>

        {/* Heatmap List */}
        <Card>
          <ScrollArea className="h-[600px]">
            <div className="p-2 space-y-1">
              {displayPairs.map(pair => {
                const result = data.results.get(pair.id)
                if (!result) return null

                return (
                  <HeatmapRow
                    key={pair.id}
                    pair={pair}
                    result={result}
                    isSelected={pair.id === selectedId}
                    onClick={() => handleSelectPair(pair)}
                    showDetails={showDetails}
                  />
                )
              })}

              {displayPairs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nessuna traduzione trovata con questi filtri
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <SummaryCard data={data} />
        
        {selectedPair && selectedResult && (
          <DetailPanel pair={selectedPair} result={selectedResult} />
        )}
      </div>
    </div>
  )
}

// Export componenti individuali per uso modulare
export { ConfidenceBadge, SummaryCard, DetailPanel, HeatmapRow }
