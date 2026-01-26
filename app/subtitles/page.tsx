"use client";

import { useState } from "react";
import { 
  Film, 
  Sparkles, 
  Languages, 
  Clock,
  FileText,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubtitleTranslator } from "@/components/translator/subtitle-translator";
import { useTranslation } from "@/lib/i18n";

export default function SubtitlesPage() {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState<string>("");

  // Funzione di traduzione che usa l'API
  const handleTranslate = async (texts: string[], targetLang: string): Promise<string[]> => {
    const translations: string[] = [];
    
    for (const text of texts) {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            targetLanguage: targetLang,
            provider: "libre", // Usa provider gratuito di default
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          translations.push(data.translatedText || text);
        } else {
          translations.push(text);
        }
      } catch (error) {
        console.error("Translation error:", error);
        translations.push(text);
      }
    }
    
    return translations;
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      {/* Hero Header - Compatto e Blu */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-4 text-white">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t('subtitleTranslator.title')}</h1>
              <p className="text-white/80 text-xs">{t('subtitleTranslator.subtitle')}</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10">
              <FileText className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{t('subtitleTranslator.formats')}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10">
              <Languages className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">12+ {t('subtitleTranslator.languages')}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{t('subtitleTranslator.aiFree')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features - Compatto */}
      <div className="grid grid-cols-4 gap-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border">
          <div className="p-1.5 bg-blue-500/10 rounded">
            <Film className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-medium">{t('subtitleTranslator.multiFormat')}</p>
            <p className="text-[10px] text-muted-foreground">{t('subtitleTranslator.importExport')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border">
          <div className="p-1.5 bg-indigo-500/10 rounded">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-medium">{t('subtitleTranslator.timingPreserved')}</p>
            <p className="text-[10px] text-muted-foreground">{t('subtitleTranslator.sync')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border">
          <div className="p-1.5 bg-teal-500/10 rounded">
            <Sparkles className="w-3.5 h-3.5 text-teal-500" />
          </div>
          <div>
            <p className="text-xs font-medium">{t('subtitleTranslator.integratedEditor')}</p>
            <p className="text-[10px] text-muted-foreground">{t('subtitleTranslator.editLines')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border">
          <div className="p-1.5 bg-cyan-500/10 rounded">
            <Languages className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div>
            <p className="text-xs font-medium">{t('subtitleTranslator.qaValidation')}</p>
            <p className="text-[10px] text-muted-foreground">{t('subtitleTranslator.autoCheck')}</p>
          </div>
        </div>
      </div>

      {/* Main Translator Component */}
      <SubtitleTranslator onTranslate={handleTranslate} />
    </div>
  );
}
