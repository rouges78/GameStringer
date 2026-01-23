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
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-red-600 p-6 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Subtitle Translator</h1>
              <p className="text-white/80 text-sm">Traduci sottotitoli video in qualsiasi lingua</p>
            </div>
          </div>
          
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
              <FileText className="w-4 h-4" />
              <div>
                <p className="text-xs text-white/70">Formati</p>
                <p className="text-sm font-medium">SRT • VTT • ASS</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
              <Languages className="w-4 h-4" />
              <div>
                <p className="text-xs text-white/70">Lingue</p>
                <p className="text-sm font-medium">12+ supportate</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
              <Zap className="w-4 h-4" />
              <div>
                <p className="text-xs text-white/70">Traduzione</p>
                <p className="text-sm font-medium">AI + Gratuita</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </div>

      {/* Features */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="p-2 bg-pink-500/10 rounded-lg">
            <Film className="w-4 h-4 text-pink-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Multi-formato</p>
            <p className="text-xs text-muted-foreground">Import/export qualsiasi formato</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="p-2 bg-rose-500/10 rounded-lg">
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Timing preservato</p>
            <p className="text-xs text-muted-foreground">Sincronizzazione intatta</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <Sparkles className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Editor integrato</p>
            <p className="text-xs text-muted-foreground">Modifica ogni riga</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Languages className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Validazione QA</p>
            <p className="text-xs text-muted-foreground">Rileva problemi automaticamente</p>
          </div>
        </div>
      </div>

      {/* Main Translator Component */}
      <SubtitleTranslator onTranslate={handleTranslate} />
    </div>
  );
}
