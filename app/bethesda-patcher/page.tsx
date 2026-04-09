'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import React from 'react'
import { Virtuoso } from 'react-virtuoso'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FolderOpen, Globe, Languages, CheckCircle2, XCircle, AlertCircle,
  Loader2, Download, ArrowRight, Sparkles, Search, FileText,
  BookOpen, Shield, RefreshCw, Copy, ChevronRight, Package,
  Swords, ScrollText, Users, MessageSquare, Archive,
} from 'lucide-react'
import { clientLogger } from '@/lib/client-logger';
import {
  type BethesdaGameInfo,
  type PluginInfo,
  type StringTableFile,
  type StringEntry,
  type PluginStringEntry,
  type PatchedStringEntry,
  BETHESDA_LANGUAGES,
  RECORD_TYPE_LABELS,
  detectBethesdaGame,
  extractStringsFile,
  extractPluginStrings,
  buildPatchedStrings,
  translateStringEntries,
  translatePluginEntries,
  exportStringsToCSV,
  exportPluginStringsToCSV,
  exportStringsToPO,
  exportPluginStringsToPO,
  importStringsFromCSV,
  importStringsFromPO,
  getLanguageDisplayName,
  getRecordTypeLabel,
  formatFileSize,
  formatFormId,
} from '@/lib/bethesda-patcher'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const WIZARD_STEPS = [
  { num: 1, label: 'Gioco' },
  { num: 2, label: 'Plugin' },
  { num: 3, label: 'Traduzioni' },
  { num: 4, label: 'Esporta' },
] as const

const RECORD_TYPE_ICONS: Record<string, typeof Swords> = {
  BOOK: BookOpen,
  NPC_: Users,
  QUST: ScrollText,
  DIAL: MessageSquare,
  INFO: MessageSquare,
  WEAP: Swords,
}

const ALL_LANGUAGE_KEYS = Object.keys(BETHESDA_LANGUAGES)

type EditorMode = 'strings' | 'plugin'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BethesdaPatcherPage() {
  // Wizard state
  const [step, setStep] = useState(1)
  const [folderPath, setFolderPath] = useState('')
  const [gameInfo, setGameInfo] = useState<BethesdaGameInfo | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  // Step 2: Plugin selection
  const [selectedPlugins, setSelectedPlugins] = useState<Set<string>>(new Set())
  const [selectedStringTable, setSelectedStringTable] = useState<StringTableFile | null>(null)

  // Step 3: Editor state
  const [editorMode, setEditorMode] = useState<EditorMode>('strings')
  const [stringEntries, setStringEntries] = useState<StringEntry[]>([])
  const [pluginEntries, setPluginEntries] = useState<PluginStringEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [searchFilter, setSearchFilter] = useState('')
  const [recordTypeFilter, setRecordTypeFilter] = useState('all')
  const [sourceLanguage, setSourceLanguage] = useState('English')
  const [targetLanguage, setTargetLanguage] = useState('Italian')

  // Step 4: Export
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState('')
  const [copiedFeedback, setCopiedFeedback] = useState(false)

  // Load settings
  useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem('gameStringerSettings')
      if (saved) {
        try {
          const s = JSON.parse(saved)
          if (s.translation?.defaultTargetLang) {
            // Map locale code to Bethesda language name
            const langMap: Record<string, string> = { it: 'Italian', fr: 'French', de: 'German', es: 'Spanish' }
            const lang = langMap[s.translation.defaultTargetLang]
            if (lang) setTargetLanguage(lang)
          }
        } catch { /* ignore */ }
      }
    }
    loadSettings()
    window.addEventListener('focus', loadSettings)
    return () => window.removeEventListener('focus', loadSettings)
  }, [])

  // -----------------------------------------------------------------------
  // Step 1: Game selection & detection
  // -----------------------------------------------------------------------

  const handleSelectFolder = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Seleziona cartella gioco Bethesda',
      })
      if (selected) {
        setFolderPath(selected as string)
        setGameInfo(null)
        setStringEntries([])
        setPluginEntries([])
        setError('')
        setStep(1)
      }
    } catch (e: unknown) {
      clientLogger.error('Errore selezione cartella:', e)
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!folderPath) return
    setAnalyzing(true)
    setError('')

    try {
      const info = await detectBethesdaGame(folderPath)
      setGameInfo(info)
      // Auto-select all masters
      const masters = new Set(
        info.plugins.filter((p) => p.is_master).map((p) => p.filename),
      )
      setSelectedPlugins(masters)

      if (info.plugins.length > 0 || info.string_tables.length > 0) {
        setStep(2)
      } else {
        setError('Nessun plugin o string table trovato nella cartella selezionata.')
      }
    } catch (e: unknown) {
      setError(`Errore analisi: ${e}`)
    } finally {
      setAnalyzing(false)
    }
  }, [folderPath])

  // -----------------------------------------------------------------------
  // Step 2: Plugin overview
  // -----------------------------------------------------------------------

  const togglePlugin = useCallback((filename: string) => {
    setSelectedPlugins((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) {
        next.delete(filename)
      } else {
        next.add(filename)
      }
      return next
    })
  }, [])

  const availableLanguages = useMemo(() => {
    if (!gameInfo) return []
    const langs = new Set(gameInfo.string_tables.map((t) => t.language))
    return Array.from(langs)
  }, [gameInfo])

  const stringTablesByPlugin = useMemo(() => {
    if (!gameInfo) return new Map<string, StringTableFile[]>()
    const map = new Map<string, StringTableFile[]>()
    for (const st of gameInfo.string_tables) {
      const existing = map.get(st.plugin_name) ?? []
      existing.push(st)
      map.set(st.plugin_name, existing)
    }
    return map
  }, [gameInfo])

  const handleLoadStringTable = useCallback(async (st: StringTableFile) => {
    setLoading(true)
    setError('')
    setSelectedStringTable(st)

    try {
      const entries = await extractStringsFile(st.path)
      setStringEntries(entries.map((e) => ({ ...e })))
      setPluginEntries([])
      setEditorMode('strings')
      setStep(3)
    } catch (e: unknown) {
      setError(`Errore caricamento string table: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLoadPluginStrings = useCallback(async (plugin: PluginInfo) => {
    if (!gameInfo) return
    setLoading(true)
    setError('')

    try {
      const pluginPath = `${gameInfo.data_path}/${plugin.filename}`
      const entries = await extractPluginStrings(pluginPath)
      setPluginEntries(entries.map((e) => ({ ...e })))
      setStringEntries([])
      setEditorMode('plugin')
      setStep(3)
    } catch (e: unknown) {
      setError(`Errore estrazione stringhe plugin: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [gameInfo])

  // -----------------------------------------------------------------------
  // Step 3: Translation editor
  // -----------------------------------------------------------------------

  const handleTranslateAll = useCallback(async () => {
    setTranslating(true)
    setProgress(0)
    setError('')

    try {
      if (editorMode === 'strings') {
        const result = await translateStringEntries(stringEntries, {
          sourceLanguage,
          targetLanguage,
          batchSize: 20,
          context: `Bethesda game (${gameInfo?.game_name ?? ''}) string table translation`,
        })
        setStringEntries(result)
      } else {
        const result = await translatePluginEntries(pluginEntries, {
          sourceLanguage,
          targetLanguage,
          batchSize: 20,
          context: `Bethesda game (${gameInfo?.game_name ?? ''}) plugin translation`,
        })
        setPluginEntries(result)
      }
      setProgress(100)
    } catch (e: unknown) {
      setError(`Errore traduzione: ${e}`)
    } finally {
      setTranslating(false)
    }
  }, [editorMode, stringEntries, pluginEntries, sourceLanguage, targetLanguage, gameInfo])

  const handleStringEntryChange = useCallback((id: number, value: string) => {
    setStringEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, translated: value, translationStatus: 'pending' as const } : e,
      ),
    )
  }, [])

  const handlePluginEntryChange = useCallback((formId: number, fieldName: string, value: string) => {
    setPluginEntries((prev) =>
      prev.map((e) =>
        e.form_id === formId && e.field_name === fieldName
          ? { ...e, translated: value, translationStatus: 'pending' as const }
          : e,
      ),
    )
  }, [])

  // --- Filtering & stats ---

  const recordTypes = useMemo(() => {
    const types = new Set(pluginEntries.map((e) => e.record_type))
    return Array.from(types).sort()
  }, [pluginEntries])

  const stats = useMemo(() => {
    const items = editorMode === 'strings' ? stringEntries : pluginEntries
    let translated = 0
    let errors = 0
    for (const e of items) {
      if (e.translated) translated++
      if (e.translationStatus === 'error') errors++
    }
    return { total: items.length, translated, errors }
  }, [editorMode, stringEntries, pluginEntries])

  const filteredStringEntries = useMemo(() => {
    let filtered = stringEntries
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.value.toLowerCase().includes(q) ||
          String(e.id).includes(q) ||
          (e.translated && e.translated.toLowerCase().includes(q)),
      )
    }
    return filtered
  }, [stringEntries, searchFilter])

  const filteredPluginEntries = useMemo(() => {
    let filtered = pluginEntries
    if (recordTypeFilter !== 'all') {
      filtered = filtered.filter((e) => e.record_type === recordTypeFilter)
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.value.toLowerCase().includes(q) ||
          e.editor_id.toLowerCase().includes(q) ||
          e.record_type.toLowerCase().includes(q) ||
          (e.translated && e.translated.toLowerCase().includes(q)),
      )
    }
    return filtered
  }, [pluginEntries, recordTypeFilter, searchFilter])

  // -----------------------------------------------------------------------
  // Step 4: Export
  // -----------------------------------------------------------------------

  const handleExportStringsFile = useCallback(async () => {
    if (editorMode !== 'strings' || stringEntries.length === 0) return
    setExporting(true)
    setError('')

    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const outputPath = await save({
        title: 'Salva file STRINGS patchato',
        filters: [{ name: 'String Table', extensions: ['STRINGS', 'DLSTRINGS', 'ILSTRINGS'] }],
      })
      if (!outputPath) {
        setExporting(false)
        return
      }

      const ext = outputPath.split('.').pop()?.toLowerCase() ?? 'strings'
      const format = ['strings', 'dlstrings', 'ilstrings'].includes(ext) ? ext : 'strings'

      const patchedEntries: PatchedStringEntry[] = stringEntries
        .filter((e) => e.translated)
        .map((e) => ({ id: e.id, value: e.translated! }))

      // Include untranslated entries with original values
      const untranslated: PatchedStringEntry[] = stringEntries
        .filter((e) => !e.translated)
        .map((e) => ({ id: e.id, value: e.value }))

      const allEntries = [...patchedEntries, ...untranslated]
      const result = await buildPatchedStrings(allEntries, outputPath, format)
      setExportResult(result)
      setStep(4)
    } catch (e: unknown) {
      setError(`Errore esportazione: ${e}`)
    } finally {
      setExporting(false)
    }
  }, [editorMode, stringEntries])

  const handleExportCSV = useCallback(() => {
    if (editorMode === 'strings') {
      const csv = exportStringsToCSV(stringEntries)
      const name = selectedStringTable?.plugin_name ?? 'bethesda'
      downloadFile(csv, `${name}_${targetLanguage}.csv`, 'text/csv')
      setExportResult(`CSV esportato: ${name}_${targetLanguage}.csv`)
    } else {
      const csv = exportPluginStringsToCSV(pluginEntries)
      downloadFile(csv, `plugin_${targetLanguage}.csv`, 'text/csv')
      setExportResult(`CSV esportato: plugin_${targetLanguage}.csv`)
    }
    setStep(4)
  }, [editorMode, stringEntries, pluginEntries, selectedStringTable, targetLanguage])

  const handleExportPO = useCallback(() => {
    const pluginName = selectedStringTable?.plugin_name ?? gameInfo?.game_name ?? 'bethesda'
    if (editorMode === 'strings') {
      const po = exportStringsToPO(stringEntries, pluginName, targetLanguage)
      downloadFile(po, `${pluginName}_${targetLanguage}.po`, 'text/x-gettext-translation')
      setExportResult(`PO esportato: ${pluginName}_${targetLanguage}.po`)
    } else {
      const po = exportPluginStringsToPO(pluginEntries, pluginName, targetLanguage)
      downloadFile(po, `${pluginName}_plugin_${targetLanguage}.po`, 'text/x-gettext-translation')
      setExportResult(`PO esportato: ${pluginName}_plugin_${targetLanguage}.po`)
    }
    setStep(4)
  }, [editorMode, stringEntries, pluginEntries, selectedStringTable, gameInfo, targetLanguage])

  const handleCopyAll = useCallback(async () => {
    const text =
      editorMode === 'strings'
        ? stringEntries.map((e) => `${e.id}\t${e.value}\t${e.translated ?? ''}`).join('\n')
        : pluginEntries
            .map(
              (e) =>
                `${formatFormId(e.form_id)}\t${e.record_type}\t${e.field_name}\t${e.value}\t${e.translated ?? ''}`,
            )
            .join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedFeedback(true)
    setTimeout(() => setCopiedFeedback(false), 2000)
  }, [editorMode, stringEntries, pluginEntries])

  const handleImportCSV = useCallback(async () => {
    try {
      const { open: openFile } = await import('@tauri-apps/plugin-dialog')
      const selected = await openFile({
        title: 'Importa traduzioni da CSV',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (!selected) return
      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      const csv = await readTextFile(selected as string)
      if (editorMode === 'strings') {
        setStringEntries(importStringsFromCSV(csv, stringEntries))
      }
    } catch (e: unknown) {
      setError(`Errore importazione CSV: ${e}`)
    }
  }, [editorMode, stringEntries])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-4 overflow-y-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-indigo-900 to-purple-900 p-4 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                Bethesda Engine Patcher
              </h1>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                Skyrim, Fallout 4, Starfield, Oblivion, Fallout 3/NV
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Archive className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">BSA</span>
              <span className="text-xs text-white/70">/BA2</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Languages className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white">ESP</span>
              <span className="text-xs text-white/70">/ESM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 shrink-0">
          <XCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-300">
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center justify-center gap-1 py-2 shrink-0">
        {WIZARD_STEPS.map((s, idx) => (
          <div key={s.num} className="flex items-center">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${
                step >= s.num
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
              } ${s.num < step ? 'cursor-pointer hover:bg-cyan-500' : s.num > step ? 'cursor-default' : ''}`}
              onClick={() => { if (s.num < step) setStep(s.num) }}
              tabIndex={s.num < step ? 0 : -1}
              aria-label={`Passo ${s.num}: ${s.label}`}
            >
              <span className="font-bold">{s.num}</span>
              <span>{s.label}</span>
            </button>
            {idx < WIZARD_STEPS.length - 1 && <ArrowRight className="h-3 w-3 mx-1 text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ================================================================= */}
      {/* STEP 1: Game Selection                                            */}
      {/* ================================================================= */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                icon: Archive,
                title: 'Archivi BSA/BA2',
                desc: 'Analisi e estrazione da archivi BSA (Skyrim, Oblivion) e BA2 (Fallout 4, Starfield) con decompressione zlib/LZ4.',
              },
              {
                icon: ScrollText,
                title: 'String Table',
                desc: 'Parsing completo di STRINGS, DLSTRINGS e ILSTRINGS con supporto per tutte le lingue Bethesda.',
              },
              {
                icon: FileText,
                title: 'Plugin ESP/ESM',
                desc: 'Estrazione stringhe traducibili da plugin con riconoscimento record type (BOOK, NPC_, QUST, INFO, ecc).',
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
                Seleziona Cartella Gioco
              </CardTitle>
              <CardDescription className="text-xs">
                Scegli la cartella principale del gioco Bethesda (contenente la cartella Data)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex gap-2">
                <Button onClick={handleSelectFolder} variant="outline" size="sm" className="h-9 text-xs">
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                  Sfoglia...
                </Button>
                <Button
                  onClick={handleAnalyze}
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

              {gameInfo && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-emerald-400">{gameInfo.game_name}</p>
                    <p className="text-2xs text-slate-400">
                      {gameInfo.plugins.length} plugin, {gameInfo.string_tables.length} string table, {gameInfo.bsa_files.length} archivi
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: Plugin Overview                                           */}
      {/* ================================================================= */}
      {step === 2 && gameInfo && (
        <div className="space-y-4">
          {/* Game info + language selectors */}
          <Card variant="muted">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-cyan-400" />
                {gameInfo.game_name}
                <Badge variant="outline" className="ml-auto text-xs">{gameInfo.game_type}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Language badges */}
              {availableLanguages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {availableLanguages.map((lang) => (
                    <Badge
                      key={lang}
                      className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30"
                    >
                      {getLanguageDisplayName(lang)} ({lang})
                    </Badge>
                  ))}
                </div>
              )}

              {/* Source / Target selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Lingua sorgente
                  </label>
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger className="h-9 text-xs bg-slate-950/50 border-slate-700/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_LANGUAGE_KEYS.map((lang) => (
                        <SelectItem key={lang} value={lang} className="text-xs">
                          {getLanguageDisplayName(lang)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Lingua target
                  </label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger className="h-9 text-xs bg-slate-950/50 border-slate-700/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_LANGUAGE_KEYS.map((lang) => (
                        <SelectItem key={lang} value={lang} className="text-xs">
                          {getLanguageDisplayName(lang)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* String Tables */}
          {gameInfo.string_tables.length > 0 && (
            <Card variant="muted">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-cyan-400" />
                    String Table ({gameInfo.string_tables.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {Array.from(stringTablesByPlugin.entries()).map(([pluginName, tables]) => (
                    <div key={pluginName} className="space-y-1">
                      <p className="text-xs font-medium text-slate-300 px-1">{pluginName}</p>
                      {tables
                        .filter((t) => t.language.toLowerCase() === sourceLanguage.toLowerCase())
                        .map((table) => (
                          <button
                            key={table.path}
                            onClick={() => handleLoadStringTable(table)}
                            disabled={loading}
                            className="group w-full text-left p-2.5 rounded-lg border transition-all hover:bg-slate-800/50 border-slate-800/30 hover:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                            aria-label={`Carica ${table.table_type} per ${pluginName}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-cyan-400" />
                                <span className="text-xs text-slate-200">
                                  .{table.table_type.toUpperCase()}
                                </span>
                                <Badge variant="outline" className="text-2xs px-1.5 py-0">
                                  {table.language}
                                </Badge>
                              </div>
                              {loading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400" />
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Plugins */}
          <Card variant="muted">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-cyan-400" />
                  Plugin ({gameInfo.plugins.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Ricarica</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {gameInfo.plugins.map((plugin) => (
                  <button
                    key={plugin.filename}
                    onClick={() => handleLoadPluginStrings(plugin)}
                    disabled={loading}
                    className="group w-full text-left p-2.5 rounded-lg border transition-all hover:bg-slate-800/50 border-slate-800/30 hover:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                    aria-label={`Carica stringhe da ${plugin.filename}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-xs font-medium text-slate-200">{plugin.filename}</span>
                      </div>
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-2xs px-1.5 py-0">
                        {plugin.is_master ? 'ESM' : 'ESP'}
                      </Badge>
                      {plugin.is_localized && (
                        <Badge className="text-2xs px-1.5 py-0 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                          <Globe className="h-2.5 w-2.5 mr-0.5" />
                          Localizzato
                        </Badge>
                      )}
                      <span className="text-2xs text-slate-500 ml-auto">
                        {formatFileSize(plugin.size)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: Translation Editor                                        */}
      {/* ================================================================= */}
      {step === 3 && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Top bar */}
          <Card variant="muted" className="shrink-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {editorMode === 'strings' ? (
                    <ScrollText className="h-4 w-4 text-cyan-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-cyan-400" />
                  )}
                  <span className="text-sm font-semibold text-slate-200">
                    {editorMode === 'strings'
                      ? `${selectedStringTable?.plugin_name ?? ''} (${selectedStringTable?.table_type.toUpperCase() ?? ''})`
                      : 'Plugin Strings'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge className="text-xs bg-slate-700/50 text-slate-300">
                    {sourceLanguage}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <Badge className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                    {targetLanguage}
                  </Badge>
                </div>

                {editorMode === 'plugin' && (
                  <Select value={recordTypeFilter} onValueChange={setRecordTypeFilter}>
                    <SelectTrigger className="h-8 w-[140px] text-xs bg-slate-950/50 border-slate-700/50">
                      <SelectValue placeholder="Tipo record" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Tutti i tipi</SelectItem>
                      {recordTypes.map((rt) => (
                        <SelectItem key={rt} value={rt} className="text-xs">
                          {getRecordTypeLabel(rt)} ({rt})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="relative ml-auto flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    aria-label="Cerca stringhe"
                    placeholder="Cerca..."
                    className="h-8 text-xs pl-8 bg-slate-950/50 border-slate-700/50"
                  />
                </div>

                <Button
                  onClick={handleTranslateAll}
                  disabled={translating || stats.total === 0}
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500"
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

          {/* Virtualized entry list */}
          <div className="flex-1 min-h-0 rounded-lg border border-slate-800/50 bg-slate-950/30 overflow-hidden">
            {editorMode === 'strings' ? (
              filteredStringEntries.length > 0 ? (
                <Virtuoso
                  data={filteredStringEntries}
                  overscan={200}
                  itemContent={(_index, entry) => (
                    <StringEntryRow
                      key={entry.id}
                      entry={entry}
                      onChange={handleStringEntryChange}
                    />
                  )}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                  Nessun risultato trovato
                </div>
              )
            ) : filteredPluginEntries.length > 0 ? (
              <Virtuoso
                data={filteredPluginEntries}
                overscan={200}
                itemContent={(_index, entry) => (
                  <PluginEntryRow
                    key={`${entry.form_id}-${entry.field_name}`}
                    entry={entry}
                    onChange={handlePluginEntryChange}
                  />
                )}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-500">
                Nessun risultato trovato
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <Card variant="muted" className="shrink-0">
            <CardContent className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>
                    <span className="text-emerald-400 font-semibold">{stats.translated}</span>
                    /{stats.total} tradotte
                  </span>
                  {stats.errors > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                      {stats.errors} errori
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleImportCSV}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5 rotate-180" />
                    Importa CSV
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500"
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
                  <p className="text-xs text-slate-400 mt-0.5">Tradotte</p>
                </div>
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
                  <p className="text-2xl font-bold text-cyan-400">{stats.total}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Totali</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{stats.errors}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Errori</p>
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
              <CardDescription className="text-xs">
                {gameInfo?.game_name ?? 'Bethesda'} &mdash; {sourceLanguage} &rarr; {targetLanguage}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {editorMode === 'strings' && (
                  <Button
                    onClick={handleExportStringsFile}
                    disabled={exporting}
                    className="h-auto py-3 flex flex-col items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-xs"
                  >
                    {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />}
                    <span className="font-medium">File STRINGS</span>
                    <span className="text-2xs text-cyan-200/70">Patch diretto</span>
                  </Button>
                )}

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
                  onClick={handleExportPO}
                  disabled={exporting}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                >
                  <Globe className="h-5 w-5" />
                  <span className="font-medium">Esporta PO</span>
                  <span className="text-2xs text-slate-400">Gettext</span>
                </Button>

                <Button
                  onClick={handleCopyAll}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-xs"
                >
                  {copiedFeedback ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                  <span className="font-medium">{copiedFeedback ? 'Copiato!' : 'Copia Tutto'}</span>
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
  )
}

// ---------------------------------------------------------------------------
// StringEntryRow — memoized row for Virtuoso (strings mode)
// ---------------------------------------------------------------------------

const StringEntryRow = React.memo(function StringEntryRow({
  entry,
  onChange,
}: {
  entry: StringEntry
  onChange: (id: number, value: string) => void
}) {
  const isLong = entry.value.length > 80

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
      {/* ID + status */}
      <div className="flex items-center gap-2">
        <span className="text-2xs text-slate-500 font-mono">
          ID: {entry.id}
        </span>
        {entry.translationStatus === 'translated' && (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        )}
        {entry.translationStatus === 'error' && (
          <XCircle className="h-3 w-3 text-red-400" />
        )}
      </div>

      {/* Content */}
      <div className={isLong ? 'flex flex-col gap-1.5' : 'flex items-start gap-3'}>
        <div className={`${isLong ? 'w-full' : 'flex-1'} min-w-0`}>
          <p className="text-xs text-slate-300 leading-relaxed break-words">{entry.value}</p>
        </div>
        <div className={`${isLong ? 'w-full' : 'flex-1'} min-w-0`}>
          <Input
            value={entry.translated ?? ''}
            onChange={(e) => onChange(entry.id, e.target.value)}
            placeholder="Traduzione..."
            className="h-8 text-xs bg-slate-950/50 border-slate-700/50 w-full"
            aria-label={`Traduzione per ID ${entry.id}`}
          />
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// PluginEntryRow — memoized row for Virtuoso (plugin mode)
// ---------------------------------------------------------------------------

const PluginEntryRow = React.memo(function PluginEntryRow({
  entry,
  onChange,
}: {
  entry: PluginStringEntry
  onChange: (formId: number, fieldName: string, value: string) => void
}) {
  const isLong = entry.value.length > 80
  const RecordIcon = RECORD_TYPE_ICONS[entry.record_type] ?? FileText

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
      {/* Header: record type + form ID + editor ID */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="text-2xs px-1.5 py-0 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
          <RecordIcon className="h-2.5 w-2.5 mr-0.5" />
          {entry.record_type}
        </Badge>
        <Badge variant="outline" className="text-2xs px-1.5 py-0">
          {entry.field_name}
        </Badge>
        <span className="text-2xs text-slate-500 font-mono">
          {formatFormId(entry.form_id)}
        </span>
        {entry.editor_id && (
          <span className="text-2xs text-slate-500 truncate max-w-[200px]" title={entry.editor_id}>
            {entry.editor_id}
          </span>
        )}
        {entry.translationStatus === 'translated' && (
          <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-auto" />
        )}
        {entry.translationStatus === 'error' && (
          <XCircle className="h-3 w-3 text-red-400 ml-auto" />
        )}
      </div>

      {/* Content */}
      <div className={isLong ? 'flex flex-col gap-1.5' : 'flex items-start gap-3'}>
        <div className={`${isLong ? 'w-full' : 'flex-1'} min-w-0`}>
          <p className="text-xs text-slate-300 leading-relaxed break-words">{entry.value}</p>
        </div>
        <div className={`${isLong ? 'w-full' : 'flex-1'} min-w-0`}>
          <Input
            value={entry.translated ?? ''}
            onChange={(e) => onChange(entry.form_id, entry.field_name, e.target.value)}
            placeholder="Traduzione..."
            className="h-8 text-xs bg-slate-950/50 border-slate-700/50 w-full"
            aria-label={`Traduzione per ${entry.record_type} ${formatFormId(entry.form_id)}`}
          />
        </div>
      </div>
    </div>
  )
})
