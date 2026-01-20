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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          Unity Bundle Translator
        </h1>
        <p className="text-muted-foreground mt-1">
          Estrazione automatica e traduzione stringhe da bundle Unity
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Workflow Steps */}
      <div className="flex items-center justify-center gap-2 py-4">
        {[
          { num: 1, label: "Seleziona" },
          { num: 2, label: "Estrai" },
          { num: 3, label: "Traduci" },
          { num: 4, label: "Crea Bundle" }
        ].map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full ${
              currentStep >= step.num 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
            }`}>
              <span className="font-bold">{step.num}</span>
              <span className="text-xs">{step.label}</span>
            </div>
            {idx < 3 && <ArrowRight className="h-4 w-4 mx-1 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Step 1: Seleziona */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              1. Seleziona Bundle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleSelectFolder} variant="outline" size="sm">
                Sfoglia
              </Button>
              <Button 
                onClick={handleAnalyze} 
                disabled={!folderPath || analyzing}
                size="sm"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              </Button>
            </div>
            
            {folderPath && (
              <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded truncate">
                {folderPath}
              </p>
            )}

            {result && result.success && (
              <ScrollArea className="h-[250px]">
                <div className="space-y-1">
                  {result.bundles.map((bundle, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedBundle(bundle)}
                      className={`p-2 rounded cursor-pointer border text-sm ${
                        selectedBundle?.bundle_path === bundle.bundle_path
                          ? "bg-primary/10 border-primary" 
                          : "hover:bg-muted border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(bundle.status)}
                          <span className="font-medium uppercase">{bundle.locale}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{formatBytes(bundle.size_bytes)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Estrai */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              2. Estrai Stringhe
            </CardTitle>
            <CardDescription>
              {selectedBundle ? `${selectedBundle.locale_name || selectedBundle.locale}` : "Seleziona bundle"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleExtractAuto}
              disabled={!selectedBundle || extracting}
              className="w-full"
            >
              {extracting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Estrai Automaticamente
            </Button>
            
            {strings.length > 0 && (
              <div className="bg-green-500/10 border border-green-500/30 p-3 rounded">
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <strong>{strings.length}</strong> stringhe estratte
                </p>
              </div>
            )}
            
            {strings.length > 0 && (
              <ScrollArea className="h-[180px] border rounded p-2">
                {strings.slice(0, 30).map((s, i) => (
                  <div key={i} className="text-xs py-1 border-b last:border-0">
                    <p className="text-muted-foreground truncate">{s.key}</p>
                    <p className="truncate">{s.value}</p>
                    {s.translated && <p className="text-green-500 truncate">→ {s.translated}</p>}
                  </div>
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Traduci */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              3. Traduci
            </CardTitle>
            <CardDescription>
              {strings.length > 0 ? `${strings.length} stringhe` : "Estrai prima"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {translating && (
              <div className="space-y-2">
                <Progress value={translationProgress} />
                <p className="text-sm text-center">{translationProgress}%</p>
              </div>
            )}
            
            <Button 
              onClick={handleTranslate}
              disabled={translating || strings.length === 0}
              className="w-full"
            >
              {translating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Languages className="mr-2 h-4 w-4" />
              )}
              Traduci in Italiano
            </Button>
            
            {currentStep >= 3 && strings.some(s => s.translated) && (
              <p className="text-xs text-green-500 text-center">
                ✓ Traduzioni pronte
              </p>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Import UABEA Wizard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              4. Import Bundle
            </CardTitle>
            <CardDescription>
              {uabeaStep === 0 ? "Esporta prima" : `Passo ${uabeaStep}/4`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {uabeaStep === 0 && (
              <Button 
                onClick={handleExportForUABEA}
                disabled={creatingBundle || currentStep < 3 || !strings.some(s => s.translated)}
                className="w-full"
              >
                {creatingBundle ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Genera File Traduzioni
              </Button>
            )}
            
            {uabeaStep >= 1 && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 p-2 rounded ${uabeaStep > 1 ? 'bg-green-500/20' : 'bg-primary/20'}`}>
                  <span className="font-bold">1.</span>
                  <Button size="sm" onClick={openUABEA} disabled={uabeaStep > 1}>
                    Apri UABEA
                  </Button>
                  {uabeaStep > 1 && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
                </div>
                
                <div className={`flex items-center gap-2 p-2 rounded ${uabeaStep > 2 ? 'bg-green-500/20' : uabeaStep >= 2 ? 'bg-primary/20' : 'bg-muted'}`}>
                  <span className="font-bold">2.</span>
                  <Button size="sm" onClick={copyBundlePath} disabled={uabeaStep < 2 || uabeaStep > 2}>
                    Copia Path Bundle IT
                  </Button>
                  {uabeaStep > 2 && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground pl-6">In UABEA: File → Open → Ctrl+V</p>
                
                <div className={`flex items-center gap-2 p-2 rounded ${uabeaStep > 3 ? 'bg-green-500/20' : uabeaStep >= 3 ? 'bg-primary/20' : 'bg-muted'}`}>
                  <span className="font-bold">3.</span>
                  <Button size="sm" onClick={copyDumpPath} disabled={uabeaStep < 3 || uabeaStep > 3}>
                    Copia Path Traduzioni
                  </Button>
                  {uabeaStep > 3 && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground pl-6">Seleziona asset → Import Dump → Ctrl+V</p>
                
                {uabeaStep >= 4 && (
                  <div className="flex items-center gap-2 p-2 rounded bg-green-500/20">
                    <span className="font-bold">4.</span>
                    <span className="text-sm">Salva: File → Save</span>
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
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



