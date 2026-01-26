"use client";

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  FolderOpen, 
  FileSearch, 
  Languages, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Download,
  ArrowRight,
  Sparkles,
  Package,
  Zap
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface BundleInfo {
  bundle_path: string;
  filename: string;
  size_bytes: number;
  locale: string | null;
  locale_name: string | null;
  status: string;
  is_string_table: boolean;
}

interface FolderSummary {
  total_bundles: number;
  complete_locales: string[];
  partial_locales: string[];
  empty_locales: string[];
  max_size: number;
}

interface AnalyzeFolderResult {
  success: boolean;
  message: string;
  bundles: BundleInfo[];
  summary: FolderSummary;
}

interface StringEntry {
  key: string;
  value: string;
  translated: string | null;
}

interface ExtractResult {
  success: boolean;
  message: string;
  output_file: string | null;
  entry_count: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function UnityBundlePage() {
  const { t } = useTranslation();
  const [folderPath, setFolderPath] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeFolderResult | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<BundleInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  
  // Carica API key Gemini dalle impostazioni (anche quando cambia)
  useEffect(() => {
    const loadApiKey = () => {
      const saved = localStorage.getItem('gameStringerSettings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          if (settings.translation?.apiKey) {
            console.log('[UNITY] API Key caricata:', settings.translation.apiKey.substring(0, 10) + '...');
            setGeminiApiKey(settings.translation.apiKey);
          }
        } catch {}
      }
    };
    
    loadApiKey();
    
    // Ricarica quando la finestra torna in focus (dopo aver salvato in Settings)
    window.addEventListener('focus', loadApiKey);
    return () => window.removeEventListener('focus', loadApiKey);
  }, []);
  
  // Workflow state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [extracting, setExtracting] = useState(false);
  const [strings, setStrings] = useState<StringEntry[]>([]);
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [outputFile, setOutputFile] = useState<string>("");
  const [creatingBundle, setCreatingBundle] = useState(false);

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Seleziona cartella bundle Unity"
      });
      
      if (selected) {
        setFolderPath(selected as string);
        setResult(null);
        setSelectedBundle(null);
        setError("");
        setCurrentStep(1);
        setStrings([]);
      }
    } catch (e) {
      console.error("error selezione:", e);
    }
  };

  const handleAnalyze = async () => {
    if (!folderPath) return;
    
    setAnalyzing(true);
    setError("");
    
    try {
      const res = await invoke<AnalyzeFolderResult>("analyze_localization_bundles", {
        folderPath
      });
      
      setResult(res);
      if (!res.success) {
        setError(res.message);
      }
    } catch (e) {
      setError(`error analisi: ${e}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExtractAuto = async () => {
    if (!selectedBundle) return;
    
    setExtracting(true);
    setError("");
    
    try {
      const res = await invoke<ExtractResult>("extract_strings_auto", {
        bundlePath: selectedBundle.bundle_path
      });
      
      if (res.success && res.output_file) {
        setOutputFile(res.output_file);
        const loadedStrings = await invoke<StringEntry[]>("read_extracted_strings", {
          jsonPath: res.output_file
        });
        setStrings(loadedStrings);
        setCurrentStep(2);
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError(`error estrazione: ${e}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleTranslate = async () => {
    if (strings.length === 0) return;
    
    setTranslating(true);
    setTranslationProgress(0);
    setError("");
    
    try {
      const totalStrings = strings.length;
      const translatedStrings: StringEntry[] = [];
      
      // Traduzione completa senza vincoli di lunghezza
      let consecutiveErrors = 0;
      for (let i = 0; i < strings.length; i++) {
        const entry = strings[i];
        
        try {
          console.log('[TRANSLATE] Usando provider: deepl, API Key presente:', !!geminiApiKey);
          const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: entry.value,
              sourceLanguage: 'en',
              targetLanguage: 'it',
              provider: 'deepl',
              apiKey: geminiApiKey || undefined,
              context: 'Video game localization. Translate naturally and completely.'
            })
          });
          
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.warn(`Traduzione fallita per "${entry.value}":`, errData);
            consecutiveErrors++;
            
            // Se troppi errori consecutivi, ferma
            if (consecutiveErrors >= 5) {
              setError("Troppi errori API. Verifica la tua API key Gemini in Settings.");
              break;
            }
            
            translatedStrings.push({ ...entry, translated: entry.value });
          } else {
            const data = await response.json();
            translatedStrings.push({
              ...entry,
              translated: data.translatedText || entry.value
            });
            consecutiveErrors = 0; // Reset errori
          }
        } catch (err) {
          console.error("error traduzione:", err);
          translatedStrings.push({ ...entry, translated: entry.value });
        }
        
        setTranslationProgress(Math.round(((i + 1) / totalStrings) * 100));
        
        // Piccola pausa per evitare rate limiting
        if (i % 10 === 9) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      setStrings(translatedStrings);
      
      if (outputFile) {
        const translatedPath = outputFile.replace('.json', '_it.json');
        await invoke("save_translated_strings", {
          jsonPath: translatedPath,
          entries: translatedStrings
        });
      }
      
      setCurrentStep(3);
    } catch (e) {
      setError(`error traduzione: ${e}`);
    } finally {
      setTranslating(false);
    }
  };

  const [dumpPath, setDumpPath] = useState<string>("");
  const [uabeaStep, setUabeaStep] = useState<number>(0);

  const handleExportForUABEA = async () => {
    if (!outputFile || strings.length === 0) return;
    
    setCreatingBundle(true);
    setError("");
    
    try {
      // Genera file dump compatibile con UABEA
      const path = outputFile.replace('.json', '_uabea_dump.txt');
      
      // Formato UABEA dump
      let dumpContent = "// UABEA StringTable Dump - Import with UABEA\n";
      dumpContent += "// File: localization-string-tables-italian(it)\n\n";
      
      for (const entry of strings) {
        if (entry.translated) {
          dumpContent += `[${entry.key}]\n`;
          dumpContent += `${entry.translated}\n\n`;
        }
      }
      
      // Save file dump
      await invoke("save_uabea_dump", {
        path,
        content: dumpContent
      });
      
      setDumpPath(path);
      setUabeaStep(1);
      setCurrentStep(4);
    } catch (e) {
      setError(`error export: ${e}`);
    } finally {
      setCreatingBundle(false);
    }
  };

  const openUABEA = async () => {
    try {
      await invoke("open_uabea");
      setUabeaStep(2);
    } catch (e) {
      setError(`error apertura UABEA: ${e}`);
    }
  };

  const copyBundlePath = async () => {
    if (!selectedBundle) return;
    const italianBundle = selectedBundle.bundle_path.replace('english(en)', 'italian(it)');
    await navigator.clipboard.writeText(italianBundle);
    setUabeaStep(3);
  };

  const copyDumpPath = async () => {
    await navigator.clipboard.writeText(dumpPath);
    setUabeaStep(4);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "empty": return <XCircle className="h-4 w-4 text-red-500" />;
      case "partial": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-4 overflow-y-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('unityBundle.title')}</h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('unityBundle.subtitle')}</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Zap className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">Auto</span>
              <span className="text-[10px] text-white/70">{t('unityBundle.autoExtraction').split(' ')[1]}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Languages className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">AI</span>
              <span className="text-[10px] text-white/70">{t('unityBundle.aiTranslation').split(' ')[1]}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Stepper Compatto */}
      <div className="flex items-center justify-center gap-1 py-2 shrink-0">
        {[
          { num: 1, label: t('unityBundle.step1') },
          { num: 2, label: t('unityBundle.step2') },
          { num: 3, label: t('unityBundle.step3') },
          { num: 4, label: t('unityBundle.step4') }
        ].map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${
              currentStep >= step.num 
                ? "bg-emerald-600 text-white" 
                : "bg-slate-800/50 text-slate-500 border border-slate-700/50"
            }`}>
              <span className="font-bold">{step.num}</span>
              <span>{step.label}</span>
            </div>
            {idx < 3 && <ArrowRight className="h-3 w-3 mx-1 text-slate-600" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Step 1: Seleziona */}
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-emerald-400" />
              1. {t('unityBundle.selectBundle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex gap-2">
              <Button onClick={handleSelectFolder} variant="outline" size="sm" className="h-8 text-xs">
                {t('unityBundle.browse')}
              </Button>
              <Button 
                onClick={handleAnalyze} 
                disabled={!folderPath || analyzing}
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-500"
              >
                {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSearch className="h-3 w-3" />}
              </Button>
            </div>
            
            {folderPath && (
              <p className="text-[10px] text-muted-foreground font-mono bg-slate-950/50 p-2 rounded truncate border border-slate-800/50">
                {folderPath.split('\\').slice(-2).join('\\')}
              </p>
            )}

            {result && result.success && (
              <ScrollArea className="h-[180px]">
                <div className="space-y-1">
                  {result.bundles.map((bundle, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedBundle(bundle)}
                      className={`p-2 rounded cursor-pointer border text-xs transition-all ${
                        selectedBundle?.bundle_path === bundle.bundle_path
                          ? "bg-emerald-500/20 border-emerald-500/40" 
                          : "hover:bg-slate-800/50 border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(bundle.status)}
                          <span className="font-medium uppercase">{bundle.locale}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{formatBytes(bundle.size_bytes)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Estrai */}
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              2. {t('unityBundle.extractStrings')}
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedBundle ? `${selectedBundle.locale_name || selectedBundle.locale}` : t('unityBundle.selectBundleFirst')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <Button 
              onClick={handleExtractAuto}
              disabled={!selectedBundle || extracting}
              className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500"
            >
              {extracting ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Download className="mr-1 h-3 w-3" />
              )}
              {t('unityBundle.extractAuto')}
            </Button>
            
            {strings.length > 0 && (
              <div className="bg-green-500/10 border border-green-500/30 p-2 rounded">
                <p className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <strong>{strings.length}</strong> {t('unityBundle.stringsExtracted')}
                </p>
              </div>
            )}
            
            {strings.length > 0 && (
              <ScrollArea className="h-[140px] border border-slate-800/50 rounded p-2 bg-slate-950/50">
                {strings.slice(0, 30).map((s, i) => (
                  <div key={i} className="text-[10px] py-1 border-b border-slate-800/30 last:border-0">
                    <p className="text-muted-foreground truncate">{s.key}</p>
                    <p className="truncate">{s.value}</p>
                    {s.translated && <p className="text-green-400 truncate">→ {s.translated}</p>}
                  </div>
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Traduci */}
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              3. {t('unityBundle.translate')}
            </CardTitle>
            <CardDescription className="text-xs">
              {strings.length > 0 ? `${strings.length} ${t('unityBundle.strings')}` : t('unityBundle.extractFirst')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {translating && (
              <div className="space-y-1">
                <Progress value={translationProgress} className="h-1.5" />
                <p className="text-[10px] text-center text-muted-foreground">{translationProgress}%</p>
              </div>
            )}
            
            <Button 
              onClick={handleTranslate}
              disabled={translating || strings.length === 0}
              className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500"
            >
              {translating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Languages className="mr-1 h-3 w-3" />
              )}
              {t('unityBundle.translateToItalian')}
            </Button>
            
            {currentStep >= 3 && strings.some(s => s.translated) && (
              <p className="text-[10px] text-green-400 text-center">
                ✓ {t('unityBundle.translationsReady')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Import UABEA Wizard */}
        <Card className="border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-400" />
              4. {t('unityBundle.importBundle')}
            </CardTitle>
            <CardDescription className="text-xs">
              {uabeaStep === 0 ? t('unityBundle.exportFirst') : `${t('unityBundle.step')} ${uabeaStep}/4`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {uabeaStep === 0 && (
              <Button 
                onClick={handleExportForUABEA}
                disabled={creatingBundle || currentStep < 3 || !strings.some(s => s.translated)}
                className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500"
              >
                {creatingBundle ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Download className="mr-1 h-3 w-3" />
                )}
                {t('unityBundle.generateTranslations')}
              </Button>
            )}
            
            {uabeaStep >= 1 && (
              <div className="space-y-1.5">
                <div className={`flex items-center gap-2 p-1.5 rounded text-xs ${uabeaStep > 1 ? 'bg-green-500/20' : 'bg-emerald-500/20'}`}>
                  <span className="font-bold">1.</span>
                  <Button size="sm" onClick={openUABEA} disabled={uabeaStep > 1} className="h-6 text-[10px]">
                    {t('unityBundle.openUABEA')}
                  </Button>
                  {uabeaStep > 1 && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
                </div>
                
                <div className={`flex items-center gap-2 p-1.5 rounded text-xs ${uabeaStep > 2 ? 'bg-green-500/20' : uabeaStep >= 2 ? 'bg-emerald-500/20' : 'bg-slate-800/50'}`}>
                  <span className="font-bold">2.</span>
                  <Button size="sm" onClick={copyBundlePath} disabled={uabeaStep < 2 || uabeaStep > 2} className="h-6 text-[10px]">
                    {t('unityBundle.copyBundlePath')}
                  </Button>
                  {uabeaStep > 2 && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
                </div>
                <p className="text-[9px] text-muted-foreground pl-5">File → Open → Ctrl+V</p>
                
                <div className={`flex items-center gap-2 p-1.5 rounded text-xs ${uabeaStep > 3 ? 'bg-green-500/20' : uabeaStep >= 3 ? 'bg-emerald-500/20' : 'bg-slate-800/50'}`}>
                  <span className="font-bold">3.</span>
                  <Button size="sm" onClick={copyDumpPath} disabled={uabeaStep < 3 || uabeaStep > 3} className="h-6 text-[10px]">
                    {t('unityBundle.copyTranslationsPath')}
                  </Button>
                  {uabeaStep > 3 && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
                </div>
                <p className="text-[9px] text-muted-foreground pl-5">Import Dump → Ctrl+V</p>
                
                {uabeaStep >= 4 && (
                  <div className="flex items-center gap-2 p-1.5 rounded bg-green-500/20 text-xs">
                    <span className="font-bold">4.</span>
                    <span>{t('unityBundle.save')}</span>
                    <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



