'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { invoke } from '@/lib/tauri-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  Zap, 
  FileText, 
  Eye, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  Loader2,
  Bot
} from 'lucide-react';

interface AlternativeMethod {
  method: string;
  description: string;
  reliability: number;
  route: string;
}

interface TranslationRecommendation {
  primary_method: string;
  method_description: string;
  reliability: number;
  recommended_ai: string;
  reason: string;
  alternatives: AlternativeMethod[];
  has_existing_patch: boolean;
  has_localization_files: boolean;
  localization_format: string | null;
  missing_italian: boolean;
  action_label: string;
  action_route: string;
}

interface TranslationRecommendationProps {
  gamePath: string;
  gameName: string;
  onActionClick?: (route: string) => void;
}

const methodIcons: Record<string, React.ReactNode> = {
  live_unity: <Zap className="h-5 w-5" />,
  file_translation: <FileText className="h-5 w-5" />,
  ocr: <Eye className="h-5 w-5" />,
};

const aiLabels: Record<string, string> = {
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  openai: 'OpenAI GPT-4',
  deepseek: 'DeepSeek',
};

export function TranslationRecommendation({ gamePath, gameName, onActionClick }: TranslationRecommendationProps) {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<TranslationRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendation = async () => {
      if (!gamePath) {
        // Se non c'è path, suggerisci OCR come fallback
        setRecommendation({
          primary_method: 'ocr',
          method_description: 'Traduzione in tempo reale tramite riconoscimento ottico dei caratteri',
          reliability: 70,
          recommended_ai: 'gemini',
          reason: 'Path di installazione non trovato. OCR Overlay funziona con qualsiasi game senza bisogno del path.',
          alternatives: [],
          has_existing_patch: false,
          has_localization_files: false,
          localization_format: null,
          missing_italian: true,
          action_label: 'Apri OCR Translator',
          action_route: '/ocr-translator'
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<TranslationRecommendation>('get_translation_recommendation', {
          gamePath,
          gameName,
        });
        setRecommendation(result);
      } catch (err) {
        console.error('Error loading recommendation:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendation();
  }, [gamePath, gameName]);

  const handleAction = async (route: string) => {
    if (onActionClick) {
      onActionClick(route);
    } else if (route.startsWith('steam://')) {
      // Avvia game tramite Steam - apri URL nel sistema
      window.open(route, '_blank');
    } else {
      router.push(route);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-400 mr-2" />
          <span className="text-muted-foreground">Analisi game in corso...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !recommendation) {
    return (
      <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="h-5 w-5" />
            <span>Impossibile analizzare il game</span>
          </div>
          {error && <p className="text-sm text-muted-foreground mt-2">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  const reliabilityColor = 
    recommendation.reliability >= 80 ? 'text-green-400' :
    recommendation.reliability >= 60 ? 'text-yellow-400' : 'text-orange-400';

  return (
    <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/40 w-full">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-purple-300">
            <Sparkles className="h-5 w-5" />
            Raccomandazione Traduzione
          </span>
          {recommendation.has_existing_patch && (
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Patch Disponibile
            </Badge>
          )}
        </div>

        {/* Metodo principale */}
        <div className="flex items-start gap-3 p-3 bg-black/30 rounded-lg border border-white/10">
          <div className="p-2 bg-purple-500/30 rounded-lg text-purple-300 shrink-0">
            {methodIcons[recommendation.primary_method] || <Sparkles className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm">{recommendation.method_description}</h3>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">{recommendation.reason}</p>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={recommendation.reliability} className="h-2 flex-1" />
              <span className={`text-sm font-bold ${reliabilityColor}`}>{recommendation.reliability}%</span>
            </div>
          </div>
        </div>

        {/* AI + Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-blue-500/30 text-blue-200 text-xs px-2 py-1">
            <Bot className="h-3.5 w-3.5 mr-1" />
            {aiLabels[recommendation.recommended_ai] || recommendation.recommended_ai}
          </Badge>
          {recommendation.missing_italian && (
            <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/50 text-xs px-2 py-1">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Italiano mancante
            </Badge>
          )}
        </div>

        {/* Bottone azione principale */}
        <Button 
          className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          onClick={() => handleAction(recommendation.action_route)}
        >
          {recommendation.action_label}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}



