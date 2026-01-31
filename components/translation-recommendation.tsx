'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { invoke } from '@/lib/tauri-api';
import { 
  Sparkles, 
  Zap, 
  FileText, 
  Eye, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  Loader2,
  Bot,
  Shield,
  Lightbulb,
  Package,
  Cpu
} from 'lucide-react';

interface AlternativeMethod {
  method: string;
  description: string;
  reliability: number;
  route: string;
}

interface TranslationTool {
  id: string;
  name: string;
  description: string;
  reliability: number;
  route: string;
  available: boolean;
  reason: string;
}

interface TranslationStrategy {
  tools: TranslationTool[];
  combined_reliability: number;
  description: string;
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
  // Nuovi campi potenziati
  engine_name?: string;
  anti_cheat_detected?: string;
  anti_cheat_warning?: string;
  translation_memory_count?: number;
  community_packages_count?: number;
  best_community_package?: string;
  community_rating?: number;
  translatable_files_count?: number;
  tips?: string[];
  // Analisi completa strumenti
  all_tools?: TranslationTool[];
  optimal_strategy?: TranslationStrategy;
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
      <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
          <span className="text-[10px] text-violet-300/60">Analisi...</span>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2.5 backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-orange-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-[10px]">Analisi non disponibile</span>
        </div>
      </div>
    );
  }

  const strategy = recommendation.optimal_strategy;
  const strategyReliability = strategy?.combined_reliability || recommendation.reliability;
  
  const reliabilityColor = 
    strategyReliability >= 80 ? 'text-emerald-400' :
    strategyReliability >= 60 ? 'text-yellow-400' : 'text-orange-400';

  return (
    <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5 backdrop-blur-md w-full">
      {/* Header compatto */}
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-violet-300/80 uppercase tracking-wide">
          <Sparkles className="h-3 w-3" />
          Raccomandazione
        </span>
        <div className="flex items-center gap-1">
          {recommendation.engine_name && recommendation.engine_name !== 'Sconosciuto' && (
            <span className="flex items-center gap-1 text-[8px] text-cyan-400/70 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              <Cpu className="h-2 w-2" />
              {recommendation.engine_name}
            </span>
          )}
          {recommendation.has_existing_patch && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Patch
            </span>
          )}
        </div>
      </div>

      {/* Anti-cheat warning */}
      {recommendation.anti_cheat_detected && (
        <div className="flex items-center gap-1.5 p-1.5 bg-red-500/10 border border-red-500/20 rounded mb-2">
          <Shield className="h-3 w-3 text-red-400 shrink-0" />
          <span className="text-[9px] text-red-300">
            <strong>{recommendation.anti_cheat_detected}</strong>: {recommendation.anti_cheat_warning}
          </span>
        </div>
      )}

      {/* STRATEGIA COMBINATA OTTIMALE */}
      {strategy && strategy.tools.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border border-emerald-500/20 rounded-md mb-2">
          <div className="p-1.5 bg-emerald-500/20 rounded text-emerald-400 shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-semibold text-emerald-100">Strategia Ottimale</h3>
            <p className="text-[9px] text-emerald-300/70 truncate">{strategy.description}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-16 h-1.5 bg-emerald-900/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" style={{ width: `${strategyReliability}%` }} />
            </div>
            <span className={`text-[10px] font-bold ${reliabilityColor}`}>{strategyReliability}%</span>
          </div>
        </div>
      )}

      {/* Strumenti combinati */}
      {strategy && strategy.tools.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {strategy.tools.map((tool, idx) => (
            <button
              key={tool.id}
              onClick={() => handleAction(tool.route)}
              className="text-[8px] text-cyan-300/80 bg-cyan-500/10 hover:bg-cyan-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors border border-cyan-500/20"
            >
              <span className="font-medium">{idx + 1}.</span> {tool.name}
              <span className="text-cyan-400/60">({tool.reliability}%)</span>
            </button>
          ))}
        </div>
      )}

      {/* Metodo principale - compatto (fallback se no strategy) */}
      {(!strategy || strategy.tools.length === 0) && (
        <div className="flex items-center gap-2 p-2 bg-violet-500/10 rounded-md mb-2">
          <div className="p-1.5 bg-violet-500/20 rounded text-violet-400 shrink-0">
            {methodIcons[recommendation.primary_method] || <Sparkles className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-medium text-violet-100 truncate">{recommendation.method_description}</h3>
            <p className="text-[9px] text-violet-300/50 truncate">{recommendation.reason}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-12 h-1 bg-violet-900/50 rounded-full overflow-hidden">
              <div className="h-full bg-violet-400 rounded-full" style={{ width: `${recommendation.reliability}%` }} />
            </div>
            <span className={`text-[9px] font-bold ${reliabilityColor}`}>{recommendation.reliability}%</span>
          </div>
        </div>
      )}

      {/* Tips */}
      {recommendation.tips && recommendation.tips.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {recommendation.tips.slice(0, 2).map((tip, idx) => (
            <span key={idx} className="text-[8px] text-amber-300/70 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Lightbulb className="h-2 w-2" />
              {tip}
            </span>
          ))}
        </div>
      )}

      {/* AI + Badges inline */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] text-violet-400/60 bg-violet-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
            <Bot className="h-2.5 w-2.5" />
            {aiLabels[recommendation.recommended_ai] || recommendation.recommended_ai}
          </span>
          {recommendation.translatable_files_count && recommendation.translatable_files_count > 0 && (
            <span className="text-[8px] text-blue-400/70 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
              <FileText className="h-2 w-2" />
              {recommendation.translatable_files_count} file
            </span>
          )}
          {recommendation.missing_italian && (
            <span className="text-[9px] text-orange-400/80 bg-orange-500/10 px-1.5 py-0.5 rounded">
              IT mancante
            </span>
          )}
        </div>
        
        {/* Bottone compatto */}
        <button 
          className="text-[10px] font-medium text-violet-200 bg-violet-500/20 hover:bg-violet-500/30 px-2 py-1 rounded flex items-center gap-0.5 transition-colors"
          onClick={() => handleAction(recommendation.action_route)}
        >
          {recommendation.action_label}
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}



