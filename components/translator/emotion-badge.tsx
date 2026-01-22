"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { 
  EmotionAnalysis, 
  EmotionType, 
  EMOTION_STYLES,
  analyzeEmotion 
} from "@/lib/emotion-analyzer"
import { Sparkles, ChevronDown, Zap } from "lucide-react"

interface EmotionBadgeProps {
  text: string
  analysis?: EmotionAnalysis
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onEmotionOverride?: (emotion: EmotionType) => void
}

export function EmotionBadge({ 
  text, 
  analysis: providedAnalysis,
  showDetails = false,
  size = 'md',
  className,
  onEmotionOverride
}: EmotionBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Usa l'analisi fornita o analizza il testo
  const analysis = providedAnalysis || analyzeEmotion(text)
  const style = EMOTION_STYLES[analysis.primary]
  const secondaryStyle = analysis.secondary ? EMOTION_STYLES[analysis.secondary] : null

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const intensityColors = {
    low: 'opacity-60',
    medium: 'opacity-80',
    high: 'opacity-100'
  }

  if (analysis.primary === 'neutral' && !showDetails) {
    return null // Non mostrare badge per testi neutri
  }

  const BadgeContent = (
    <Badge
      className={cn(
        sizeClasses[size],
        intensityColors[analysis.intensity],
        "cursor-pointer transition-all hover:scale-105",
        className
      )}
      style={{ 
        backgroundColor: `${style.color}20`,
        color: style.color,
        borderColor: style.color
      }}
      variant="outline"
    >
      <span className="mr-1">{style.icon}</span>
      {style.labelIt}
      {analysis.intensity === 'high' && (
        <Zap className="ml-1 h-3 w-3" />
      )}
    </Badge>
  )

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {BadgeContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{style.label} ({analysis.confidence}%)</p>
              <p className="text-xs text-muted-foreground">
                {style.translationGuidelines}
              </p>
              {analysis.markers.length > 0 && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Markers:</span>{' '}
                  <span className="font-mono">{analysis.markers.join(', ')}</span>
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1 h-auto py-1", className)}
        >
          {BadgeContent}
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-180"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <h4 className="font-semibold">Emotion Analysis</h4>
          </div>

          {/* Primary Emotion */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{style.icon}</span>
                <div>
                  <p className="font-medium">{style.labelIt}</p>
                  <p className="text-xs text-muted-foreground">
                    Intensità: {analysis.intensity === 'high' ? 'Alta' : analysis.intensity === 'medium' ? 'Media' : 'Bassa'}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{analysis.confidence}%</Badge>
            </div>
            <Progress 
              value={analysis.confidence} 
              className="h-2"
              style={{ 
                // @ts-ignore
                '--progress-background': style.color 
              } as React.CSSProperties}
            />
          </div>

          {/* Secondary Emotion */}
          {secondaryStyle && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <span>{secondaryStyle.icon}</span>
              <span className="text-sm text-muted-foreground">
                Sfumatura: {secondaryStyle.labelIt}
              </span>
            </div>
          )}

          {/* Markers */}
          {analysis.markers.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Parole chiave rilevate:
              </p>
              <div className="flex flex-wrap gap-1">
                {analysis.markers.map((marker, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {marker}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Translation Guidelines */}
          <div className="space-y-1 p-2 rounded-md bg-muted/30">
            <p className="text-xs font-medium">Linee guida traduzione:</p>
            <p className="text-xs text-muted-foreground">
              {style.translationGuidelines}
            </p>
          </div>

          {/* Override */}
          {onEmotionOverride && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">
                Cambia emozione:
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.values(EMOTION_STYLES)
                  .filter(s => s.emotion !== analysis.primary)
                  .map(s => (
                    <Button
                      key={s.emotion}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        onEmotionOverride(s.emotion)
                        setIsOpen(false)
                      }}
                    >
                      {s.icon} {s.labelIt}
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Componente per mostrare statistiche emozioni di un batch
 */
interface EmotionStatsProps {
  texts: string[]
  className?: string
}

export function EmotionStats({ texts, className }: EmotionStatsProps) {
  const emotions = texts.map(t => analyzeEmotion(t))
  
  // Conta per emozione
  const counts: Record<EmotionType, number> = {
    anger: 0, joy: 0, sadness: 0, fear: 0, surprise: 0,
    disgust: 0, neutral: 0, sarcasm: 0, excitement: 0, tension: 0
  }
  
  emotions.forEach(e => counts[e.primary]++)
  
  const sorted = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])

  if (sorted.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {sorted.map(([emotion, count]) => {
        const style = EMOTION_STYLES[emotion as EmotionType]
        const percentage = Math.round((count / texts.length) * 100)
        
        return (
          <TooltipProvider key={emotion}>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant="outline"
                  style={{ 
                    backgroundColor: `${style.color}15`,
                    borderColor: style.color 
                  }}
                >
                  {style.icon} {count} ({percentage}%)
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {style.labelIt}: {count} testi
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}
