"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Rocket,
  Upload,
  Languages,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Package,
  Download,
  Eye,
  Edit3,
  ChevronRight,
  ChevronLeft,
  FileText,
  FolderOpen,
  Sparkles,
  Shield,
  Wrench,
  BarChart3,
  ArrowRight,
  Save,
  RefreshCw,
  Info,
  Zap,
  Target,
  Clock,
  Gamepad2,
  Search,
  ArrowLeft,
  RotateCcw,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { invoke } from "@/lib/tauri-api"
import { detectFormat, parseFile, type ParseResult, type ParsedString } from "@/lib/file-parsers"
import { translateSmart } from "@/lib/ai-translate-direct"
import { runQualityGates, type QualityReport } from "@/lib/quality-gates"
import { harvestBatch, type HarvestInput } from "@/lib/context-harvester"
import { addCorrection } from "@/lib/adaptive-mt"
import {
  generatePatch,
  generateZipBlob,
  downloadBlob,
  type PatchInput,
  type PatchResult,
} from "@/lib/patch-generator"

// ============================================================================
// TYPES
// ============================================================================

type WizardStep = 'select_game' | 'translating' | 'review' | 'patch'

interface GameInfo {
  gameId: string
  gameName: string
  installPath: string
  gameImage?: string
  platform?: string
}

interface LoadedFile {
  name: string
  content: string
  format: string
  parsed: ParseResult
  size: number
}

interface TranslatedString {
  key: string
  original: string
  translation: string
  qaScore: number
  qaPassed: boolean
  qaReport?: QualityReport
  isEdited: boolean
  editedTranslation?: string
}

interface TranslationProgress {
  currentFile: number
  totalFiles: number
  currentBatch: number
  totalBatches: number
  translatedStrings: number
  totalStrings: number
  currentStep: string
  percent: number
  startTime: number
  errors: string[]
}

// ============================================================================
// LANGUAGE OPTIONS
// ============================================================================

const LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'pt-br', name: 'Português (BR)', flag: '🇧🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文 (简)', flag: '🇨🇳' },
  { code: 'zh-tw', name: '中文 (繁)', flag: '🇹🇼' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function AutoTranslatePage() {
  const searchParams = useSearchParams()

  // Game info (da URL params o selezione manuale)
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null)
  const [isLoadingGame, setIsLoadingGame] = useState(false)
  const [gameError, setGameError] = useState<string | null>(null)

  // Wizard state
  const [step, setStep] = useState<WizardStep>('select_game')
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('it')
  const [translator, setTranslator] = useState('')
  const [patchVersion, setPatchVersion] = useState('1.0')
  const [useContextHarvest, setUseContextHarvest] = useState(true)

  // Translation state
  const [translatedStrings, setTranslatedStrings] = useState<Map<string, TranslatedString[]>>(new Map())
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const abortRef = useRef(false)
  const [stoppedByUser, setStoppedByUser] = useState(false)

  // Review state
  const [reviewFilter, setReviewFilter] = useState<'all' | 'issues' | 'edited' | 'untranslated'>('issues')
  const [isRetranslating, setIsRetranslating] = useState(false)
  const [retranslateProgress, setRetranslateProgress] = useState<{ done: number; total: number } | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Patch state
  const [patchResult, setPatchResult] = useState<PatchResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Test Patch state
  const [testPatchStatus, setTestPatchStatus] = useState<'idle' | 'backing_up' | 'applying' | 'launching' | 'monitoring' | 'restoring' | 'done' | 'error'>('idle')
  const [testPatchLogs, setTestPatchLogs] = useState<string[]>([])
  const [testBackupPaths, setTestBackupPaths] = useState<Map<string, string>>(new Map())
  const [testPatchApplied, setTestPatchApplied] = useState(false)
  const testMonitorRef = useRef<NodeJS.Timeout | null>(null)

  // File upload fallback
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Checkpoint/resume state
  const [savedCheckpoint, setSavedCheckpoint] = useState<{ translatedStrings: Map<string, TranslatedString[]>; translatedCount: number; totalCount: number; savedAt: number; targetLang: string } | null>(null)

  const totalStrings = files.reduce((sum, f) => sum + f.parsed.strings.length, 0)

  // ============================================================================
  // CHECKPOINT: SAVE / LOAD / CLEAR
  // ============================================================================

  const getCheckpointKey = useCallback(() => {
    if (!gameInfo?.gameId) return null
    return `gs_translation_checkpoint_${gameInfo.gameId}_${targetLang}`
  }, [gameInfo?.gameId, targetLang])

  const saveCheckpoint = useCallback((translated: Map<string, TranslatedString[]>) => {
    const key = getCheckpointKey()
    if (!key) return
    try {
      const data: Record<string, TranslatedString[]> = {}
      translated.forEach((v, k) => { data[k] = v })
      const totalDone = Object.values(data).reduce((s, arr) => s + arr.filter(t => t.translation).length, 0)
      localStorage.setItem(key, JSON.stringify({
        data,
        gameId: gameInfo?.gameId,
        gameName: gameInfo?.gameName,
        targetLang,
        sourceLang,
        totalCount: totalStrings,
        translatedCount: totalDone,
        savedAt: Date.now(),
      }))
      console.log(`[Checkpoint] Salvato: ${totalDone} stringhe tradotte`)
    } catch (e) {
      console.warn('[Checkpoint] Errore salvataggio:', e)
    }
  }, [getCheckpointKey, gameInfo, targetLang, sourceLang, totalStrings])

  const loadCheckpoint = useCallback((): Map<string, TranslatedString[]> | null => {
    const key = getCheckpointKey()
    if (!key) return null
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const saved = JSON.parse(raw)
      if (!saved?.data) return null
      const map = new Map<string, TranslatedString[]>()
      for (const [k, v] of Object.entries(saved.data)) {
        map.set(k, v as TranslatedString[])
      }
      return map
    } catch { return null }
  }, [getCheckpointKey])

  const clearCheckpoint = useCallback(() => {
    const key = getCheckpointKey()
    if (key) localStorage.removeItem(key)
    setSavedCheckpoint(null)
  }, [getCheckpointKey])

  // ============================================================================
  // AUTO-LOAD GAME FROM URL PARAMS (dalla libreria)
  // ============================================================================

  useEffect(() => {
    const gameId = searchParams.get('gameId')
    const gameName = searchParams.get('gameName')
    const installPath = searchParams.get('installPath')
    const gameImage = searchParams.get('gameImage')
    const platform = searchParams.get('platform')

    if (gameId && gameName && installPath) {
      setGameInfo({
        gameId,
        gameName: decodeURIComponent(gameName),
        installPath: decodeURIComponent(installPath),
        gameImage: gameImage ? decodeURIComponent(gameImage) : undefined,
        platform: platform ? decodeURIComponent(platform) : undefined,
      })
      // Auto-scan file del gioco
      scanGameFiles(decodeURIComponent(installPath))
    }
  }, [searchParams])

  // Controlla se esiste un checkpoint salvato quando cambia gameInfo o targetLang
  useEffect(() => {
    if (!gameInfo?.gameId) return
    const key = `gs_translation_checkpoint_${gameInfo.gameId}_${targetLang}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved?.data && saved.translatedCount > 0) {
          const map = new Map<string, TranslatedString[]>()
          for (const [k, v] of Object.entries(saved.data)) map.set(k, v as TranslatedString[])
          setSavedCheckpoint({
            translatedStrings: map,
            translatedCount: saved.translatedCount,
            totalCount: saved.totalCount,
            savedAt: saved.savedAt,
            targetLang: saved.targetLang,
          })
        }
      } else {
        setSavedCheckpoint(null)
      }
    } catch { setSavedCheckpoint(null) }
  }, [gameInfo?.gameId, targetLang])

  // Cleanup test monitor on unmount
  useEffect(() => {
    return () => {
      if (testMonitorRef.current) { clearInterval(testMonitorRef.current); testMonitorRef.current = null }
    }
  }, [])

  // ============================================================================
  // SCAN FILE DAL PATH DEL GIOCO (via Tauri)
  // ============================================================================

  const scanGameFiles = useCallback(async (installPath: string) => {
    setIsLoadingGame(true)
    setGameError(null)
    setFiles([])

    try {
      // Step 1: scan_translatable_files (walkdir ricorsivo con estensioni note)
      console.log('[AutoTranslate] Scanning:', installPath)
      let locFiles: string[] = []
      try {
        locFiles = await invoke<string[]>('scan_translatable_files', { gamePath: installPath })
        console.log('[AutoTranslate] scan_translatable_files result:', locFiles?.length, 'files')
      } catch (e1) {
        console.warn('[AutoTranslate] scan_translatable_files failed:', e1)
        // Prova con snake_case (fallback per comandi senza rename_all)
        try {
          locFiles = await invoke<string[]>('scan_translatable_files', { game_path: installPath })
          console.log('[AutoTranslate] scan_translatable_files (snake) result:', locFiles?.length, 'files')
        } catch (e2) {
          console.warn('[AutoTranslate] scan_translatable_files (snake) also failed:', e2)
        }
      }

      if (!locFiles || locFiles.length === 0) {
        // Step 2: fallback scan_localization_files
        console.log('[AutoTranslate] No files from scan_translatable_files, trying scan_localization_files...')
        const fallbackExts = ['json', 'csv', 'po', 'pot', 'xlf', 'resx', 'strings', 'ini', 'xml', 'properties', 'yaml', 'yml', 'txt', 'lua', 'rpy', 'cfg', 'lang', 'loc']
        let allFiles: string[] = []
        try {
          const scanned = await invoke<{ path: string; name: string; size: number; extension: string }[]>(
            'scan_localization_files', { path: installPath, extensions: fallbackExts, maxDepth: 5 }
          )
          console.log('[AutoTranslate] scan_localization_files result:', scanned?.length, 'files')
          allFiles = (scanned || []).map(f => f.path)
        } catch (e3) {
          console.warn('[AutoTranslate] scan_localization_files failed:', e3)
          // Ultimo fallback: sottocartelle comuni
          for (const subdir of ['localization', 'lang', 'languages', 'data', 'text', 'strings', 'www/data', 'game/tl']) {
            try {
              const subScanned = await invoke<{ path: string; name: string; size: number; extension: string }[]>(
                'scan_localization_files', { path: `${installPath}\\${subdir}`, extensions: fallbackExts, maxDepth: 3 }
              )
              if (subScanned?.length > 0) allFiles.push(...subScanned.map(f => f.path))
            } catch {}
          }
        }

        if (allFiles.length === 0) {
          setGameError('Nessun file traducibile trovato. Puoi caricare i file manualmente.')
          setIsLoadingGame(false)
          return
        }

        await loadFilesFromPaths(allFiles, installPath)
      } else {
        await loadFilesFromPaths(locFiles, installPath)
      }
    } catch (err) {
      console.error('[AutoTranslate] Scan TOTALMENTE fallito:', err)
      setGameError(`Scansione automatica fallita: ${err instanceof Error ? err.message : String(err)}. Puoi caricare i file manualmente.`)
    } finally {
      setIsLoadingGame(false)
    }
  }, [])

  const loadFilesFromPaths = async (filePaths: string[], basePath: string) => {
    // Filtra solo file veramente inutili (Manifest UE engine, log, ecc.)
    const excludedPatterns = [
      /Manifest_DebugFiles.*\.txt$/i,
      /Manifest_NonUFSFiles.*\.txt$/i,
      /Manifest_UFSFiles.*\.txt$/i,
      /[/\\]monobleedingedge[/\\]/i,
      /[/\\]__pycache__[/\\]/i,
      /[/\\]node_modules[/\\]/i,
    ]
    const filtered = filePaths.filter(fp => !excludedPatterns.some(rx => rx.test(fp)))
    console.log(`[AutoTranslate] loadFilesFromPaths: ${filePaths.length} trovati, ${filtered.length} dopo filtro`)
    const loaded: LoadedFile[] = []

    for (const filePath of filtered.slice(0, 50)) { // Max 50 file
      try {
        const content = await invoke<string>('read_text_file', { path: filePath })
        if (!content || content.length < 5) {
          console.log(`[AutoTranslate] Skip (troppo corto): ${filePath}`)
          continue
        }

        const fileName = filePath.replace(basePath, '').replace(/^[/\\]+/, '')
        const format = detectFormat(content, fileName)
        const parsed = parseFile(content, fileName)
        console.log(`[AutoTranslate] File: ${fileName} | Format: ${format} | Stringhe: ${parsed.strings.length}`)

        // Skip file config/cache con poche stringhe non traducibili
        const lowerName = fileName.toLowerCase()
        const isLikelyConfig = /[/\\](config|settings|chunk_map|preferences|\.config)\.json$/i.test(lowerName)
        if (isLikelyConfig && parsed.strings.length < 20) {
          console.log(`[AutoTranslate] Skip (config/cache): ${fileName}`)
          continue
        }

        if (parsed.strings.length > 0) {
          loaded.push({ name: fileName, content, format, parsed, size: content.length })
        }
      } catch (fileErr) {
        console.warn(`[AutoTranslate] File non leggibile: ${filePath}`, fileErr)
      }
    }

    if (loaded.length > 0) {
      setFiles(loaded)
      console.log(`[AutoTranslate] ✅ Caricati ${loaded.length} file, ${loaded.reduce((s, f) => s + f.parsed.strings.length, 0)} stringhe totali`)
    } else {
      console.warn('[AutoTranslate] ⚠️ Nessun file con stringhe traducibili')
      setGameError('Nessun file con stringhe traducibili trovato. Puoi caricare i file manualmente.')
    }
  }

  // ============================================================================
  // MANUAL FILE UPLOAD (fallback)
  // ============================================================================

  const handleManualUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files
    if (!uploadedFiles) return

    const loaded: LoadedFile[] = []
    for (const file of Array.from(uploadedFiles)) {
      try {
        const content = await file.text()
        const format = detectFormat(content, file.name)
        const parsed = parseFile(content, file.name)
        if (parsed.strings.length > 0) {
          loaded.push({ name: file.name, content, format, parsed, size: file.size })
        }
      } catch {}
    }
    setFiles(prev => [...prev, ...loaded])
    setGameError(null)
  }, [])

  // ============================================================================
  // START TRANSLATION
  // ============================================================================

  const handleResumeTranslation = useCallback(() => {
    if (!savedCheckpoint) return
    setTranslatedStrings(savedCheckpoint.translatedStrings)
    if (files.length > 0) setSelectedFile(files[0].name)
    setStep('review')
    setSavedCheckpoint(null)
  }, [savedCheckpoint, files])

  const handleStopTranslation = useCallback(() => {
    abortRef.current = true
    setStoppedByUser(true)
    console.log('[AutoTranslate] Stop richiesto dall\'utente')
  }, [])

  const handleStartTranslation = useCallback(async (resumeFromCheckpoint = false) => {
    if (files.length === 0) return

    abortRef.current = false
    setStoppedByUser(false)
    setStep('translating')
    setIsTranslating(true)
    const startTime = Date.now()
    const errors: string[] = []
    const totalStrCount = files.reduce((s, f) => s + f.parsed.strings.length, 0)
    let globalTranslated = 0
    let consecutiveFailedBatches = 0

    // Carica checkpoint esistente se si riprende
    let allTranslated: Map<string, TranslatedString[]>
    let existingKeys = new Set<string>()
    if (resumeFromCheckpoint) {
      const loaded = loadCheckpoint()
      allTranslated = loaded || new Map()
      // Raccogli chiavi già tradotte
      allTranslated.forEach((arr) => {
        arr.forEach(t => { if (t.translation) existingKeys.add(t.key) })
      })
      globalTranslated = existingKeys.size
      console.log(`[Resume] Ripresa da checkpoint: ${existingKeys.size} stringhe già tradotte`)
    } else {
      allTranslated = new Map()
      clearCheckpoint()
    }

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi]
      const strings = file.parsed.strings
      if (strings.length === 0) continue

      // Se il file è già completamente tradotto nel checkpoint, salta
      const existingFile = allTranslated.get(file.name)
      if (existingFile && existingFile.length === strings.length && existingFile.every(t => t.translation)) {
        globalTranslated = Math.max(globalTranslated, existingFile.filter(t => t.translation).length + (globalTranslated - existingKeys.size))
        console.log(`[Resume] File ${file.name} già completo, skip`)
        continue
      }

      const fileTranslations: TranslatedString[] = existingFile ? [...existingFile] : []
      const alreadyDoneKeys = new Set(fileTranslations.filter(t => t.translation).map(t => t.key))
      const batchSize = 20
      // Filtra solo stringhe non ancora tradotte
      const pendingStrings = strings.filter(s => !alreadyDoneKeys.has(s.key))
      if (pendingStrings.length === 0) {
        console.log(`[Resume] File ${file.name}: tutte le stringhe già tradotte`)
        continue
      }
      const totalBatches = Math.ceil(pendingStrings.length / batchSize)

      for (let bi = 0; bi < totalBatches; bi++) {
        const batch = pendingStrings.slice(bi * batchSize, (bi + 1) * batchSize)
        const batchTexts = batch.map(s => s.value)

        setProgress({
          currentFile: fi + 1, totalFiles: files.length,
          currentBatch: bi + 1, totalBatches,
          translatedStrings: globalTranslated, totalStrings: totalStrCount,
          currentStep: `Traduzione ${file.name} (batch ${bi + 1}/${totalBatches})`,
          percent: Math.round((globalTranslated / totalStrCount) * 100),
          startTime, errors,
        })

        // Check abort
        if (abortRef.current) {
          console.log(`[AutoTranslate] Fermato dall'utente a ${globalTranslated} stringhe`)
          break
        }

        try {
          let harvestedContext
          if (useContextHarvest) {
            try {
              const inputs: HarvestInput[] = batch.map((s, idx) => ({
                text: s.value, key: s.key, filename: file.name,
                comment: s.comment, maxLength: s.maxLength,
                previousText: idx > 0 ? batch[idx - 1].value : undefined,
                nextText: idx < batch.length - 1 ? batch[idx + 1].value : undefined,
              }))
              harvestedContext = harvestBatch(inputs)
            } catch {}
          }

          const result = await translateSmart({
            texts: batchTexts, sourceLanguage: sourceLang,
            targetLanguage: targetLang, harvestedContext,
            gameId: gameInfo?.gameId,
          })

          // Se il provider ha fallito completamente (success: false), auto-stop rapido
          if (!result.success) {
            consecutiveFailedBatches++
            console.warn(`[AutoTranslate] Batch fallito (${consecutiveFailedBatches}/3) — provider: ${result.provider}, success: false`)
            for (const s of batch) {
              fileTranslations.push({ key: s.key, original: s.value, translation: '', qaScore: 0, qaPassed: false, isEdited: false })
              globalTranslated++
            }
            if (consecutiveFailedBatches >= 3) {
              errors.push('Tutti i provider di traduzione sono bloccati o non configurati. Traduzione fermata automaticamente.')
              abortRef.current = true
              console.error('[AutoTranslate] Auto-stop: 3 batch consecutivi senza traduzioni')
            }
          } else {
            let batchActuallyTranslated = 0
            for (let si = 0; si < batch.length; si++) {
              const original = batch[si].value
              const translation = result.translations[si] || ''
              const wasTranslated = translation && translation !== original
              if (wasTranslated) batchActuallyTranslated++
              let qaReport: QualityReport | undefined
              let qaScore = wasTranslated ? 100 : 0, qaPassed = !!wasTranslated
              if (wasTranslated) {
                try {
                  qaReport = runQualityGates({ sourceText: original, translatedText: translation, targetLanguage: targetLang })
                  qaScore = qaReport.overallScore; qaPassed = qaReport.passed
                } catch {}
              }
              fileTranslations.push({ key: batch[si].key, original, translation: wasTranslated ? translation : '', qaScore, qaPassed, qaReport, isEdited: false })
              globalTranslated++
            }
            // Se nessuna stringa è stata effettivamente tradotta nonostante success:true, conta come fallito
            if (batchActuallyTranslated === 0) {
              consecutiveFailedBatches++
              console.warn(`[AutoTranslate] Batch con success:true ma 0 traduzioni effettive (${consecutiveFailedBatches}/3) — provider: ${result.provider}`)
              if (consecutiveFailedBatches >= 3) {
                errors.push('Tutti i provider di traduzione sono bloccati o non configurati. Traduzione fermata automaticamente.')
                abortRef.current = true
                console.error('[AutoTranslate] Auto-stop: 3 batch consecutivi senza traduzioni effettive')
              }
            } else {
              consecutiveFailedBatches = 0
            }
          }
        } catch (err) {
          errors.push(`${file.name} batch ${bi + 1}: ${err instanceof Error ? err.message : 'Errore'}`)
          for (const s of batch) {
            fileTranslations.push({ key: s.key, original: s.value, translation: '', qaScore: 0, qaPassed: false, isEdited: false })
            globalTranslated++
          }
          consecutiveFailedBatches++
          if (consecutiveFailedBatches >= 3) {
            errors.push('Troppi errori consecutivi. Traduzione fermata automaticamente.')
            abortRef.current = true
          }
        }

        // Salva checkpoint dopo ogni batch
        allTranslated.set(file.name, fileTranslations)
        saveCheckpoint(allTranslated)
        setTranslatedStrings(new Map(allTranslated))
      }
      allTranslated.set(file.name, fileTranslations)
      if (abortRef.current) break
    }

    setTranslatedStrings(allTranslated)
    saveCheckpoint(allTranslated)
    const wasStopped = abortRef.current
    const actualTranslated = [...allTranslated.values()].flat().filter(t => t.translation).length
    setProgress(prev => prev ? { ...prev, percent: wasStopped ? Math.round((actualTranslated / totalStrCount) * 100) : 100, currentStep: wasStopped ? `Fermato — ${actualTranslated} stringhe salvate` : 'Completato!' } : null)
    setIsTranslating(false)
    if (files.length > 0) setSelectedFile(files[0].name)
    // Vai a review solo se ci sono traduzioni utili
    if (actualTranslated > 0) setStep('review')
  }, [files, sourceLang, targetLang, useContextHarvest, gameInfo, loadCheckpoint, clearCheckpoint, saveCheckpoint])

  // ============================================================================
  // REVIEW
  // ============================================================================

  const currentFileStrings = selectedFile ? translatedStrings.get(selectedFile) || [] : []
  const filteredStrings = currentFileStrings.filter(s => {
    if (reviewFilter === 'issues') return !s.qaPassed || s.qaScore < 70
    if (reviewFilter === 'edited') return s.isEdited
    if (reviewFilter === 'untranslated') return !s.translation
    return true
  })

  const handleEditStart = useCallback((key: string, val: string) => { setEditingKey(key); setEditValue(val) }, [])
  const handleEditCancel = useCallback(() => { setEditingKey(null); setEditValue('') }, [])

  const handleEditSave = useCallback(() => {
    if (!editingKey || !selectedFile) return
    setTranslatedStrings(prev => {
      const next = new Map(prev)
      const arr = [...(next.get(selectedFile) || [])]
      const idx = arr.findIndex(s => s.key === editingKey)
      if (idx >= 0) {
        const orig = arr[idx]
        arr[idx] = { ...orig, isEdited: true, editedTranslation: editValue }
        addCorrection({ sourceText: orig.original, aiTranslation: orig.translation, humanCorrection: editValue, sourceLanguage: sourceLang, targetLanguage: targetLang })
      }
      next.set(selectedFile, arr)
      return next
    })
    setEditingKey(null); setEditValue('')
  }, [editingKey, selectedFile, editValue, sourceLang, targetLang])

  // Traduci tutte le stringhe non tradotte in batch
  const handleTranslateUntranslated = useCallback(async () => {
    setIsRetranslating(true)
    abortRef.current = false
    const batchSize = 20
    const updated = new Map(translatedStrings)
    let totalUntranslated = 0
    let doneCount = 0

    // Conta totale non tradotte
    for (const [, arr] of updated) {
      totalUntranslated += arr.filter(s => !s.translation).length
    }
    setRetranslateProgress({ done: 0, total: totalUntranslated })

    for (const [fileName, fileStrings] of updated) {
      if (abortRef.current) break
      const pending = fileStrings.filter(s => !s.translation)
      if (pending.length === 0) continue

      for (let i = 0; i < pending.length; i += batchSize) {
        if (abortRef.current) break
        const batch = pending.slice(i, i + batchSize)
        const batchTexts = batch.map(s => s.original)

        try {
          let harvestedContext
          if (useContextHarvest) {
            try {
              const inputs: HarvestInput[] = batch.map((s, idx) => ({
                text: s.original, key: s.key, filename: fileName,
                previousText: idx > 0 ? batch[idx - 1].original : undefined,
                nextText: idx < batch.length - 1 ? batch[idx + 1].original : undefined,
              }))
              harvestedContext = harvestBatch(inputs)
            } catch {}
          }

          const result = await translateSmart({
            texts: batchTexts, sourceLanguage: sourceLang,
            targetLanguage: targetLang, harvestedContext,
            gameId: gameInfo?.gameId,
          })

          if (result.success) {
            const arr = [...(updated.get(fileName) || [])]
            for (let si = 0; si < batch.length; si++) {
              const translation = result.translations[si] || ''
              const wasTranslated = translation && translation !== batch[si].original
              if (wasTranslated) {
                const idx = arr.findIndex(s => s.key === batch[si].key)
                if (idx >= 0) {
                  let qaScore = 100, qaPassed = true
                  try {
                    const qaReport = runQualityGates({ sourceText: batch[si].original, translatedText: translation, targetLanguage: targetLang })
                    qaScore = qaReport.overallScore; qaPassed = qaReport.passed
                    arr[idx] = { ...arr[idx], translation, qaScore, qaPassed, qaReport }
                  } catch {
                    arr[idx] = { ...arr[idx], translation, qaScore, qaPassed }
                  }
                }
              }
            }
            updated.set(fileName, arr)
            setTranslatedStrings(new Map(updated))
          }
        } catch (err) {
          console.warn(`[RetranslateUntranslated] Batch error:`, err)
        }

        doneCount += batch.length
        setRetranslateProgress({ done: doneCount, total: totalUntranslated })
      }
    }

    // Salva checkpoint
    saveCheckpoint(updated)
    setIsRetranslating(false)
    setRetranslateProgress(null)
  }, [translatedStrings, sourceLang, targetLang, useContextHarvest, gameInfo, saveCheckpoint])

  const allStrings = [...translatedStrings.values()].flat()
  const totalTranslated = allStrings.length
  const issueCount = allStrings.filter(s => !s.qaPassed || s.qaScore < 70).length
  const editedCount = allStrings.filter(s => s.isEdited).length
  const untranslatedCount = allStrings.filter(s => !s.translation).length
  const avgScore = totalTranslated > 0 ? Math.round(allStrings.reduce((s, t) => s + t.qaScore, 0) / totalTranslated) : 0

  // ============================================================================
  // PATCH
  // ============================================================================

  const gameTitle = gameInfo?.gameName || ''

  const handleGeneratePatch = useCallback(async () => {
    setIsGenerating(true); setStep('patch')
    try {
      const patchInputs: PatchInput[] = files.map(file => {
        const strings = translatedStrings.get(file.name) || []
        const translationMap = new Map<string, string>()
        for (const s of strings) {
          const final = s.isEdited ? (s.editedTranslation || s.translation) : s.translation
          if (final) { translationMap.set(s.key, final); if (s.original !== s.key) translationMap.set(s.original, final) }
        }
        return { filename: file.name, originalContent: file.content, translations: translationMap, format: file.format }
      })
      const result = generatePatch(patchInputs, {
        projectName: `${gameTitle} - ${targetLang.toUpperCase()}`, gameTitle: gameTitle || 'Game Translation',
        sourceLanguage: sourceLang, targetLanguage: targetLang, translator: translator || 'GameStringer User',
        version: patchVersion, description: 'Traduzione automatica con GameStringer One-Click',
        qualityScore: avgScore, includeReadme: true, includeManifest: true,
      })
      setPatchResult(result)
    } catch (err) { console.error('[Patch] Error:', err) }
    finally { setIsGenerating(false) }
  }, [files, translatedStrings, gameTitle, sourceLang, targetLang, translator, patchVersion, avgScore])

  const handleDownloadZip = useCallback(async () => {
    if (!patchResult) return
    try {
      const blob = await generateZipBlob(patchResult.files)
      const safeName = (gameTitle || 'translation').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      const filename = `${safeName}_${targetLang}_v${patchVersion}.zip`

      // Prova Tauri: salva sul Desktop
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i])
        }
        const base64 = btoa(binary)
        const desktopPath = await invoke<string>('get_desktop_path')
        const fullPath = `${desktopPath}\\${filename}`
        await invoke('save_binary_file', { filePath: fullPath, base64Content: base64 })
        console.log('[ZIP] Salvato su Desktop:', fullPath)
        alert(`ZIP salvato sul Desktop:\n${fullPath}`)
        return
      } catch (tauriErr) {
        console.log('[ZIP] Tauri non disponibile, fallback browser:', tauriErr)
      }

      // Fallback browser
      downloadBlob(blob, filename)
    } catch (err) { console.error('[ZIP] Error:', err) }
  }, [patchResult, gameTitle, targetLang, patchVersion])

  // ============================================================================
  // TEST PATCH: backup → applica → lancia → monitora
  // ============================================================================

  const addTestLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setTestPatchLogs(prev => [...prev, `[${ts}] ${msg}`])
    console.log(`[TestPatch] ${msg}`)
  }, [])

  // Rileva se il gioco è Unreal Engine (controlla se esiste una sottocartella con Content/Paks)
  const isUnrealEngine = useCallback((installPath: string): boolean => {
    // Controlliamo se i file caricati provengono da un translation_session.json con entries namespace/key
    // Il modo più affidabile: cerchiamo se le stringhe hanno chiavi nel formato "namespace::key"
    for (const [, strings] of translatedStrings.entries()) {
      if (strings.some(s => s.key.includes('::'))) return true
    }
    return false
  }, [translatedStrings])

  const handleTestPatch = useCallback(async () => {
    if (!gameInfo?.installPath) return
    const isUE = isUnrealEngine(gameInfo.installPath)

    // Per non-UE serve patchResult; per UE leggiamo direttamente dal translation_session.json
    if (!isUE && !patchResult) return
    const translatedFiles = patchResult?.files.filter(f => f.type === 'translated') || []
    if (!isUE && translatedFiles.length === 0) { addTestLog('Nessun file tradotto da applicare'); return }

    setTestPatchStatus('backing_up')
    setTestPatchLogs([])
    setTestBackupPaths(new Map())
    setTestPatchApplied(false)
    addTestLog('Avvio test patch...')
    addTestLog(isUE ? '🎮 Rilevato: Unreal Engine — creazione .pak' : '📁 Modalità: sovrascrittura file diretta')

    if (isUE) {
      // ================================================================
      // UNREAL ENGINE: crea .pak tramite apply_unreal_translation
      // ================================================================

      // STEP 1: Cleanup — rimuovi eventuali patch precedenti (sia .pak che .utoc/.ucas)
      setTestPatchStatus('backing_up')
      const backups = new Map<string, string>()
      try {
        addTestLog('Rimozione patch precedenti...')
        try {
          const removeResult = await invoke<string>('remove_unreal_translation', { gamePath: gameInfo.installPath })
          addTestLog(`🧹 ${removeResult}`)
        } catch { addTestLog('ℹ️ Nessuna patch precedente da rimuovere') }
        backups.set('__unreal_pak__', '__unreal__')
        setTestBackupPaths(new Map(backups))
        addTestLog('✅ Pronto per nuova patch')
      } catch (err) {
        addTestLog(`❌ Errore fase cleanup: ${err}`)
        setTestPatchStatus('error')
        return
      }

      // STEP 2: Applica — raccoglie traduzioni e chiama apply_unreal_translation
      setTestPatchStatus('applying')
      try {
        addTestLog('Raccolta traduzioni per .pak...')

        // Per UE: leggi direttamente il translation_session.json che contiene le traduzioni
        // nel formato corretto (namespace, key, original, translated)
        const translations: Array<{ namespace: string; key: string; source_hash: number; original: string; translated: string }> = []

        // Prima: prova a leggere il translation_session.json dalla cartella del gioco
        try {
          const sessionPath = `${gameInfo.installPath}\\GameStringer\\translation_session.json`
          const sessionContent = await invoke<string>('read_text_file', { path: sessionPath })
          const session = JSON.parse(sessionContent)
          if (session.entries && Array.isArray(session.entries)) {
            for (const entry of session.entries) {
              if (entry.original && entry.translated && entry.translated !== entry.original) {
                translations.push({
                  namespace: entry.namespace || '',
                  key: entry.key || '',
                  source_hash: 0,
                  original: entry.original,
                  translated: entry.translated,
                })
              }
            }
            addTestLog(`Letto translation_session.json: ${session.entries.length} entries, ${translations.length} tradotte`)
          }
        } catch (sessionErr) {
          console.warn('[TestPatch] translation_session.json non trovato, fallback a translatedStrings:', sessionErr)
        }

        // Fallback: usa translatedStrings del wizard (se non trovato il session file)
        if (translations.length === 0) {
          addTestLog('Fallback: uso traduzioni dal wizard...')
          for (const [, strings] of translatedStrings.entries()) {
            for (const s of strings) {
              const final = s.isEdited ? (s.editedTranslation || s.translation) : s.translation
              if (!final || final === s.original) continue
              const sepIdx = s.key.indexOf('::')
              const ns = sepIdx > 0 ? s.key.substring(0, sepIdx) : ''
              const key = sepIdx > 0 ? s.key.substring(sepIdx + 2) : s.key
              translations.push({ namespace: ns, key, source_hash: 0, original: s.original, translated: final })
            }
          }
        }

        // Applica anche le modifiche manuali dall'editor di review
        for (const [, strings] of translatedStrings.entries()) {
          for (const s of strings) {
            if (!s.isEdited || !s.editedTranslation) continue
            const sepIdx = s.key.indexOf('::')
            const ns = sepIdx > 0 ? s.key.substring(0, sepIdx) : ''
            const key = sepIdx > 0 ? s.key.substring(sepIdx + 2) : s.key
            // Sovrascrivi la traduzione esistente con quella editata
            const existing = translations.find(t => t.namespace === ns && t.key === key)
            if (existing) {
              existing.translated = s.editedTranslation
            }
          }
        }

        addTestLog(`Trovate ${translations.length} traduzioni effettive`)

        if (translations.length === 0) {
          addTestLog('❌ Nessuna traduzione effettiva da applicare')
          setTestPatchStatus('error')
          return
        }

        // Rileva se il gioco usa IoStore (ha uasset_cache con chunk_map.json)
        let useIoStore = false
        try {
          const chunkMapPath = `${gameInfo.installPath}\\GameStringer\\uasset_cache\\chunk_map.json`
          const chunkMapContent = await invoke<string>('read_text_file', { path: chunkMapPath })
          const chunkMap = JSON.parse(chunkMapContent)
          const fileCount = Object.keys(chunkMap).filter(k => k !== '__meta').length
          useIoStore = true
          addTestLog(`📦 Rilevato: IoStore (${fileCount} DataTable UAsset) — binary patching`)
        } catch {
          addTestLog('📦 Formato: .locres standard — creazione .pak traduzione')
        }

        if (useIoStore) {
          // IoStore: patcha i .uasset binari e crea container .utoc/.ucas override
          addTestLog('Patching DataTable UAsset e creazione IoStore override...')
          const pakResult = await invoke<{ success: boolean; pak_path: string; entries_count: number; message: string }>(
            'apply_datatable_translation',
            { gamePath: gameInfo.installPath, translations, targetLanguage: targetLang }
          )

          if (pakResult.success) {
            addTestLog(`✅ IoStore creato: ${pakResult.message}`)
            addTestLog(`📦 Path: ${pakResult.pak_path}`)
            setTestPatchApplied(true)
          } else {
            addTestLog(`❌ Errore IoStore: ${pakResult.message}`)
            setTestPatchStatus('error')
            return
          }
        } else {
          // Locres standard: crea .pak con .locres tradotto
          addTestLog('Creazione file .pak traduzione...')
          const pakResult = await invoke<{ success: boolean; pak_path: string; entries_count: number; message: string }>(
            'apply_unreal_translation',
            { gamePath: gameInfo.installPath, translations, targetLanguage: targetLang }
          )

          if (pakResult.success) {
            addTestLog(`✅ .pak creato: ${pakResult.message}`)
            addTestLog(`📦 Path: ${pakResult.pak_path}`)
            setTestPatchApplied(true)
          } else {
            addTestLog(`❌ Errore creazione .pak: ${pakResult.message}`)
            setTestPatchStatus('error')
            return
          }
        }
      } catch (err) {
        addTestLog(`❌ Errore applicazione traduzione UE: ${err}`)
        setTestPatchStatus('error')
        return
      }
    } else {
      // ================================================================
      // NON-UE: sovrascrittura file diretta (comportamento originale)
      // ================================================================

      // STEP 1: Backup dei file originali
      const backups = new Map<string, string>()
      try {
        addTestLog(`Backup di ${translatedFiles.length} file originali...`)
        for (const file of translatedFiles) {
          const fullPath = `${gameInfo.installPath}\\${file.path.replace(/\//g, '\\')}`
          try {
            const backupPath = `${fullPath}.gs_backup_${Date.now()}`
            try {
              const originalContent = await invoke<string>('read_text_file', { path: fullPath })
              await invoke('write_text_file', { path: backupPath, content: originalContent })
              backups.set(fullPath, backupPath)
              addTestLog(`✅ Backup: ${file.path}`)
            } catch {
              addTestLog(`⚠️ File non esistente (nuovo): ${file.path}`)
              backups.set(fullPath, '__new__')
            }
          } catch (err) {
            addTestLog(`❌ Errore backup ${file.path}: ${err}`)
            setTestPatchStatus('error')
            return
          }
        }
        setTestBackupPaths(new Map(backups))
        addTestLog(`Backup completato: ${backups.size} file salvati`)
      } catch (err) {
        addTestLog(`❌ Errore fase backup: ${err}`)
        setTestPatchStatus('error')
        return
      }

      // STEP 2: Applica i file tradotti
      setTestPatchStatus('applying')
      try {
        addTestLog('Applicazione file tradotti...')
        for (const file of translatedFiles) {
          const fullPath = `${gameInfo.installPath}\\${file.path.replace(/\//g, '\\')}`
          try {
            await invoke('write_text_file', { path: fullPath, content: file.content })
            addTestLog(`✅ Applicato: ${file.path}`)
          } catch (err) {
            addTestLog(`❌ Errore scrittura ${file.path}: ${err}`)
            setTestPatchStatus('error')
            return
          }
        }
        setTestPatchApplied(true)
        addTestLog('Patch applicata con successo!')
      } catch (err) {
        addTestLog(`❌ Errore fase applicazione: ${err}`)
        setTestPatchStatus('error')
        return
      }
    }

    // STEP 3: Lancia il gioco (comune a entrambi i percorsi)
    setTestPatchStatus('launching')
    try {
      addTestLog('Avvio gioco...')
      const platform = (gameInfo.platform || 'Steam').toLowerCase()
      const gameId = gameInfo.gameId.replace(/^steam_/, '').replace(/^epic_/, '').replace(/^gog_/, '')
      let launchResult: { success: boolean; message: string }

      if (platform === 'steam' || gameInfo.gameId.startsWith('steam_')) {
        launchResult = await invoke<{ success: boolean; message: string }>('launch_steam_game', { appId: gameId })
      } else if (platform === 'epic games' || platform === 'epic') {
        launchResult = await invoke<{ success: boolean; message: string }>('launch_epic_game', { appName: gameId })
      } else if (platform === 'gog') {
        launchResult = await invoke<{ success: boolean; message: string }>('launch_gog_game', { gameId })
      } else {
        launchResult = { success: false, message: 'Piattaforma non supportata per avvio automatico' }
      }

      if (launchResult.success) {
        addTestLog(`✅ Gioco avviato: ${launchResult.message}`)
      } else {
        addTestLog(`⚠️ Avvio gioco: ${launchResult.message}`)
      }
    } catch (err) {
      addTestLog(`⚠️ Errore avvio gioco: ${err}`)
    }

    // STEP 4: Monitoraggio in tempo reale
    setTestPatchStatus('monitoring')
    addTestLog('Monitoraggio attivo — verifica che il gioco funzioni correttamente')
    addTestLog('Quando hai finito di testare, clicca "Ripristina Originali" o "Mantieni Patch"')

    if (!isUE) {
      // Monitor file solo per non-UE (per UE il .pak è stabile)
      let monitorCount = 0
      const monitorInterval = setInterval(async () => {
        monitorCount++
        try {
          let allOk = true
          for (const file of translatedFiles) {
            const fullPath = `${gameInfo.installPath}\\${file.path.replace(/\//g, '\\')}`
            try {
              const currentContent = await invoke<string>('read_text_file', { path: fullPath })
              if (currentContent !== file.content) {
                addTestLog(`⚠️ File modificato esternamente: ${file.path}`)
                allOk = false
              }
            } catch {
              addTestLog(`⚠️ File non più accessibile: ${file.path}`)
              allOk = false
            }
          }
          if (allOk && monitorCount % 6 === 0) {
            addTestLog(`✅ Controllo #${monitorCount}: tutti i file OK`)
          }
        } catch {}
      }, 5000)
      testMonitorRef.current = monitorInterval
    } else {
      addTestLog('ℹ️ .pak Unreal Engine installato — il monitoraggio file non è necessario')
      addTestLog('Verifica nel gioco che i testi siano in italiano')
    }
  }, [patchResult, gameInfo, addTestLog, translatedStrings, targetLang, isUnrealEngine])

  const handleRestorePatch = useCallback(async () => {
    // Ferma il monitoraggio
    if (testMonitorRef.current) {
      clearInterval(testMonitorRef.current)
      testMonitorRef.current = null
    }

    setTestPatchStatus('restoring')
    addTestLog('Ripristino file originali...')

    // Controlla se è Unreal Engine
    const isUE = testBackupPaths.has('__unreal_pak__')

    if (isUE) {
      // Per UE: rimuovi i file di traduzione (.pak, .utoc, .ucas)
      try {
        addTestLog('Rimozione file traduzione...')
        const result = await invoke<string>('remove_unreal_translation', { gamePath: gameInfo?.installPath || '' })
        addTestLog(`✅ ${result}`)
      } catch (err) {
        const errStr = String(err)
        if (errStr.includes('bloccati') || errStr.includes('os error 32') || errStr.includes('utilizzato da un altro processo')) {
          addTestLog(`⚠️ ${errStr}`)
          addTestLog('💡 Chiudi il gioco e clicca "Ripristina Originali" di nuovo')
          setTestPatchStatus('error')
          return
        }
        addTestLog(`❌ Errore rimozione: ${err}`)
      }
    } else {
      // Per non-UE: ripristina file originali dai backup
      let restored = 0
      for (const [fullPath, backupPath] of testBackupPaths.entries()) {
        try {
          if (backupPath === '__new__') {
            addTestLog(`ℹ️ File nuovo, skip: ${fullPath}`)
            continue
          }
          const backupContent = await invoke<string>('read_text_file', { path: backupPath })
          await invoke('write_text_file', { path: fullPath, content: backupContent })
          try { await invoke('secure_delete_file', { filepath: backupPath }) } catch {}
          restored++
          addTestLog(`✅ Ripristinato: ${fullPath.split('\\').pop()}`)
        } catch (err) {
          addTestLog(`❌ Errore ripristino ${fullPath}: ${err}`)
        }
      }
      addTestLog(`Ripristino completato: ${restored} file ripristinati`)
    }

    setTestPatchApplied(false)
    setTestPatchStatus('done')
  }, [testBackupPaths, addTestLog, gameInfo])

  const handleKeepPatch = useCallback(() => {
    // Ferma il monitoraggio
    if (testMonitorRef.current) {
      clearInterval(testMonitorRef.current)
      testMonitorRef.current = null
    }

    // Per non-UE: pulisci i backup
    if (!testBackupPaths.has('__unreal_pak__')) {
      const cleanupBackups = async () => {
        for (const [, backupPath] of testBackupPaths.entries()) {
          if (backupPath !== '__new__') {
            try { await invoke('secure_delete_file', { filepath: backupPath }) } catch {}
          }
        }
      }
      cleanupBackups()
    }

    setTestPatchStatus('done')
    addTestLog('Patch mantenuta! I file tradotti sono ora permanenti nella cartella del gioco.')
    if (testBackupPaths.has('__unreal_pak__')) {
      addTestLog('ℹ️ Il file .pak rimarrà nella cartella Paks del gioco.')
    }
  }, [testBackupPaths, addTestLog])

  const handleReset = useCallback(() => {
    setStep('select_game'); setFiles([]); setTranslatedStrings(new Map()); setProgress(null)
    setPatchResult(null); setSelectedFile(null); setEditingKey(null); setGameInfo(null); setGameError(null)
  }, [])

  // ============================================================================
  // STEP INDICATOR
  // ============================================================================

  const wizardSteps: { id: WizardStep; label: string; icon: any }[] = [
    { id: 'select_game', label: 'Gioco', icon: Gamepad2 },
    { id: 'translating', label: 'Traduzione', icon: Sparkles },
    { id: 'review', label: 'Revisione', icon: Eye },
    { id: 'patch', label: 'Patch', icon: Package },
  ]
  const stepOrder: WizardStep[] = ['select_game', 'translating', 'review', 'patch']
  const currentStepIndex = stepOrder.indexOf(step)

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gameInfo?.gameId && (
              <button
                onClick={() => window.location.href = `/games/?id=${gameInfo.gameId}&name=${encodeURIComponent(gameInfo.gameName || '')}&platform=${encodeURIComponent(gameInfo.platform || '')}&headerImage=${encodeURIComponent(gameInfo.gameImage || '')}`}
                className="p-2 rounded-lg bg-black/30 border border-white/10 hover:bg-white/10 transition-colors"
                title="Torna alla pagina del gioco"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            )}
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">One-Click Translate & Patch</h1>
              <p className="text-white/70 text-sm">
                {gameInfo ? `${gameInfo.gameName}` : 'Seleziona un gioco → Traduci → Patch pronta'}
              </p>
            </div>
          </div>
          {step !== 'select_game' && (
            <Button variant="outline" size="sm" onClick={handleReset}
              className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
              <RefreshCw className="h-3 w-3 mr-1" /> Ricomincia
            </Button>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="border-b bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <div className="flex items-center gap-1">
            {wizardSteps.map((s, i) => {
              const Icon = s.icon
              const isActive = s.id === step
              const isPast = stepOrder.indexOf(s.id) < currentStepIndex
              return (
                <div key={s.id} className="flex items-center gap-1">
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors",
                    isActive ? "bg-primary text-primary-foreground" :
                    isPast ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
                  )}>
                    {isPast ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </div>
                  {i < wizardSteps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* ================================================================ */}
        {/* STEP 1: SELECT GAME + CONFIG */}
        {/* ================================================================ */}
        {step === 'select_game' && (
          <div className="space-y-4">
            {/* Banner Riprendi Traduzione (checkpoint trovato) */}
            {savedCheckpoint && gameInfo && (
              <Card className="border-amber-500/40 bg-amber-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Save className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-amber-200">Traduzione in corso trovata!</h3>
                      <p className="text-xs text-amber-300/70 mt-0.5">
                        {savedCheckpoint.translatedCount}/{savedCheckpoint.totalCount} stringhe già tradotte
                        ({savedCheckpoint.targetLang.toUpperCase()})
                        — salvata il {new Date(savedCheckpoint.savedAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-xs bg-amber-600 hover:bg-amber-700" onClick={handleResumeTranslation}>
                        <Eye className="h-3 w-3 mr-1" /> Rivedi
                      </Button>
                      <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStartTranslation(true)}>
                        <Play className="h-3 w-3 mr-1" /> Continua
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/20" onClick={clearCheckpoint}>
                        <XCircle className="h-3 w-3 mr-1" /> Ricomincia
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Game Card (se selezionato) */}
            {gameInfo && (
              <Card className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-purple-500/30">
                <CardContent className="p-4 flex items-center gap-4">
                  {gameInfo.gameImage && (
                    <img src={gameInfo.gameImage} alt={gameInfo.gameName} className="w-24 h-14 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">{gameInfo.gameName}</h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {gameInfo.platform && <Badge variant="outline" className="text-[9px] h-4">{gameInfo.platform}</Badge>}
                      <span className="font-mono text-[10px] truncate max-w-[300px]">{gameInfo.installPath}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {isLoadingGame ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Scansione file...
                      </div>
                    ) : files.length > 0 ? (
                      <div>
                        <div className="text-lg font-bold text-emerald-400">{files.length} file</div>
                        <div className="text-xs text-muted-foreground">{totalStrings} stringhe trovate</div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Se non c'è gioco da URL: messaggio */}
            {!gameInfo && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <h2 className="text-lg font-bold">Seleziona un gioco dalla Libreria</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Vai nella <strong>Libreria</strong>, apri la scheda di un gioco e clicca <strong>&quot;Traduci Tutto&quot;</strong>.
                    I file del gioco verranno caricati automaticamente.
                  </p>
                  <Separator className="my-4" />
                  <p className="text-xs text-muted-foreground">Oppure carica file manualmente:</p>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" /> Carica File
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".json,.csv,.po,.pot,.xlf,.xliff,.resx,.strings,.ini,.xml,.properties,.yaml,.yml,.txt" multiple onChange={handleManualUpload} className="hidden" />
                </CardContent>
              </Card>
            )}

            {/* Errore scan */}
            {gameError && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-3 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs">{gameError}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" /> Carica
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".json,.csv,.po,.pot,.xlf,.xliff,.resx,.strings,.ini,.xml,.properties,.yaml,.yml,.txt" multiple onChange={handleManualUpload} className="hidden" />
                </CardContent>
              </Card>
            )}

            {/* File trovati + Config */}
            {files.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* File list */}
                <Card className="lg:col-span-2">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-xs">{files.length} file trovati ({totalStrings} stringhe)</CardTitle>
                  </CardHeader>
                  <ScrollArea className="h-[200px]">
                    <CardContent className="px-4 pb-3 space-y-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono truncate max-w-[300px]">{f.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1 h-4">{f.format}</Badge>
                          </div>
                          <span className="text-muted-foreground">{f.parsed.strings.length}</span>
                        </div>
                      ))}
                    </CardContent>
                  </ScrollArea>
                </Card>

                {/* Config compatto */}
                <Card>
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <Languages className="h-3.5 w-3.5" /> Lingua & Opzioni
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Da</Label>
                        <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}
                          className="w-full h-7 text-xs bg-background border rounded px-2 mt-0.5">
                          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px]">A</Label>
                        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                          className="w-full h-7 text-xs bg-background border rounded px-2 mt-0.5">
                          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-[10px]">Context Harvester</Label>
                      <Switch checked={useContextHarvest} onCheckedChange={setUseContextHarvest} />
                    </div>

                    <Button
                      onClick={() => handleStartTranslation(false)}
                      disabled={files.length === 0 || isTranslating}
                      className="w-full h-10 text-sm font-bold bg-gradient-to-r from-rose-500 to-fuchsia-500 hover:from-rose-600 hover:to-fuchsia-600"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Traduci {totalStrings} stringhe
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Stima: ~{Math.ceil(totalStrings / 20 * 3)}s
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2: TRANSLATING */}
        {/* ================================================================ */}
        {step === 'translating' && progress && (
          <div className="max-w-2xl mx-auto space-y-4 py-8">
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-3" />
                  <h2 className="text-lg font-bold">Traduzione in corso...</h2>
                  <p className="text-sm text-muted-foreground mt-1">{progress.currentStep}</p>
                </div>
                <Progress value={progress.percent} className="h-2" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div><div className="text-xl font-bold text-primary">{progress.percent}%</div><div className="text-[10px] text-muted-foreground">Completato</div></div>
                  <div><div className="text-xl font-bold">{progress.translatedStrings}/{progress.totalStrings}</div><div className="text-[10px] text-muted-foreground">Stringhe</div></div>
                  <div><div className="text-xl font-bold">{progress.currentFile}/{progress.totalFiles}</div><div className="text-[10px] text-muted-foreground">File</div></div>
                  <div><div className="text-xl font-bold">{Math.round((Date.now() - progress.startTime) / 1000)}s</div><div className="text-[10px] text-muted-foreground">Tempo</div></div>
                </div>
                {progress.errors.length > 0 && (
                  <div className="space-y-2">
                    {progress.errors.some(e => e.includes('provider di traduzione sono bloccati')) ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-200">Provider di traduzione esauriti</p>
                            <p className="text-[10px] text-amber-300/70 mt-1">
                              I servizi gratuiti (Lingva, MyMemory) hanno raggiunto il limite di richieste. 
                              Le traduzioni completate fino ad ora sono state salvate.
                            </p>
                          </div>
                        </div>
                        <div className="bg-black/20 rounded p-2 space-y-1">
                          <p className="text-[10px] font-medium text-amber-200/80">Come procedere:</p>
                          <ul className="text-[10px] text-amber-300/60 space-y-0.5 list-disc list-inside">
                            <li>Attendi 2-5 minuti e clicca <strong>Continua</strong> per riprendere</li>
                            <li>Configura un provider AI (Gemini, DeepSeek, DeepL) in <strong>Impostazioni → API Keys</strong></li>
                            <li>Installa <strong>Ollama</strong> per tradurre offline senza limiti</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-500/10 rounded p-2 text-xs text-red-400">
                        {progress.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-[10px]">
                  {[{ icon: Sparkles, label: 'Context' }, { icon: ArrowRight, label: '' }, { icon: Languages, label: 'Traduzione' }, { icon: ArrowRight, label: '' }, { icon: Shield, label: 'QA' }].map((s, i) => (
                    <div key={i} className="flex items-center gap-1 text-muted-foreground"><s.icon className="h-3 w-3" />{s.label && <span>{s.label}</span>}</div>
                  ))}
                </div>

                <Separator />

                <div className="flex items-center justify-center gap-3">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-9 px-6 text-xs font-semibold"
                    onClick={handleStopTranslation}
                    disabled={stoppedByUser}
                  >
                    {stoppedByUser ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Fermando...</>
                    ) : (
                      <><XCircle className="h-3.5 w-3.5 mr-1.5" /> Ferma e Salva</>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground max-w-[200px]">
                    Il progresso viene salvato automaticamente. Potrai riprendere in qualsiasi momento.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3: REVIEW */}
        {/* ================================================================ */}
        {step === 'review' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <Card className="p-2.5"><div className="text-[10px] text-muted-foreground">Tradotte</div><div className="text-lg font-bold">{totalTranslated - untranslatedCount}</div></Card>
              <Card className="p-2.5"><div className="text-[10px] text-muted-foreground">Score Medio</div><div className={cn("text-lg font-bold", avgScore >= 80 ? "text-emerald-400" : avgScore >= 60 ? "text-yellow-400" : "text-red-400")}>{avgScore}%</div></Card>
              <Card className="p-2.5"><div className="text-[10px] text-muted-foreground">Da Rivedere</div><div className="text-lg font-bold text-yellow-400">{issueCount}</div></Card>
              <Card className="p-2.5"><div className="text-[10px] text-muted-foreground">Modificate</div><div className="text-lg font-bold text-blue-400">{editedCount}</div></Card>
              <Card className={cn("p-2.5", untranslatedCount > 0 ? "border-red-500/30 bg-red-500/5" : "")}>
                <div className="text-[10px] text-muted-foreground">Non tradotte</div>
                <div className="text-lg font-bold text-red-400">{untranslatedCount}</div>
                {untranslatedCount > 0 && !isRetranslating && (
                  <Button size="sm" className="w-full h-6 text-[9px] mt-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" onClick={handleTranslateUntranslated}>
                    <Zap className="h-2.5 w-2.5 mr-0.5" /> Traduci tutte
                  </Button>
                )}
                {isRetranslating && retranslateProgress && (
                  <div className="mt-1 space-y-0.5">
                    <Progress value={(retranslateProgress.done / retranslateProgress.total) * 100} className="h-1.5" />
                    <div className="text-[8px] text-muted-foreground text-center">{retranslateProgress.done}/{retranslateProgress.total}</div>
                    <Button size="sm" variant="ghost" className="w-full h-5 text-[8px]" onClick={() => { abortRef.current = true }}>
                      <XCircle className="h-2 w-2 mr-0.5" /> Stop
                    </Button>
                  </div>
                )}
              </Card>
              <Card className="p-2.5 flex items-center justify-center gap-1.5">
                <Button onClick={handleGeneratePatch} className="h-8 text-xs flex-1 bg-gradient-to-r from-rose-500 to-fuchsia-500">
                  <Package className="h-3 w-3 mr-1" /> Crea Patch
                </Button>
                {gameInfo?.installPath && isUnrealEngine(gameInfo.installPath) && (
                  <Button
                    onClick={handleTestPatch}
                    className="h-8 text-xs flex-1 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                    disabled={testPatchStatus !== 'idle' && testPatchStatus !== 'done' && testPatchStatus !== 'error'}
                  >
                    <Play className="h-3 w-3 mr-1" /> Prova Patch
                  </Button>
                )}
              </Card>
            </div>

            {/* Pannello Test Patch UE (visibile anche in review) */}
            {testPatchStatus !== 'idle' && (
              <Card className="border-violet-500/30 bg-violet-500/5">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-2">
                    {testPatchStatus === 'monitoring' && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>}
                    {testPatchStatus === 'error' && <span className="h-2 w-2 rounded-full bg-red-500" />}
                    {testPatchStatus === 'done' && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                    {(testPatchStatus === 'backing_up' || testPatchStatus === 'applying' || testPatchStatus === 'launching' || testPatchStatus === 'restoring') && <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
                    <span>Test Patch</span>
                    <span className="text-muted-foreground font-normal">
                      — {testPatchStatus === 'backing_up' ? 'Pulizia patch precedenti...' : testPatchStatus === 'applying' ? 'Applicazione traduzioni...' : testPatchStatus === 'launching' ? 'Avvio gioco...' : testPatchStatus === 'monitoring' ? 'In esecuzione — verifica in-game' : testPatchStatus === 'restoring' ? 'Ripristino originali...' : testPatchStatus === 'error' ? 'Errore' : 'Completato'}
                    </span>
                  </CardTitle>
                  {/* Step progress mini */}
                  <div className="flex gap-1 mt-1.5">
                    {['backing_up', 'applying', 'launching', 'monitoring'].map((s, idx) => {
                      const steps = ['backing_up', 'applying', 'launching', 'monitoring']
                      const currentIdx = steps.indexOf(testPatchStatus)
                      const isDone = testPatchStatus === 'done' || (currentIdx >= 0 && idx < currentIdx)
                      const isCurrent = testPatchStatus === s
                      return <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", isDone ? "bg-emerald-500" : isCurrent ? "bg-violet-500 animate-pulse" : testPatchStatus === 'error' && idx <= Math.max(currentIdx, 0) ? "bg-red-500/60" : "bg-muted")} />
                    })}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <ScrollArea className="h-[180px] rounded border border-border/50 bg-background/50 p-2">
                    <div className="space-y-0.5 text-[10px] font-mono">
                      {testPatchLogs.map((log, i) => (
                        <div key={i} className={cn("text-muted-foreground", log.includes('✅') && "text-emerald-400/80", log.includes('❌') && "text-red-400/80", log.includes('⚠️') && "text-yellow-400/80", log.includes('📦') && "text-violet-400/80")}>{log}</div>
                      ))}
                      <div ref={(el) => { el?.scrollIntoView({ behavior: 'smooth' }) }} />
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2">
                    {testPatchApplied && (testPatchStatus === 'monitoring' || testPatchStatus === 'done') && (
                      <>
                        <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={handleRestorePatch}>
                          <RotateCcw className="h-2.5 w-2.5 mr-1" /> Ripristina Originali
                        </Button>
                        <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={handleKeepPatch}>
                          <Check className="h-2.5 w-2.5 mr-1" /> Mantieni Patch
                        </Button>
                      </>
                    )}
                    {testPatchStatus === 'error' && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={handleTestPatch}>
                        <RotateCcw className="h-2.5 w-2.5 mr-1" /> Riprova
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-xs">File</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {files.map(f => {
                    const fStrings = translatedStrings.get(f.name) || []
                    const fIssues = fStrings.filter(s => !s.qaPassed || s.qaScore < 70).length
                    return (
                      <div key={f.name} onClick={() => setSelectedFile(f.name)}
                        className={cn("p-2 rounded text-xs cursor-pointer transition-colors",
                          selectedFile === f.name ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50")}>
                        <div className="font-medium truncate">{f.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{fStrings.length} stringhe</span>
                          {fIssues > 0 && <Badge variant="destructive" className="text-[8px] h-3 px-1">{fIssues}</Badge>}
                        </div>
                      </div>
                    )
                  })}
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Filtro</Label>
                    {(['all', 'issues', 'untranslated', 'edited'] as const).map(f => (
                      <Button key={f} variant={reviewFilter === f ? "default" : "ghost"} size="sm" className="w-full h-6 text-[10px] justify-start" onClick={() => setReviewFilter(f)}>
                        {f === 'all' ? '📋 Tutte' : f === 'issues' ? '⚠️ Da rivedere' : f === 'untranslated' ? `🔴 Non tradotte (${untranslatedCount})` : '✏️ Modificate'}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader className="py-2 px-4"><CardTitle className="text-xs">{selectedFile || 'Seleziona un file'} ({filteredStrings.length})</CardTitle></CardHeader>
                <ScrollArea className="h-[500px]">
                  <div className="px-4 pb-3 space-y-1">
                    {filteredStrings.map((s, i) => {
                      const isEditing = editingKey === s.key
                      const finalTranslation = s.isEdited ? (s.editedTranslation || s.translation) : s.translation
                      return (
                        <div key={`${s.key}-${i}`} className={cn("p-2 rounded border transition-colors",
                          !s.qaPassed ? "border-yellow-500/20 bg-yellow-500/5" : s.isEdited ? "border-blue-500/20 bg-blue-500/5" : "border-transparent hover:bg-muted/30")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] text-muted-foreground/60 font-mono truncate mb-0.5">{s.key}</div>
                              <div className="text-[11px] text-muted-foreground">{s.original}</div>
                              {isEditing ? (
                                <div className="mt-1 space-y-1">
                                  <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-xs min-h-[60px]" autoFocus />
                                  <div className="flex gap-1">
                                    <Button size="sm" className="h-6 text-[10px]" onClick={handleEditSave}><Save className="h-2.5 w-2.5 mr-0.5" /> Salva</Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={handleEditCancel}>Annulla</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs mt-0.5 flex items-start gap-1">
                                  <span className={s.isEdited ? "text-blue-400" : ""}>{finalTranslation || <span className="text-red-400 italic">— non tradotto —</span>}</span>
                                  {s.isEdited && <Badge className="text-[7px] h-3 px-1 bg-blue-500/20 text-blue-400">editata</Badge>}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4",
                                s.qaScore >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                                s.qaScore >= 60 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                                "bg-red-500/10 text-red-400 border-red-500/30")}>{s.qaScore}%</Badge>
                              {!isEditing && <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleEditStart(s.key, finalTranslation)}><Edit3 className="h-3 w-3 text-muted-foreground" /></Button>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {filteredStrings.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                        <p className="text-sm font-medium">Tutto a posto!</p>
                        <p className="text-xs mt-1">Nessuna stringa da rivedere.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 4: PATCH */}
        {/* ================================================================ */}
        {step === 'patch' && (
          <div className="max-w-3xl mx-auto space-y-4 py-4">
            {isGenerating ? (
              <Card className="p-8 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
                <h2 className="text-lg font-bold">Generazione patch...</h2>
              </Card>
            ) : patchResult ? (
              <>
                <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/30">
                  <CardContent className="p-6 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                    <h2 className="text-xl font-bold">Patch Pronta!</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {patchResult.stats.translatedStrings}/{patchResult.stats.totalStrings} stringhe tradotte ({patchResult.stats.coveragePercent}%)
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                      <Button onClick={handleDownloadZip} size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-500">
                        <Download className="h-4 w-4 mr-2" /> Scarica ZIP
                      </Button>
                      <Button
                        onClick={handleTestPatch}
                        size="lg"
                        className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                        disabled={testPatchStatus !== 'idle' && testPatchStatus !== 'done' && testPatchStatus !== 'error'}
                      >
                        <Play className="h-4 w-4 mr-2" /> Prova Patch
                      </Button>
                      <Button variant="outline" onClick={() => setStep('review')}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Torna alla Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-3 text-center"><div className="text-2xl font-bold">{patchResult.stats.totalFiles}</div><div className="text-[10px] text-muted-foreground">File</div></Card>
                  <Card className="p-3 text-center"><div className="text-2xl font-bold">{patchResult.stats.translatedStrings}</div><div className="text-[10px] text-muted-foreground">Stringhe</div></Card>
                  <Card className="p-3 text-center"><div className="text-2xl font-bold text-emerald-400">{patchResult.stats.coveragePercent}%</div><div className="text-[10px] text-muted-foreground">Copertura</div></Card>
                  <Card className="p-3 text-center"><div className="text-2xl font-bold text-blue-400">{avgScore}%</div><div className="text-[10px] text-muted-foreground">Qualità</div></Card>
                </div>
                <Card>
                  <CardHeader className="py-2 px-4"><CardTitle className="text-xs">File nella Patch ({patchResult.files.length})</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 space-y-1">
                    {patchResult.files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/30">
                        <div className="flex items-center gap-2"><FileText className="h-3 w-3 text-muted-foreground" /><span className="font-mono">{f.path}</span></div>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {f.type === 'translated' ? '🎮 Tradotto' : f.type === 'readme' ? '📄 README' : f.type === 'manifest' ? '📋 Manifest' : f.type}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* PANNELLO PROVA PATCH */}
                {testPatchStatus !== 'idle' && (
                  <Card className={cn(
                    "border",
                    testPatchStatus === 'monitoring' ? 'border-violet-500/40 bg-violet-500/5' :
                    testPatchStatus === 'error' ? 'border-red-500/40 bg-red-500/5' :
                    testPatchStatus === 'done' ? 'border-emerald-500/40 bg-emerald-500/5' :
                    'border-blue-500/40 bg-blue-500/5'
                  )}>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {testPatchStatus === 'backing_up' && <><Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Backup in corso...</>}
                          {testPatchStatus === 'applying' && <><Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Applicazione patch...</>}
                          {testPatchStatus === 'launching' && <><Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Avvio gioco...</>}
                          {testPatchStatus === 'monitoring' && <><Shield className="h-4 w-4 text-violet-400 animate-pulse" /> Monitoraggio attivo</>}
                          {testPatchStatus === 'restoring' && <><Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Ripristino...</>}
                          {testPatchStatus === 'done' && <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Test completato</>}
                          {testPatchStatus === 'error' && <><XCircle className="h-4 w-4 text-red-400" /> Errore</>}
                        </CardTitle>
                        {testPatchApplied && (
                          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[9px]">
                            Patch attiva
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-3">
                      {/* Status pipeline */}
                      <div className="flex items-center justify-center gap-1 text-[10px]">
                        {[
                          { id: 'backing_up', label: 'Backup', icon: Save },
                          { id: 'applying', label: 'Applica', icon: Wrench },
                          { id: 'launching', label: 'Avvia', icon: Play },
                          { id: 'monitoring', label: 'Monitor', icon: Shield },
                        ].map((s, i) => {
                          const statusOrder = ['backing_up', 'applying', 'launching', 'monitoring']
                          const currentIdx = statusOrder.indexOf(testPatchStatus)
                          const stepIdx = statusOrder.indexOf(s.id)
                          const isActive = s.id === testPatchStatus
                          const isDone = stepIdx < currentIdx || testPatchStatus === 'done' || testPatchStatus === 'restoring'
                          return (
                            <div key={s.id} className="flex items-center gap-1">
                              {i > 0 && <div className={cn("w-4 h-px", isDone ? "bg-emerald-500" : "bg-muted-foreground/20")} />}
                              <div className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-full border",
                                isActive ? "border-violet-500 bg-violet-500/20 text-violet-300" :
                                isDone ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" :
                                "border-muted-foreground/20 text-muted-foreground/50"
                              )}>
                                <s.icon className={cn("h-3 w-3", isActive && "animate-pulse")} />
                                <span>{s.label}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Log console */}
                      <ScrollArea className="h-32 rounded bg-black/40 border border-muted-foreground/10">
                        <div className="p-2 space-y-0.5 font-mono text-[10px]">
                          {testPatchLogs.map((log, i) => (
                            <div key={i} className={cn(
                              log.includes('❌') ? 'text-red-400' :
                              log.includes('⚠️') ? 'text-amber-400' :
                              log.includes('✅') ? 'text-emerald-400' :
                              'text-muted-foreground'
                            )}>
                              {log}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      {/* Azioni monitoraggio */}
                      {testPatchStatus === 'monitoring' && (
                        <div className="flex justify-center gap-3">
                          <Button
                            onClick={handleRestorePatch}
                            variant="outline"
                            size="sm"
                            className="border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Ripristina Originali
                          </Button>
                          <Button
                            onClick={handleKeepPatch}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mantieni Patch
                          </Button>
                        </div>
                      )}

                      {testPatchStatus === 'error' && testPatchApplied && (
                        <div className="flex justify-center">
                          <Button
                            onClick={handleRestorePatch}
                            variant="destructive"
                            size="sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Ripristina Originali
                          </Button>
                        </div>
                      )}

                      {testPatchStatus === 'done' && (
                        <p className="text-[10px] text-center text-muted-foreground">
                          Puoi chiudere questo pannello o avviare un nuovo test.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
