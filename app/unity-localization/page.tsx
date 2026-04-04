"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FolderOpen, Globe, Languages, CheckCircle2, XCircle, AlertCircle,
  Loader2, Download, ArrowRight, Sparkles, Package, Search,
  FileText, BookOpen, Braces, Shield, RefreshCw, Copy, ChevronRight
} from "lucide-react";
// import { useTranslation } from "@/lib/i18n";
import {
  type StringTableEntry,
  type StringTableInfo,
  type AddressablesCatalog,
  type TranslatedEntry,
  SUPPORTED_LOCALES,
  getLocaleDisplayName,
  detectStringTables,
  loadAddressablesCatalog,
  extractStringTable,
  buildPatchedBundle,
  translateStringTable,
  validateAllTranslations,
  exportTableToCSV,
  exportTableToJSON,
} from "@/lib/unity-localization";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/** Lightweight table summary for Step 2 (no entries loaded yet) */
interface TableSummary {
  tableName: string;
  locale: string;
  localeName: string;
  entryCount: number;
  smartCount: number;
  bundlePath: string;
  sizeBytes: number;
}

function tableToSummary(t: StringTableInfo): TableSummary {
  return {
    tableName: t.tableName,
    locale: t.locale,
    localeName: t.localeName,
    entryCount: t.entries.length,
    smartCount: t.entries.filter((e) => e.isSmart).length,
    bundlePath: t.bundlePath,
    sizeBytes: 0,
  };
}

const ALL_LOCALE_CODES = Object.keys(SUPPORTED_LOCALES);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UnityLocalizationPage() {
  // const { t } = useTranslation();

  // Wizard state
  const [step, setStep] = useState(1);
  const [folderPath, setFolderPath] = useState("");
  const [catalog, setCatalog] = useState<AddressablesCatalog | null>(null);
  const [tableSummaries, setTableSummaries] = useState<TableSummary[]>([]);
  const [loadedTable, setLoadedTable] = useState<StringTableInfo | null>(null);
  const [entries, setEntries] = useState<StringTableEntry[]>([]);
  const [sourceLocale, setSourceLocale] = useState("en");
  const [targetLocale, setTargetLocale] = useState("it");
  const [searchFilter, setSearchFilter] = useState("");
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [validating, setValidating] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Ref for batch-update optimisation during translation
  const entriesRef = useRef<StringTableEntry[]>([]);
  entriesRef.current = entries;

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem("gameStringerSettings");
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (s.translation?.defaultTargetLang) setTargetLocale(s.translation.defaultTargetLang);
        } catch { /* ignore */ }
      }
    };
    loadSettings();
    window.addEventListener("focus", loadSettings);
    return () => window.removeEventListener("focus", loadSettings);
  }, []);

  // -----------------------------------------------------------------------
  // Step 1: Folder selection & analysis
  // -----------------------------------------------------------------------

  const handleSelectFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Seleziona cartella Unity Localization",
      });
      if (selected) {
        setFolderPath(selected as string);
        setTableSummaries([]);
        setCatalog(null);
        setLoadedTable(null);
        setEntries([]);
        setError("");
        setStep(1);
      }
    } catch (e) {
      console.error("Errore selezione cartella:", e);
    }
  };

  const handleAnalyzeFolder = async () => {
    if (!folderPath) return;
    setAnalyzing(true);
    setError("");

    try {
      // Detect string tables
      const detected = await detectStringTables(folderPath);
      setTableSummaries(detected.map(tableToSummary));

      // Try loading addressables catalog (optional)
      try {
        const cat = await loadAddressablesCatalog(folderPath);
        setCatalog(cat);
        if (cat.locales.length > 0 && !cat.locales.includes(sourceLocale)) {
          setSourceLocale(cat.locales[0]);
        }
      } catch {
        // Catalog is not mandatory
      }

      if (detected.length > 0) {
        setStep(2);
      } else {
        setError("Nessuna StringTable trovata nella cartella selezionata.");
      }
    } catch (e) {
      setError(`Errore analisi: ${e}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Step 2: Select table & load entries
  // -----------------------------------------------------------------------

  const handleSelectTable = async (summary: TableSummary) => {
    setError("");
    try {
      const tables = await extractStringTable(summary.bundlePath);
      const match = tables.find((t) => t.tableName === summary.tableName) ?? tables[0];
      if (!match) {
        setError("Nessuna entry trovata nel bundle selezionato.");
        return;
      }
      setLoadedTable(match);
      setEntries(match.entries.map((e) => ({ ...e })));
      setStep(3);
    } catch (e) {
      setError(`Errore caricamento tabella: ${e}`);
    }
  };

  const availableLocales = useMemo(() => {
    if (catalog && catalog.locales.length > 0) return catalog.locales;
    const locales = new Set(tableSummaries.map((t) => t.locale));
    return Array.from(locales);
  }, [catalog, tableSummaries]);

  // -----------------------------------------------------------------------
  // Step 3: Translation editor
  // -----------------------------------------------------------------------

  const handleTranslateAll = async () => {
    if (!loadedTable || entries.length === 0) return;
    setTranslating(true);
    setProgress(0);
    setError("");

    try {
      // Build a temporary table with current entries for the service
      const tableForTranslation: StringTableInfo = {
        ...loadedTable,
        entries: entries.map((e) => ({ ...e })),
      };

      const result = await translateStringTable(tableForTranslation, targetLocale, {
        preserveSmartStrings: true,
        batchSize: 20,
      });

      setEntries(result.entries);
      setProgress(100);
    } catch (e) {
      setError(`Errore traduzione: ${e}`);
    } finally {
      setTranslating(false);
    }
  };

  const handleEntryChange = useCallback((keyId: number, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.keyId === keyId
          ? { ...e, translated: value, translationStatus: "pending" as const }
          : e
      )
    );
  }, []);

  const handleValidateAll = async () => {
    if (!loadedTable) return;
    setValidating(true);
    setError("");

    try {
      const tableForValidation: StringTableInfo = { ...loadedTable, entries };
      const validations = await validateAllTranslations(tableForValidation);

      setEntries((prev) =>
        prev.map((entry, idx) => {
          const v = validations[idx];
          if (!v) return entry;
          if (!v.valid) {
            return {
              ...entry,
              translationStatus: "error" as const,
              validationErrors: [
                ...v.missingTokens.map((tk) => `Token mancante: ${tk}`),
                ...v.extraTokens.map((tk) => `Token extra: ${tk}`),
                ...v.warnings,
              ],
            };
          }
          if (v.warnings.length > 0) {
            return { ...entry, translationStatus: "validated" as const, validationErrors: v.warnings };
          }
          return { ...entry, translationStatus: "validated" as const, validationErrors: [] };
        })
      );
    } catch (e) {
      setError(`Errore validazione: ${e}`);
    } finally {
      setValidating(false);
    }
  };

  // --- Filtering & stats (memoized) ---

  const tabCounts = useMemo(() => {
    let smart = 0, untranslated = 0, validated = 0;
    for (const e of entries) {
      if (e.isSmart) smart++;
      if (!e.translated) untranslated++;
      if (e.translationStatus === "validated" || e.translationStatus === "error") validated++;
    }
    return { all: entries.length, smart, untranslated, validated };
  }, [entries]);

  const stats = useMemo(() => {
    let translated = 0, valid = 0, warnings = 0;
    for (const e of entries) {
      if (e.translated) translated++;
      if (e.translationStatus === "validated") valid++;
      if (e.translationStatus === "error") warnings++;
    }
    return { translated, valid, warnings };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let filtered = entries;

    if (activeTab === "smart") {
      filtered = filtered.filter((e) => e.isSmart);
    } else if (activeTab === "untranslated") {
      filtered = filtered.filter((e) => !e.translated);
    } else if (activeTab === "validated") {
      filtered = filtered.filter(
        (e) => e.translationStatus === "validated" || e.translationStatus === "error"
      );
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.keyName.toLowerCase().includes(q) ||
          e.value.toLowerCase().includes(q) ||
          (e.translated && e.translated.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [entries, activeTab, searchFilter]);

  // -----------------------------------------------------------------------
  // Step 4: Export & patch
  // -----------------------------------------------------------------------

  const handleExportPatchedBundle = async () => {
    if (!loadedTable) return;
    setExporting(true);
    setError("");
    try {
      const translations: TranslatedEntry[] = entries
        .filter((e) => e.translated)
        .map((e) => ({ keyId: e.keyId, translated: e.translated! }));

      const outputPath = loadedTable.bundlePath.replace(/(\.\w+)$/, `_${targetLocale}$1`);
      const result = await buildPatchedBundle(loadedTable.bundlePath, translations, outputPath);

      if (result.success) {
        setExportResult(result.outputPath);
        setStep(4);
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(`Errore creazione bundle: ${e}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (!loadedTable) return;
    const tableForExport: StringTableInfo = { ...loadedTable, entries };
    const csv = exportTableToCSV(tableForExport);
    downloadFile(csv, `${loadedTable.tableName}_${targetLocale}.csv`, "text/csv");
    setExportResult(`CSV esportato: ${loadedTable.tableName}_${targetLocale}.csv`);
    setStep(4);
  };

  const handleExportJSON = () => {
    if (!loadedTable) return;
    const tableForExport: StringTableInfo = { ...loadedTable, entries };
    const json = exportTableToJSON(tableForExport);
    downloadFile(json, `${loadedTable.tableName}_${targetLocale}.json`, "application/json");
    setExportResult(`JSON esportato: ${loadedTable.tableName}_${targetLocale}.json`);
    setStep(4);
  };

  const handleCopyAll = async () => {
    const text = entries
      .map((e) => `${e.keyName}\t${e.value}\t${e.translated ?? ""}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  // -----------------------------------------------------------------------
  // UI helpers
  // -----------------------------------------------------------------------

  const validationIcon = (entry: StringTableEntry) => {
    switch (entry.translationStatus) {
      case "validated":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
      case "error":
        return (
          <span title={entry.validationErrors?.join("\n")}>
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          </span>
        );
      default:
        return entry.translated ? (
          <AlertCircle className="h-4 w-4 text-yellow-400/60 shrink-0" />
        ) : null;
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-4 overflow-y-auto">
      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-700 via-teal-600 to-emerald-700 p-4 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                Unity Localization Package
              </h1>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                StringTable, Smart Strings e cataloghi Addressables
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Braces className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">Smart</span>
              <span className="text-xs text-white/70">Strings</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Languages className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">AI</span>
              <span className="text-xs text-white/70">Traduzione</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 shrink-0">
          <XCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
          <button onClick={() => setError("")} className="ml-auto text-red-400/60 hover:text-red-300">
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Stepper ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1 py-2 shrink-0">
        {[
          { num: 1, label: "Seleziona" },
          { num: 2, label: "Catalogo" },
          { num: 3, label: "Traduci" },
          { num: 4, label: "Esporta" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${
                step >= s.num
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-800/50 text-slate-500 border border-slate-700/50"
              } ${s.num < step ? "cursor-pointer hover:bg-cyan-500" : s.num > step ? "cursor-default" : ""}`}
              onClick={() => { if (s.num < step) setStep(s.num); }}
              tabIndex={s.num < step ? 0 : -1}
              aria-label={`Passo ${s.num}: ${s.label}`}
            >
              <span className="font-bold">{s.num}</span>
              <span>{s.label}</span>
            </button>
            {idx < 3 && <ArrowRight className="h-3 w-3 mx-1 text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ================================================================= */}
      {/* STEP 1: Folder Selection                                          */}
      {/* ================================================================= */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                icon: FileText,
                title: "StringTable",
                desc: "Rileva e carica automaticamente tutte le StringTable (.asset) del progetto Unity, con supporto chiavi e valori multilingua.",
              },
              {
                icon: Braces,
                title: "Smart Strings",
                desc: "Supporto completo per Smart Strings: parsing dei token, validazione dei placeholder e traduzione intelligente.",
              },
              {
                icon: Package,
                title: "Addressables",
                desc: "Analisi del catalogo Addressables per individuare bundle di localizzazione e statistiche di copertura.",
              },
            ].map((card) => (
              <Card key={card.title} variant="muted">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <card.icon className="h-4 w-4 text-cyan-400" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Folder picker */}
          <Card variant="muted">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-cyan-400" />
                Seleziona Cartella Progetto
              </CardTitle>
              <CardDescription className="text-xs">
                Scegli la cartella contenente i file di localizzazione Unity (StreamingAssets, Localization, ecc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex gap-2">
                <Button onClick={handleSelectFolder} variant="outline" size="sm" className="h-9 text-xs">
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                  Sfoglia...
                </Button>
                <Button
                  onClick={handleAnalyzeFolder}
                  disabled={!folderPath || analyzing}
                  size="sm"
                  className="h-9 bg-cyan-600 hover:bg-cyan-500 text-xs"
                >
                  {analyzing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Analizza
                </Button>
              </div>

              {folderPath && (
                <p
                  className="text-xs text-slate-400 font-mono bg-slate-950/50 p-2 rounded truncate border border-slate-800/50"
                  title={folderPath}
                >
                  {folderPath}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: Catalog Overview                                          */}
      {/* ================================================================= */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Locale badges + selectors */}
          <Card variant="muted">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-cyan-400" />
                Locale Rilevati
                {catalog && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    {catalog.tables.length} tabelle
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Locale badges */}
              <div className="flex flex-wrap gap-1.5">
                {availableLocales.map((loc) => (
                  <Badge
                    key={loc}
                    className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30"
                  >
                    {getLocaleDisplayName(loc)} ({loc})
                  </Badge>
                ))}
              </div>

              {/* Source / Target selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Lingua sorgente
                  </label>
                  <Select value={sourceLocale} onValueChange={setSourceLocale}>
                    <SelectTrigger className="h-9 text-xs bg-slate-950/50 border-slate-700/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLocales.map((loc) => (
                        <SelectItem key={loc} value={loc} className="text-xs">
                          {getLocaleDisplayName(loc)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Lingua target
                  </label>
                  <Select value={targetLocale} onValueChange={setTargetLocale}>
                    <SelectTrigger className="h-9 text-xs bg-slate-950/50 border-slate-700/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_LOCALE_CODES.map((loc) => (
                        <SelectItem key={loc} value={loc} className="text-xs">
                          {getLocaleDisplayName(loc)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table list */}
          <Card variant="muted">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-cyan-400" />
                  StringTable ({tableSummaries.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleAnalyzeFolder}
                  disabled={analyzing}
                >
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Ricarica</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {tableSummaries.map((table, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectTable(table)}
                    className="group w-full text-left p-3 rounded-lg border transition-all hover:bg-slate-800/50 border-slate-800/30 hover:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-400" />
                        <span className="text-sm font-medium text-slate-200">{table.tableName}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                        {table.locale.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                        {table.entryCount} chiavi
                      </Badge>
                      {table.smartCount > 0 && (
                        <Badge className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                          <Braces className="h-3 w-3 mr-0.5" />
                          {table.smartCount} smart
                        </Badge>
                      )}
                      {table.sizeBytes > 0 && (
                        <span className="text-xs text-slate-500 ml-auto">{formatBytes(table.sizeBytes)}</span>
                      )}
                    </div>
                  </button>
                ))}

                {tableSummaries.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Nessuna StringTable trovata
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: Translation Editor                                        */}
      {/* ================================================================= */}
      {step === 3 && loadedTable && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Top bar */}
          <Card variant="muted" className="shrink-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-slate-200">{loadedTable.tableName}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge className="text-xs bg-slate-700/50 text-slate-300">
                    {sourceLocale.toUpperCase()}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <Badge className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                    {targetLocale.toUpperCase()}
                  </Badge>
                </div>

                <div className="relative ml-auto flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    aria-label="Cerca" placeholder="Cerca chiave o valore..."
                    className="h-9 text-xs pl-8 bg-slate-950/50 border-slate-700/50"
                  />
                </div>

                <Button
                  onClick={handleTranslateAll}
                  disabled={translating || entries.length === 0}
                  size="sm"
                  className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500"
                >
                  {translating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Traduci Tutto
                </Button>
              </div>

              {translating && (
                <div className="mt-2 space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-xs text-center text-slate-400">{progress}%</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs + Virtualized entry list */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="bg-slate-900/50 border border-slate-800/50 shrink-0">
              <TabsTrigger value="all" className="text-xs">
                Tutte ({tabCounts.all})
              </TabsTrigger>
              <TabsTrigger value="smart" className="text-xs">
                <Braces className="h-3 w-3 mr-1" />
                Smart ({tabCounts.smart})
              </TabsTrigger>
              <TabsTrigger value="untranslated" className="text-xs">
                Da tradurre ({tabCounts.untranslated})
              </TabsTrigger>
              <TabsTrigger value="validated" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Validati ({tabCounts.validated})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="flex-1 min-h-0 mt-2">
              <div className="h-[calc(100vh-440px)] rounded-lg border border-slate-800/50 bg-slate-950/30 overflow-hidden">
                {filteredEntries.length > 0 ? (
                  <Virtuoso
                    data={filteredEntries}
                    overscan={200}
                    itemContent={(index, entry) => (
                      <EntryRow
                        key={entry.keyId}
                        entry={entry}
                        onChange={handleEntryChange}
                        validationIcon={validationIcon}
                      />
                    )}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-slate-500">
                    Nessun risultato trovato
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Bottom bar */}
          <Card variant="muted" className="shrink-0">
            <CardContent className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>
                    <span className="text-emerald-400 font-semibold">{stats.translated}</span>
                    /{entries.length} tradotte
                  </span>
                  {stats.valid > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      {stats.valid} valide
                    </span>
                  )}
                  {stats.warnings > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                      {stats.warnings} avvisi
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={handleValidateAll}
                    disabled={validating || stats.translated === 0}
                  >
                    {validating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Shield className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Valida Tutto
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 text-xs bg-cyan-600 hover:bg-cyan-500"
                    onClick={() => setStep(4)}
                    disabled={stats.translated === 0}
                  >
                    Esporta
                    <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 4: Export & Patch                                             */}
      {/* ================================================================= */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Summary */}
          <Card variant="muted">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Riepilogo Traduzione
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{stats.translated}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Entries tradotte</p>
                </div>
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
                  <p className="text-2xl font-bold text-cyan-400">{stats.valid}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Validate</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{stats.warnings}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Avvisi</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export options */}
          <Card variant="muted">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="h-4 w-4 text-cyan-400" />
                Opzioni di Esportazione
              </CardTitle>
              {loadedTable && (
                <CardDescription className="text-xs">
                  {loadedTable.tableName} &mdash; {getLocaleDisplayName(sourceLocale)} &rarr; {getLocaleDisplayName(targetLocale)}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  onClick={handleExportPatchedBundle}
                  disabled={exporting}
                  className="h-auto py-3 flex flex-col items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-xs"
                >
                  {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />}
                  <span className="font-medium">Bundle Patchato</span>
                  <span className="text-2xs text-cyan-200/70">Pronto per Unity</span>
                </Button>

                <Button
                  onClick={handleExportCSV}
                  disabled={exporting}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                >
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">Esporta CSV</span>
                  <span className="text-2xs text-slate-400">Foglio di calcolo</span>
                </Button>

                <Button
                  onClick={handleExportJSON}
                  disabled={exporting}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                >
                  <Braces className="h-5 w-5" />
                  <span className="font-medium">Esporta JSON</span>
                  <span className="text-2xs text-slate-400">Strutturato</span>
                </Button>

                <Button
                  onClick={handleCopyAll}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                >
                  {copiedFeedback ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                  <span className="font-medium">{copiedFeedback ? "Copiato!" : "Copia Tutto"}</span>
                  <span className="text-2xs text-slate-400">Negli appunti</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Export result */}
          {exportResult && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-emerald-400">Esportazione completata</p>
                    <p className="text-xs text-slate-400 font-mono truncate mt-0.5" title={exportResult}>
                      {exportResult}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Back button */}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setStep(3)}>
              <ArrowRight className="h-3.5 w-3.5 mr-1.5 rotate-180" />
              Torna all&apos;Editor
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntryRow — memoized row component for Virtuoso
// ---------------------------------------------------------------------------

import React from "react";

const EntryRow = React.memo(function EntryRow({
  entry,
  onChange,
  validationIcon,
}: {
  entry: StringTableEntry;
  onChange: (keyId: number, value: string) => void;
  validationIcon: (entry: StringTableEntry) => React.ReactNode;
}) {
  const isLong = entry.value.length > 80;

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
      {/* Key name + smart badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-mono truncate max-w-[280px]" title={entry.keyName}>
          {entry.keyName}
        </span>
        {entry.isSmart && (
          <Badge className="text-2xs px-1.5 py-0 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
            <Braces className="h-2.5 w-2.5 mr-0.5" />
            smart
          </Badge>
        )}
        <span className="ml-auto">{validationIcon(entry)}</span>
      </div>

      {/* Content: stacked for long text, side-by-side for short */}
      <div className={isLong ? "flex flex-col gap-1.5" : "flex items-start gap-3"}>
        {/* Original value */}
        <div className={`${isLong ? "w-full" : "flex-1"} min-w-0`}>
          <p className="text-xs text-slate-300 leading-relaxed break-words">
            {entry.isSmart ? renderSmartTokens(entry.value, entry.smartTokens) : entry.value}
          </p>
        </div>

        {/* Translation input */}
        <div className={`${isLong ? "w-full" : "flex-1"} min-w-0`}>
          <Input
            value={entry.translated ?? ""}
            onChange={(e) => onChange(entry.keyId, e.target.value)}
            placeholder="Traduzione..."
            className="h-8 text-xs bg-slate-950/50 border-slate-700/50 w-full"
          />
        </div>
      </div>

      {/* Validation errors */}
      {entry.validationErrors && entry.validationErrors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.validationErrors.map((err, i) => (
            <span key={i} className="text-2xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              {err}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Smart String renderer: literal text + token badges
// ---------------------------------------------------------------------------

function renderSmartTokens(
  value: string,
  tokens: { tokenType: string; raw: string; inner?: string }[]
): React.ReactNode {
  if (!tokens || tokens.length === 0) return value;

  const parts: React.ReactNode[] = [];
  let remaining = value;
  let keyIdx = 0;

  for (const token of tokens) {
    if (token.tokenType === "literal") continue; // skip literals, they're the surrounding text

    const idx = remaining.indexOf(token.raw);
    if (idx === -1) continue;

    if (idx > 0) {
      parts.push(<span key={`t-${keyIdx++}`}>{remaining.slice(0, idx)}</span>);
    }

    parts.push(
      <span
        key={`tk-${keyIdx++}`}
        className="inline-flex items-center bg-cyan-500/20 text-cyan-400 rounded px-1 font-mono text-2xs mx-0.5 align-middle"
        title={`${token.tokenType}: ${token.inner ?? token.raw}`}
      >
        {token.raw}
      </span>
    );

    remaining = remaining.slice(idx + token.raw.length);
  }

  if (remaining) {
    parts.push(<span key={`t-${keyIdx}`}>{remaining}</span>);
  }

  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// File download helper
// ---------------------------------------------------------------------------

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
