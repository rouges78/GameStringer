"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { get, set, del } from 'idb-keyval'
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  Sparkles,
  Shield,
  Wrench,
  Save,
  RefreshCw,
  Zap,
  Gamepad2,
  ArrowLeft,
  RotateCcw,
  Check,
  Activity,
  TrendingUp,
  Timer,
  Globe,
  Binary,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { invoke } from "@/lib/tauri-api"
import { detectFormat, parseFile, type ParseResult } from "@/lib/file-parsers"
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
import { exportTMX, exportXLIFF, exportPO, type TranslatedFile, type PatchMetadata } from "@/lib/patch-exporter"
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';

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
// DIFF VISUALE — evidenzia differenze parola per parola
// ============================================================================

function DiffHighlight({ original, translated }: { original: string; translated: string }) {
  if (!translated || original === translated) return <span className="text-muted-foreground/40 italic">identical</span>
  const origWords = original.split(/(\s+)/)
  const transWords = translated.split(/(\s+)/)
  // LCS semplificato per parole — evidenzia aggiunte/rimosse
  const _maxLen = Math.max(origWords.length, transWords.length)
  const result: React.ReactNode[] = []
  let oi = 0, ti = 0
  while (oi < origWords.length || ti < transWords.length) {
    if (oi < origWords.length && ti < transWords.length && origWords[oi] === transWords[ti]) {
      result.push(<span key={`m${ti}`}>{transWords[ti]}</span>)
      oi++; ti++
    } else if (ti < transWords.length) {
      // Cerca se la parola tradotta appare più avanti nell'originale
      const ahead = origWords.indexOf(transWords[ti], oi)
      if (ahead > oi && ahead - oi <= 3) {
        // Le parole originali saltate sono "rimosse"
        for (let k = oi; k < ahead; k++) {
          result.push(<span key={`d${k}`} className="bg-red-500/20 text-red-400 line-through text-micro mx-0.5">{origWords[k]}</span>)
        }
        oi = ahead
      } else {
        result.push(<span key={`a${ti}`} className="bg-emerald-500/20 text-emerald-400 font-medium">{transWords[ti]}</span>)
        ti++
        if (oi < origWords.length && !transWords.includes(origWords[oi])) oi++
        continue
      }
    } else {
      result.push(<span key={`d${oi}`} className="bg-red-500/20 text-red-400 line-through text-micro">{origWords[oi]}</span>)
      oi++
    }
  }
  return <span>{result}</span>
}

// ============================================================================
// FILTRO STRINGHE CODICE — non traducibili
// ============================================================================

function isCodeString(value: string): boolean {
  const v = value.trim()
  if (v.length <= 1) return true
  // Solo numeri, punteggiatura, simboli
  if (/^[\d\s.,;:!?%+\-*/=<>()[\]{}#@&|^~`]+$/.test(v)) return true
  // Path di file / URL
  if (/^(https?:\/\/|www\.|[a-zA-Z]:\\|\/[\w/]|\.\.?\/)/.test(v)) return true
  // Variabili codice: $var, %var%, {var}, {{var}}, [var]
  if (/^[\$%{[\[][\w.]+[\]}%\]]?$/.test(v)) return true
  // Solo placeholder senza testo reale: {0} {name} %s %d
  if (/^(\{[\w.]+\}|%[sd]|%\d+\$[sd]|\$\w+)$/.test(v)) return true
  // Pattern codice: snake_case puro, camelCase puro senza spazi
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+){2,}$/i.test(v) && !v.includes(' ')) return true
  // Estensioni file
  if (/^\*?\.\w{1,5}$/.test(v)) return true
  // Regex pattern
  if (/^\^.*\$$/.test(v) || /^\/.*\/[gimsuy]*$/.test(v)) return true
  // Codice puro: contiene => () {} ; senza parole leggibili
  if (/[=>{};]/.test(v) && !/[a-zA-Z]{3,}\s+[a-zA-Z]{3,}/.test(v)) return true
  // Hex color
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return true
  return false
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
  const { t } = useTranslation();
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
  const [translator, _setTranslator] = useState('')

  // Carica lingua target dalle settings
  useEffect(() => {
    const saved = localStorage.getItem('gameStringerSettings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.translation?.defaultTargetLang) setTargetLang(s.translation.defaultTargetLang);
      } catch {}
    }
  }, []);
  const [patchVersion, _setPatchVersion] = useState('1.0')
  const [useContextHarvest, setUseContextHarvest] = useState(true)

  // Translation state
  const [translatedStrings, setTranslatedStrings] = useState<Map<string, TranslatedString[]>>(new Map())
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const abortRef = useRef(false)
  const [stoppedByUser, setStoppedByUser] = useState(false)
  const [lastTranslatedPair, setLastTranslatedPair] = useState<{ original: string; translation: string; provider?: string } | null>(null)
  const [providerStats, setProviderStats] = useState<Record<string, { calls: number; success: number; totalMs: number }>>({})

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

  // Unity auto-install BepInEx state
  const [unityDetected, setUnityDetected] = useState(false)
  const [isIL2CPP, setIsIL2CPP] = useState(false)
  const [hasBepInExInstalled, setHasBepInExInstalled] = useState(false)
  const [xunityStringCount, setXunityStringCount] = useState(0)
  const [bepinexStatus, setBepinexStatus] = useState<'idle' | 'installing' | 'installed' | 'error' | 'needs_relaunch'>('idle')
  const [bepinexSteps, setBepinexSteps] = useState<string[]>([])
  const [bepinexError, setBepinexError] = useState<string | null>(null)

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

  const saveCheckpoint = useCallback(async (translated: Map<string, TranslatedString[]>) => {
    const key = getCheckpointKey()
    if (!key) return
    try {
      const data: Record<string, TranslatedString[]> = {}
      translated.forEach((v, k) => { data[k] = v })
      const totalDone = Object.values(data).reduce((s, arr) => s + arr.filter(t => t.translation).length, 0)
      await set(key, {
        data,
        gameId: gameInfo?.gameId,
        gameName: gameInfo?.gameName,
        targetLang,
        sourceLang,
        totalCount: totalStrings,
        translatedCount: totalDone,
        savedAt: Date.now(),
      })
      clientLogger.debug(`[Checkpoint] Salvato: ${totalDone} stringhe tradotte`)
    } catch (e: unknown) {
      clientLogger.warn('[Checkpoint] Errore salvataggio:', e)
    }
  }, [getCheckpointKey, gameInfo, targetLang, sourceLang, totalStrings])

  const loadCheckpoint = useCallback(async (): Promise<Map<string, TranslatedString[]> | null> => {
    const key = getCheckpointKey()
    if (!key) return null
    try {
      const saved = await get(key)
      if (!saved?.data) return null
      const map = new Map<string, TranslatedString[]>()
      for (const [k, v] of Object.entries(saved.data)) {
        map.set(k, v as TranslatedString[])
      }
      return map
    } catch { return null }
  }, [getCheckpointKey])

  const clearCheckpoint = useCallback(async () => {
    const key = getCheckpointKey()
    if (key) await del(key)
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
    ;(async () => {
      try {
        const saved = await get(key)
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
        } else {
          setSavedCheckpoint(null)
        }
      } catch { setSavedCheckpoint(null) }
    })()
  }, [gameInfo?.gameId, targetLang])

  // Cleanup test monitor on unmount
  useEffect(() => {
    return () => {
      if (testMonitorRef.current) { clearInterval(testMonitorRef.current); testMonitorRef.current = null }
    }
  }, [])

  // Timer per aggiornare stats live (elapsed, str/min, ETA) ogni secondo durante la traduzione
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isTranslating) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [isTranslating])

  // ============================================================================
  // SCAN FILE DAL PATH DEL GIOCO (via Tauri)
  // ============================================================================

  const scanGameFiles = useCallback(async (installPath: string) => {
    setIsLoadingGame(true)
    setGameError(null)
    setFiles([])

    try {
      // Step 0: Unity detection — redirect to Unity CSV Translator
      let isUnityGame = false
      try {
        isUnityGame = await invoke<boolean>('check_path_exists', { path: `${installPath}\\UnityPlayer.dll` })
      } catch {}
      if (!isUnityGame) {
        try {
          isUnityGame = installPath.includes('_Data') || 
            await invoke<boolean>('check_path_exists', { path: `${installPath}\\globalgamemanagers` })
        } catch {}
      }
      if (isUnityGame) {
        // Rileva IL2CPP (GameAssembly.dll) vs Mono
        let il2cpp = false
        try {
          il2cpp = await invoke<boolean>('check_path_exists', { path: `${installPath}\\GameAssembly.dll` })
        } catch {}
        // Rileva BepInEx già installato + stringhe catturate
        let hasBepInEx = false
        let stringCount = 0
        try {
          hasBepInEx = await invoke<boolean>('check_path_exists', { path: `${installPath}\\BepInEx` })
        } catch {}
        if (hasBepInEx) {
          try {
            const translations = await invoke<Record<string, string>>('extractXunityTranslations', { gamePath: installPath, targetLang: targetLang || 'it' })
            stringCount = Object.keys(translations || {}).length
          } catch {}
        }
        clientLogger.debug(`[AutoTranslate] Unity game detected (${il2cpp ? 'IL2CPP' : 'Mono'}, BepInEx: ${hasBepInEx}, strings: ${stringCount}) → showing Unity panel`)
        setIsLoadingGame(false)
        setGameError(null)
        setUnityDetected(true)
        setIsIL2CPP(il2cpp)
        setHasBepInExInstalled(hasBepInEx)
        setXunityStringCount(stringCount)
        return
      }

      // Step 1: scan_translatable_files (walkdir ricorsivo con estensioni note)
      clientLogger.debug('[AutoTranslate] Scanning:', installPath)
      let locFiles: string[] = []
      try {
        locFiles = await invoke<string[]>('scan_translatable_files', { gamePath: installPath })
        clientLogger.debug('[AutoTranslate] scan_translatable_files result:', locFiles?.length, 'files')
      } catch (e1) {
        clientLogger.warn('[AutoTranslate] scan_translatable_files failed:', e1)
        // Prova con snake_case (fallback per comandi senza rename_all)
        try {
          locFiles = await invoke<string[]>('scan_translatable_files', { game_path: installPath })
          clientLogger.debug('[AutoTranslate] scan_translatable_files (snake) result:', locFiles?.length, 'files')
        } catch (e2) {
          clientLogger.warn('[AutoTranslate] scan_translatable_files (snake) also failed:', e2)
        }
      }

      if (!locFiles || locFiles.length === 0) {
        // Step 2: fallback scan_localization_files
        clientLogger.debug('[AutoTranslate] No files from scan_translatable_files, trying scan_localization_files...')
        const fallbackExts = ['json', 'csv', 'po', 'pot', 'xlf', 'resx', 'strings', 'ini', 'xml', 'properties', 'yaml', 'yml', 'txt', 'lua', 'rpy', 'cfg', 'lang', 'loc', 'langdb', 'landb', 'dlog', 'ttarch', 'ttarch2']
        let allFiles: string[] = []
        try {
          const scanned = await invoke<{ path: string; name: string; size: number; extension: string }[]>(
            'scan_localization_files', { path: installPath, extensions: fallbackExts, maxDepth: 5 }
          )
          clientLogger.debug('[AutoTranslate] scan_localization_files result:', scanned?.length, 'files')
          allFiles = (scanned || []).map(f => f.path)
        } catch (e3) {
          clientLogger.warn('[AutoTranslate] scan_localization_files failed:', e3)
          // Ultimo fallback: sottocartelle comuni
          for (const subdir of ['localization', 'lang', 'languages', 'data', 'text', 'strings', 'www/data', 'game/tl', 'Pack']) {
            try {
              const subScanned = await invoke<{ path: string; name: string; size: number; extension: string }[]>(
                'scan_localization_files', { path: `${installPath}\\${subdir}`, extensions: fallbackExts, maxDepth: 3 }
              )
              if (subScanned?.length > 0) allFiles.push(...subScanned.map(f => f.path))
            } catch {}
          }
        }

        if (allFiles.length === 0) {
          // Rileva se è un gioco Unity
          let isUnity = false
          try {
            isUnity = await invoke<boolean>('check_path_exists', { path: `${installPath}\\UnityPlayer.dll` })
          } catch {}
          if (!isUnity) {
            try {
              const dlls = await invoke<{path: string; name: string; size: number; extension: string}[]>(
                'scan_localization_files', { path: installPath, extensions: ['dll'], maxDepth: 1 }
              )
              isUnity = (dlls || []).some(f => f.name === 'UnityPlayer.dll' || f.path.includes('_Data'))
            } catch {}
          }
          
          if (isUnity) {
            // Gioco Unity rilevato — rileva IL2CPP
            let il2cpp = false
            try {
              il2cpp = await invoke<boolean>('check_path_exists', { path: `${installPath}\\GameAssembly.dll` })
            } catch {}
            setUnityDetected(true)
            setIsIL2CPP(il2cpp)
            setGameError(null)
          } else {
            setGameError('No translatable files found for this game.')
          }
          setIsLoadingGame(false)
          return
        }

        await loadFilesFromPaths(allFiles, installPath)
      } else {
        await loadFilesFromPaths(locFiles, installPath)
      }
    } catch (err: unknown) {
      clientLogger.error('[AutoTranslate] Scan TOTALMENTE fallito:', err)
      setGameError(`Automatic scan failed: ${err instanceof Error ? err.message : String(err)}. You can load files manually.`)
    } finally {
      setIsLoadingGame(false)
    }
  }, [])

  // ============================================================================
  // AUTO-INSTALL BepInEx + XUnity AutoTranslator (per giochi Unity)
  // ============================================================================

  const installBepInEx = useCallback(async () => {
    if (!gameInfo?.installPath) return
    const installPath = gameInfo.installPath

    setBepinexStatus('installing')
    setBepinexSteps([])
    setBepinexError(null)

    try {
      // 1. Trova l'exe del gioco nella cartella di installazione
      setBepinexSteps(prev => [...prev, 'Ricerca eseguibile del gioco...'])
      let gameExeName = ''

      try {
        const exeFiles = await invoke<{ path: string; name: string; size: number; extension: string }[]>(
          'scan_localization_files', { path: installPath, extensions: ['exe'], maxDepth: 1 }
        )
        // Cerca l'exe principale (esclude UnityCrashHandler, installer, ecc.)
        const excluded = ['unitycrashandler', 'ue4prereqsetup', 'uninstall', 'crashhandler', 'launcher']
        const mainExe = (exeFiles || []).find(f => {
          const name = f.name.toLowerCase()
          return !excluded.some(ex => name.includes(ex))
        })
        if (mainExe) {
          gameExeName = mainExe.name
        }
      } catch {}

      if (!gameExeName) {
        // Fallback: usa il nome del gioco + .exe
        const gameName = gameInfo.gameName?.replace(/[^a-zA-Z0-9]/g, '') || 'Game'
        gameExeName = `${gameName}.exe`
        setBepinexSteps(prev => [...prev, `⚠ Exe non trovato, provo con: ${gameExeName}`])
      } else {
        setBepinexSteps(prev => [...prev, `✓ Trovato: ${gameExeName}`])
      }

      // 2. Chiama install_unity_autotranslator
      setBepinexSteps(prev => [...prev, 'Installazione BepInEx + XUnity AutoTranslator...'])
      
      const result = await invoke<{ success: boolean; message: string; steps_completed: string[] }>(
        'install_unity_autotranslator', {
          gamePath: installPath,
          gameExeName: gameExeName,
          targetLang: targetLang,
          translationMode: 'google',
        }
      )

      if (result.steps_completed) {
        setBepinexSteps(prev => [...prev, ...result.steps_completed])
      }

      if (result.success) {
        setBepinexSteps(prev => [...prev, '', '🎉 Installazione completata!', '📌 Ora avvia il gioco UNA VOLTA per generare i file di traduzione.', '📌 Poi torna qui e clicca "Ri-Scansiona" per trovare i nuovi file.'])
        setBepinexStatus('installed')
      } else {
        setBepinexError(result.message || 'Installazione fallita')
        setBepinexStatus('error')
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setBepinexError(errMsg)
      setBepinexSteps(prev => [...prev, `❌ Errore: ${errMsg}`])
      setBepinexStatus('error')
    }
  }, [gameInfo, targetLang])

  const rescanAfterBepInEx = useCallback(async () => {
    if (!gameInfo?.installPath) return
    setUnityDetected(false)
    setIsIL2CPP(false)
    setHasBepInExInstalled(false)
    setXunityStringCount(0)
    setBepinexStatus('idle')
    setBepinexSteps([])
    setBepinexError(null)
    await scanGameFiles(gameInfo.installPath)
  }, [gameInfo, scanGameFiles])

  const loadFilesFromPaths = async (filePaths: string[], basePath: string) => {
    // Filtra solo file veramente inutili (Manifest UE engine, log, ecc.)
    const excludedPatterns = [
      /Manifest_DebugFiles.*\.txt$/i,
      /Manifest_NonUFSFiles.*\.txt$/i,
      /Manifest_UFSFiles.*\.txt$/i,
      /[/\\]monobleedingedge[/\\]/i,
      /[/\\]__pycache__[/\\]/i,
      /[/\\]node_modules[/\\]/i,
      /[/\\]python-packages[/\\]/i,
      /[/\\]dist-info[/\\]/i,
      /[/\\]renpy[/\\]/i,
      // Unity engine metadata — NOT translatable game text
      /RuntimeInitializeOnLoads\.json$/i,
      /ScriptingAssemblies\.json$/i,
      /UnitySubsystems.*\.json$/i,
      /boot\.config$/i,
      /globalgamemanagers$/i,
      /[/\\]Managed[/\\]/i,
      /[/\\]Mono[/\\]/i,
      /[/\\]Resources[/\\]unity_builtin/i,
    ]
    const binaryExts = /\.(ogg|mp3|wav|flac|aac|wma|png|jpg|jpeg|gif|bmp|webp|svg|tga|dds|ico|mp4|avi|mkv|webm|mov|exe|dll|so|dylib|pdb|zip|rar|7z|gz|tar|ttf|otf|woff|woff2|rpyc|pyc|pyo)$/i
    // Ren'Py: .rpy in images/, audio/, screens/, displayables/, tl/ contengono definizioni risorse/UI o traduzioni esistenti
    const renpyResourceDirs = /[/\\](images|audio|screens|displayables|tl)[/\\].*\.rpy$/i
    const filtered = filePaths.filter(fp => !excludedPatterns.some(rx => rx.test(fp)) && !binaryExts.test(fp) && !renpyResourceDirs.test(fp))
    clientLogger.debug(`[AutoTranslate] loadFilesFromPaths: ${filePaths.length} trovati, ${filtered.length} dopo filtro`)
    const loaded: LoadedFile[] = []

    // Lettura parallela con concurrency 10 (invece di sequenziale)
    const toRead = filtered.slice(0, 50)
    const CONCURRENCY = 10
    const processFile = async (filePath: string): Promise<LoadedFile | null> => {
      try {
        const content = await invoke<string>('read_text_file', { path: filePath })
        if (!content || content.length < 5) return null

        const fileName = filePath.replace(basePath, '').replace(/^[/\\]+/, '')
        const format = detectFormat(content, fileName)
        const parsed = parseFile(content, fileName)

        const lowerName = fileName.toLowerCase()
        const isLikelyConfig = /[/\\](config|settings|chunk_map|preferences|\.config)\.json$/i.test(lowerName)
        if (isLikelyConfig && parsed.strings.length < 20) return null

        if (lowerName.endsWith('.rpy')) {
          const lines = content.split('\n').filter((l: string) => l.trim() && !l.trim().startsWith('#'))
          const resourceLines = lines.filter((l: string) => /^\s*(define\s+\w+\s*=\s*(im\.Scale|'audio|"audio)|image\s+\w+)/.test(l))
          if (resourceLines.length > 0 && resourceLines.length >= lines.length * 0.6) return null
        }

        if (parsed.strings.length > 0) {
          return { name: fileName, content, format, parsed, size: content.length }
        }
        return null
      } catch { return null }
    }

    for (let i = 0; i < toRead.length; i += CONCURRENCY) {
      const chunk = toRead.slice(i, i + CONCURRENCY)
      const results = await Promise.all(chunk.map(processFile))
      for (const r of results) { if (r) loaded.push(r) }
    }
    clientLogger.debug(`[AutoTranslate] ⚡ ${toRead.length} file letti in parallelo (batch ${CONCURRENCY})`)

    if (loaded.length > 0) {
      setFiles(loaded)
      clientLogger.debug(`[AutoTranslate] ✅ Caricati ${loaded.length} file, ${loaded.reduce((s, f) => s + f.parsed.strings.length, 0)} stringhe totali`)
    } else {
      clientLogger.warn('[AutoTranslate] ⚠️ Nessun file con stringhe traducibili')
      setGameError('No files with translatable strings found. You can load files manually.')
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
    clientLogger.debug('[AutoTranslate] Stop richiesto dall\'utente')
  }, [])

  const handleStartTranslation = useCallback(async (resumeFromCheckpoint = false) => {
    if (files.length === 0) return

    abortRef.current = false
    setStoppedByUser(false)
    setLastTranslatedPair(null)
    setProviderStats({})
    setStep('translating')
    setIsTranslating(true)
    const startTime = Date.now()
    const errors: string[] = []
    const totalStrCount = files.reduce((s, f) => s + f.parsed.strings.length, 0)
    let globalTranslated = 0
    let consecutiveFailedBatches = 0

    // Carica checkpoint esistente se si riprende
    let allTranslated: Map<string, TranslatedString[]>
    const existingKeys = new Set<string>()
    if (resumeFromCheckpoint) {
      const loaded = await loadCheckpoint()
      allTranslated = loaded || new Map()
      // Raccogli chiavi già tradotte
      allTranslated.forEach((arr) => {
        arr.forEach(t => { if (t.translation) existingKeys.add(t.key) })
      })
      globalTranslated = existingKeys.size
      clientLogger.debug(`[Resume] Ripresa da checkpoint: ${existingKeys.size} stringhe già tradotte`)
    } else {
      allTranslated = new Map()
      await clearCheckpoint()
    }

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi]
      const strings = file.parsed.strings
      if (strings.length === 0) continue

      // Se il file è già completamente tradotto nel checkpoint, salta
      const existingFile = allTranslated.get(file.name)
      if (existingFile && existingFile.length === strings.length && existingFile.every(t => t.translation)) {
        globalTranslated = Math.max(globalTranslated, existingFile.filter(t => t.translation).length + (globalTranslated - existingKeys.size))
        clientLogger.debug(`[Resume] File ${file.name} già completo, skip`)
        continue
      }

      // Reset contatore fallimenti per ogni nuovo file
      consecutiveFailedBatches = 0
      // Rimuovi entry vuote (tentativi falliti precedenti) per evitare duplicati al resume
      const fileTranslations: TranslatedString[] = existingFile ? existingFile.filter(t => t.translation) : []
      const alreadyDoneMap = new Map(fileTranslations.map(t => [t.key, t]))
      const batchSize = 20
      // Traduzione incrementale: rileva stringhe nuove O modificate rispetto al checkpoint
      const pendingStrings = strings.filter(s => {
        if (!s.value || s.value.trim().length === 0 || isCodeString(s.value)) return false
        const existing = alreadyDoneMap.get(s.key)
        if (!existing) return true // nuova stringa
        // Se il testo originale è cambiato (update del gioco), ri-traduci
        if (existing.original !== s.value) {
          // Rimuovi la vecchia traduzione obsoleta
          const idx = fileTranslations.findIndex(t => t.key === s.key)
          if (idx >= 0) fileTranslations.splice(idx, 1)
          return true
        }
        return false // già tradotta e invariata
      })
      if (pendingStrings.length === 0) {
        clientLogger.debug(`[Resume] File ${file.name}: tutte le stringhe già tradotte`)
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
          clientLogger.debug(`[AutoTranslate] Fermato dall'utente a ${globalTranslated} stringhe`)
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

          const batchStart = Date.now()
          const result = await translateSmart({
            texts: batchTexts, sourceLanguage: sourceLang,
            targetLanguage: targetLang, harvestedContext,
            gameId: gameInfo?.gameId,
          })
          const batchMs = Date.now() - batchStart

          // Aggiorna benchmark provider
          setProviderStats(prev => {
            const p = result.provider || 'unknown'
            const old = prev[p] || { calls: 0, success: 0, totalMs: 0 }
            return { ...prev, [p]: { calls: old.calls + 1, success: old.success + (result.success ? 1 : 0), totalMs: old.totalMs + batchMs } }
          })

          // Se il provider ha fallito completamente (success: false), auto-stop rapido
          if (!result.success) {
            consecutiveFailedBatches++
            clientLogger.warn(`[AutoTranslate] Batch fallito (${consecutiveFailedBatches}/3) — provider: ${result.provider}, success: false`)
            for (const s of batch) {
              fileTranslations.push({ key: s.key, original: s.value, translation: '', qaScore: 0, qaPassed: false, isEdited: false })
              globalTranslated++
            }
            if (consecutiveFailedBatches >= 3) {
              errors.push('Tutti i provider di traduzione sono bloccati o non configurati. Traduzione fermata automaticamente.')
              abortRef.current = true
              clientLogger.error('[AutoTranslate] Auto-stop: 3 batch consecutivi senza traduzioni')
            }
          } else {
            let batchHasOutput = 0
            // Risposte spazzatura note da MyMemory e altri provider gratuiti
            const garbageResponses = /^(NO QUERY SPECIFIED|PLEASE SELECT TWO LANGUAGES|QUERY LENGTH LIMIT|MYMEMORY WARNING|YOU USED ALL AVAILABLE FREE)/i
            for (let si = 0; si < batch.length; si++) {
              const original = batch[si].value
              const rawTranslation = result.translations[si] || ''
              const translation = garbageResponses.test(rawTranslation) ? '' : rawTranslation
              const hasOutput = !!translation // provider ha restituito qualcosa (anche se uguale all'originale: nomi, numeri)
              const isChanged = translation && translation !== original
              if (hasOutput) batchHasOutput++
              let qaReport: QualityReport | undefined
              let qaScore = hasOutput ? (isChanged ? 100 : 95) : 0, qaPassed = hasOutput
              if (isChanged) {
                try {
                  qaReport = runQualityGates({ sourceText: original, translatedText: translation, targetLanguage: targetLang })
                  qaScore = qaReport.overallScore; qaPassed = qaReport.passed
                } catch {}
              }
              fileTranslations.push({ key: batch[si].key, original, translation: hasOutput ? translation : '', qaScore, qaPassed, qaReport, isEdited: false })
              globalTranslated++
            }
            // Auto-stop solo se il provider non restituisce NULLA (tutte le traduzioni vuote)
            if (batchHasOutput === 0) {
              consecutiveFailedBatches++
              clientLogger.warn(`[AutoTranslate] Batch con 0 output (${consecutiveFailedBatches}/5) — provider: ${result.provider}`)
              if (consecutiveFailedBatches >= 5) {
                errors.push('Tutti i provider di traduzione sono bloccati o non configurati. Traduzione fermata automaticamente.')
                abortRef.current = true
                clientLogger.error('[AutoTranslate] Auto-stop: 5 batch consecutivi senza output')
              }
            } else {
              consecutiveFailedBatches = 0
              // Aggiorna preview ultima traduzione per UI demo
              const lastGood = fileTranslations.filter(t => t.translation).slice(-1)[0]
              if (lastGood) setLastTranslatedPair({ original: lastGood.original, translation: lastGood.translation, provider: result.provider })
            }
          }
        } catch (err: unknown) {
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
    setProgress(prev => prev ? { ...prev, percent: wasStopped ? Math.round((actualTranslated / totalStrCount) * 100) : 100, currentStep: wasStopped ? `Stopped — ${actualTranslated} strings saved` : 'Completed!' } : null)
    setIsTranslating(false)
    if (files.length > 0) setSelectedFile(files[0].name)
    // Notifica OS traduzione completata/fermata
    try {
      await invoke('notify_background_operation_completed', {
        operationType: 'translation',
        operationId: gameInfo?.gameId || 'auto-translate',
        success: !wasStopped,
        details: wasStopped
          ? `Translation paused: ${actualTranslated}/${totalStrCount} strings (${Math.round((actualTranslated / totalStrCount) * 100)}%)`
          : `Translation completed: ${actualTranslated} strings translated for ${gameTitle}`,
      })
    } catch {}
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
        } catch (err: unknown) {
          clientLogger.warn(`[RetranslateUntranslated] Batch error:`, err)
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
        const isRenpy = file.format === 'rpy'
        for (const s of strings) {
          const final = s.isEdited ? (s.editedTranslation || s.translation) : s.translation
          if (final) {
            if (isRenpy) {
              // Per Ren'Py: solo original→translated (per formato old/new nativo)
              translationMap.set(s.original, final)
            } else {
              translationMap.set(s.key, final)
              if (s.original !== s.key) translationMap.set(s.original, final)
            }
          }
        }
        return { filename: file.name, originalContent: file.content, translations: translationMap, format: file.format }
      })
      const result = generatePatch(patchInputs, {
        projectName: `${gameTitle} - ${targetLang.toUpperCase()}`, gameTitle: gameTitle || 'Game Translation',
        sourceLanguage: sourceLang, targetLanguage: targetLang, translator: translator || 'GameStringer User',
        version: patchVersion, description: 'Automatic translation with GameStringer One-Click',
        qualityScore: avgScore, includeReadme: true, includeManifest: true,
      })
      setPatchResult(result)
    } catch (err: unknown) { clientLogger.error('[Patch] Error:', err) }
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
        clientLogger.debug('[ZIP] Salvato su Desktop:', fullPath)
        alert(`ZIP salvato sul Desktop:\n${fullPath}`)
        return
      } catch (tauriErr) {
        clientLogger.debug('[ZIP] Tauri non disponibile, fallback browser:', tauriErr)
      }

      // Fallback browser
      downloadBlob(blob, filename)
    } catch (err: unknown) { clientLogger.error('[ZIP] Error:', err) }
  }, [patchResult, gameTitle, targetLang, patchVersion])

  // ============================================================================
  // TEST PATCH: backup → applica → lancia → monitora
  // ============================================================================

  const addTestLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setTestPatchLogs(prev => [...prev, `[${ts}] ${msg}`])
    clientLogger.debug(`[TestPatch] ${msg}`)
  }, [])

  // Rileva se il gioco è Unreal Engine (controlla se esiste una sottocartella con Content/Paks)
  const isUnrealEngine = useCallback((_installPath: string): boolean => {
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
      } catch (err: unknown) {
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
          clientLogger.warn('[TestPatch] translation_session.json non trovato, fallback a translatedStrings:', sessionErr)
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
      } catch (err: unknown) {
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
          } catch (err: unknown) {
            addTestLog(`❌ Errore backup ${file.path}: ${err}`)
            setTestPatchStatus('error')
            return
          }
        }
        setTestBackupPaths(new Map(backups))
        addTestLog(`Backup completato: ${backups.size} file salvati`)
      } catch (err: unknown) {
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
          } catch (err: unknown) {
            addTestLog(`❌ Errore scrittura ${file.path}: ${err}`)
            setTestPatchStatus('error')
            return
          }
        }
        setTestPatchApplied(true)
        addTestLog('Patch applicata con successo!')
      } catch (err: unknown) {
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
    } catch (err: unknown) {
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
      } catch (err: unknown) {
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
        } catch (err: unknown) {
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
    setUnityDetected(false); setBepinexStatus('idle'); setBepinexSteps([]); setBepinexError(null)
  }, [])

  // ============================================================================
  // STEP INDICATOR
  // ============================================================================

  const wizardSteps: { id: WizardStep; label: string; icon: unknown }[] = [
    { id: 'select_game', label: t('autoTranslatePage.selectGame'), icon: Gamepad2 },
    { id: 'translating', label: t('autoTranslatePage.translating'), icon: Sparkles },
    { id: 'review', label: t('autoTranslatePage.toReview'), icon: Eye },
    { id: 'patch', label: t('autoTranslatePage.patchReady'), icon: Package },
  ]
  const stepOrder: WizardStep[] = ['select_game', 'translating', 'review', 'patch']
  const currentStepIndex = stepOrder.indexOf(step)

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gameInfo?.gameId && (
              <button
                onClick={() => window.location.href = `/library/?id=${gameInfo.gameId}&name=${encodeURIComponent(gameInfo.gameName || '')}&platform=${encodeURIComponent(gameInfo.platform || '')}&headerImage=${encodeURIComponent(gameInfo.gameImage || '')}`}
                className="p-2 rounded-lg bg-black/30 border border-white/10 hover:bg-white/10 transition-colors"
                title={t('common.back')}
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            )}
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('autoTranslatePage.heroTitle')}</h1>
              <p className="text-white/70 text-sm">
                {gameInfo ? `${gameInfo.gameName}` : t('autoTranslatePage.heroSubtitle')}
              </p>
            </div>
          </div>
          {step !== 'select_game' && (
            <Button variant="outline" size="sm" onClick={handleReset}
              className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
              <RefreshCw className="h-3 w-3 mr-1" /> Restart
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
                      <h3 className="text-sm font-semibold text-amber-200">{t('autoTranslatePage.progressFound')}</h3>
                      <p className="text-xs text-amber-300/70 mt-0.5">
                        {savedCheckpoint.translatedCount}/{savedCheckpoint.totalCount} strings already translated
                        ({savedCheckpoint.targetLang.toUpperCase()})
                        — saved on {new Date(savedCheckpoint.savedAt).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="xs" className="text-xs bg-amber-600 hover:bg-amber-700" onClick={handleResumeTranslation}>
                        <Eye className="h-3 w-3 mr-1" /> Review
                      </Button>
                      <Button size="xs" className="text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStartTranslation(true)}>
                        <Play className="h-3 w-3 mr-1" /> Resume
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/20" onClick={clearCheckpoint}>
                        <XCircle className="h-3 w-3 mr-1" /> Restart
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Game Card (se selezionato) */}
            {gameInfo && (
              <Card className="bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-violet-500/10 border-purple-500/30 overflow-hidden">
                <CardContent className="p-5 flex items-center gap-5">
                  {gameInfo.gameImage && (
                    <img src={gameInfo.gameImage} alt={gameInfo.gameName} className="w-32 h-[72px] object-cover rounded-lg shadow-lg" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold tracking-tight">{gameInfo.gameName}</h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      {gameInfo.platform && <Badge variant="outline" className="text-2xs h-5 px-2">{gameInfo.platform}</Badge>}
                      <span className="font-mono text-2xs truncate max-w-[350px] opacity-60">{gameInfo.installPath}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {isLoadingGame ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Scanning files...
                      </div>
                    ) : files.length > 0 ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 justify-end">
                          <FileText className="h-4 w-4 text-emerald-400" />
                          <span className="text-2xl font-black text-emerald-400">{files.length}</span>
                          <span className="text-xs text-muted-foreground">files</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Languages className="h-4 w-4 text-violet-400" />
                          <span className="text-2xl font-black text-violet-400">{totalStrings.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">strings</span>
                        </div>
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
                  <h2 className="text-lg font-bold">{t('autoTranslatePage.selectGame')}</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Go to the <strong>{t('nav.library')}</strong>, open a game and click <strong>&quot;Translate All&quot;</strong>. Game files will be loaded automatically.
                  </p>
                  <Separator className="my-4" />
                  <p className="text-xs text-muted-foreground">{t('autoTranslatePage.orLoadManually')}</p>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" /> Load Files
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".json,.csv,.po,.pot,.xlf,.xliff,.resx,.strings,.ini,.xml,.properties,.yaml,.yml,.txt" multiple onChange={handleManualUpload} className="hidden" />
                </CardContent>
              </Card>
            )}

            {/* Errore scan (non-Unity) + suggerimento Binary Patcher */}
            {gameError && !unityDetected && (
              <div className="space-y-2">
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="p-3 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs whitespace-pre-line">{gameError}</p>
                    </div>
                  </CardContent>
                </Card>
                {/* Suggerimento Binary Patcher */}
                <Card className="border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-colors cursor-pointer"
                  onClick={() => {
                    const p = new URLSearchParams();
                    if (gameInfo?.gameName) p.set('game', gameInfo.gameName);
                    if (gameInfo?.installPath) p.set('path', gameInfo.installPath);
                    window.location.href = `/binary-patcher?${p.toString()}`;
                  }}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-1.5 bg-orange-500/20 rounded-md">
                      <Binary className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-orange-300">{t('autoTranslatePage.tryBinaryPatcher')}</p>
                      <p className="text-2xs text-orange-300/60">Per giochi con engine custom, il testo potrebbe essere dentro il .exe o .dll. Il Binary Patcher lo estrae e traduce direttamente.</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-orange-400/60" />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Unity rilevato → Smart Auto-Select Panel */}
            {unityDetected && (
              <Card className={cn("border-orange-500/30", isIL2CPP ? "bg-amber-500/5" : hasBepInExInstalled ? "bg-emerald-500/5" : "bg-orange-500/5")}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-400" />
                    Unity {isIL2CPP ? '(IL2CPP)' : '(Mono)'} detected
                    {hasBepInExInstalled && !isIL2CPP && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-2xs ml-1">BepInEx installato</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isIL2CPP 
                      ? 'Questo gioco usa IL2CPP — i testi sono dentro gli asset binari Unity. Usa il Unity CSV Translator per scansionare, tradurre e iniettare le traduzioni con Resize Injection (zero troncamento).'
                      : hasBepInExInstalled && xunityStringCount > 0
                        ? `BepInEx è già installato con ${xunityStringCount} stringhe catturate. Puoi tradurle con AI oppure usare il Unity CSV Translator per una copertura completa.`
                        : hasBepInExInstalled
                          ? 'BepInEx è installato ma non ci sono ancora stringhe catturate. Avvia il gioco per catturarle, oppure usa il Unity CSV Translator per tradurre tutto subito.'
                          : 'Metodo consigliato: Unity CSV Translator — inietta le traduzioni direttamente negli asset binari Unity con copertura completa e zero troncamento.'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {/* IL2CPP Warning */}
                  {isIL2CPP && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-300">BepInEx non compatibile</p>
                        <p className="text-2xs text-amber-300/70 mt-0.5">
                          I giochi Unity IL2CPP non supportano BepInEx 5.x + XUnity AutoTranslator. L&apos;installazione causerebbe crash all&apos;avvio del gioco.
                          Usa il <strong>Unity CSV Translator</strong> che inietta le traduzioni direttamente negli asset binari.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* BepInEx già installato con stringhe catturate */}
                  {hasBepInExInstalled && !isIL2CPP && xunityStringCount > 0 && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-emerald-300">{xunityStringCount} stringhe catturate da XUnity</p>
                        <p className="text-2xs text-emerald-300/70 mt-0.5">
                          Le stringhe sono in <code className="text-micro bg-white/5 px-1 rounded">BepInEx/Translation/</code>. 
                          Per qualità migliore, usa il <strong>Unity CSV Translator</strong> che traduce <em>tutte</em> le stringhe (non solo quelle apparse a schermo).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Primary: Unity CSV Translator — SEMPRE visibile, consigliato */}
                  <div className="space-y-1.5">
                    <p className="text-2xs font-medium text-orange-300/80 uppercase tracking-wider">Metodo consigliato</p>
                    <Button 
                      onClick={() => {
                        if (gameInfo?.installPath) {
                          sessionStorage.setItem('unityCsvGamePath', gameInfo.installPath)
                        }
                        window.location.href = '/unity-csv-translator'
                      }} 
                      size="sm" className="h-9 w-full bg-orange-600 hover:bg-orange-500 gap-2"
                    >
                      <Globe className="h-4 w-4" />
                      Apri Unity CSV Translator
                    </Button>
                    <p className="text-2xs text-muted-foreground">
                      Scansiona tutti gli asset, traduce con AI (Gemini/Claude) e inietta le traduzioni con Resize Injection. Copertura completa, zero troncamento.
                    </p>
                  </div>

                  {/* Secondary: BepInEx option — SOLO per Mono, nascosto per IL2CPP */}
                  {!isIL2CPP && (
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-2xs text-muted-foreground/80 mb-2">
                      {hasBepInExInstalled 
                        ? 'Oppure continua con BepInEx + XUnity (traduzione live durante il gameplay):'
                        : 'Alternativa: BepInEx + XUnity AutoTranslator (traduzione live, richiede di avviare il gioco):'
                      }
                    </p>
                  {/* Steps log */}
                  {bepinexSteps.length > 0 && (
                    <ScrollArea className="h-[160px] rounded border border-white/5 bg-black/20 p-2">
                      <div className="space-y-0.5 font-mono text-[11px]">
                        {bepinexSteps.map((s, i) => (
                          <p key={i} className={cn(
                            s.startsWith('✓') ? 'text-green-400' :
                            s.startsWith('❌') ? 'text-red-400' :
                            s.startsWith('⚠') ? 'text-yellow-400' :
                            s.startsWith('🎉') || s.startsWith('📌') ? 'text-blue-300 font-semibold' :
                            'text-muted-foreground'
                          )}>{s}</p>
                        ))}
                        {bepinexStatus === 'installing' && (
                          <p className="text-blue-400 animate-pulse">⏳ Installazione in corso...</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Errore BepInEx */}
                  {bepinexError && (
                    <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                      {bepinexError}
                    </div>
                  )}

                  {/* Azioni BepInEx */}
                  <div className="flex items-center gap-2">
                    {bepinexStatus === 'idle' && !hasBepInExInstalled && (
                      <Button onClick={installBepInEx} variant="outline" size="xs" className="text-xs">
                        <Download className="h-3 w-3 mr-1" />
                        Install BepInEx + XUnity
                      </Button>
                    )}
                    {bepinexStatus === 'idle' && hasBepInExInstalled && (
                      <Button onClick={rescanAfterBepInEx} variant="outline" size="xs" className="text-xs">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Ri-Scansiona stringhe XUnity
                      </Button>
                    )}
                    {bepinexStatus === 'installing' && (
                      <Button disabled size="xs" className="text-xs">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Installing...
                      </Button>
                    )}
                    {(bepinexStatus === 'installed' || bepinexStatus === 'error') && (
                      <Button onClick={rescanAfterBepInEx} variant="outline" size="xs" className="text-xs">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Re-Scan files
                      </Button>
                    )}
                    {bepinexStatus === 'error' && (
                      <Button onClick={installBepInEx} variant="outline" size="sm" className="h-8">
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Retry
                      </Button>
                    )}
                  </div>

                  {/* Credits */}
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-2xs text-muted-foreground/60">
                      Powered by <a href="https://github.com/BepInEx/BepInEx" target="_blank" rel="noopener" className="text-blue-400/70 hover:text-blue-400 underline">BepInEx</a> (BepInEx Team) 
                      {' '}&amp;{' '}
                      <a href="https://github.com/bbepis/XUnity.AutoTranslator" target="_blank" rel="noopener" className="text-blue-400/70 hover:text-blue-400 underline">XUnity.AutoTranslator</a> (bbepis).
                      {' '}Thanks to the original authors for their incredible open-source work.
                    </p>
                  </div>
                  </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* File trovati + Config */}
            {files.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* File list */}
                <Card className="lg:col-span-2">
                  <CardHeader className="py-2.5 px-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{files.length} translatable files</span>
                      <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-xs">{totalStrings.toLocaleString()} strings</Badge>
                    </CardTitle>
                  </CardHeader>
                  <ScrollArea className="h-[220px]">
                    <CardContent className="px-4 pb-3 space-y-1">
                      {files.map((f, i) => {
                        const pct = totalStrings > 0 ? (f.parsed.strings.length / totalStrings) * 100 : 0
                        const sizeKB = (f.size / 1024).toFixed(0)
                        return (
                          <div key={i} className="relative flex items-center justify-between p-2 rounded bg-muted/30 text-xs overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-primary/8 rounded" style={{ width: `${pct}%` }} />
                            <div className="flex items-center gap-2 relative z-10">
                              <FileText className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                              <span className="font-mono truncate max-w-[280px]">{f.name}</span>
                              <Badge variant="outline" className="text-micro px-1.5 h-4">{f.format}</Badge>
                              <span className="text-2xs text-muted-foreground/50">{sizeKB} KB</span>
                            </div>
                            <span className="font-bold tabular-nums relative z-10">{f.parsed.strings.length.toLocaleString()}</span>
                          </div>
                        )
                      })}
                    </CardContent>
                  </ScrollArea>
                </Card>

                {/* Config compatto */}
                <Card>
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <Languages className="h-3.5 w-3.5" /> Language & Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-2xs">{t('autoTranslatePage.from')}</Label>
                        <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}
                          className="w-full h-7 text-xs bg-background border rounded px-2 mt-0.5">
                          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-2xs">To</Label>
                        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                          className="w-full h-7 text-xs bg-background border rounded px-2 mt-0.5">
                          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between">
                            <Label className="text-2xs cursor-help">{t('nav.contextHarvester')}</Label>
                            <Switch checked={useContextHarvest} onCheckedChange={setUseContextHarvest} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[220px] text-xs">
                          <p>Analizza automaticamente il contesto di ogni stringa (schermata, speaker, tono) per migliorare la qualità della traduzione AI.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      onClick={() => handleStartTranslation(false)}
                      disabled={files.length === 0 || isTranslating}
                      className="w-full h-10 text-sm font-bold bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Translate {totalStrings} strings
                    </Button>
                    <p className="text-2xs text-muted-foreground text-center">
                      Estimation: ~{(() => { const s = Math.ceil(totalStrings / 20 * 3); return s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s` })()}
                      {' '}({Math.ceil(totalStrings / 20)} batches)
                    </p>
                  </CardContent>
                </Card>

                {/* Suggerimento Binary Patcher quando poche stringhe */}
                {totalStrings > 0 && totalStrings < 30 && (
                  <Card className="border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-colors cursor-pointer"
                    onClick={() => {
                      const p = new URLSearchParams();
                      if (gameInfo?.gameName) p.set('game', gameInfo.gameName);
                      if (gameInfo?.installPath) p.set('path', gameInfo.installPath);
                      window.location.href = `/binary-patcher?${p.toString()}`;
                    }}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-1.5 bg-orange-500/20 rounded-md flex-none">
                        <Binary className="h-4 w-4 text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-orange-300">{t('autoTranslatePage.fewStrings')}</p>
                        <p className="text-2xs text-orange-300/60">Il testo di gioco potrebbe essere dentro il .exe o .dll. Il Binary Patcher lo estrae e traduce direttamente dal binario.</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-orange-400/60 flex-none" />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2: TRANSLATING */}
        {/* ================================================================ */}
        {step === 'translating' && progress && (() => {
          const elapsedSec = Math.max(1, (Date.now() - progress.startTime) / 1000)
          const strPerMin = progress.translatedStrings > 0 ? Math.round(progress.translatedStrings / elapsedSec * 60) : 0
          const remaining = strPerMin > 0 ? Math.max(0, Math.ceil((progress.totalStrings - progress.translatedStrings) / strPerMin)) : null
          const elapsedMin = Math.floor(elapsedSec / 60)
          const elapsedSecRem = Math.floor(elapsedSec % 60)
          return (
          <div className="max-w-3xl mx-auto space-y-4 py-6">
            {/* Hero progress card */}
            <Card className="overflow-hidden border-primary/20">
              <div className="h-1.5 bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 transition-all duration-700 ease-out relative"
                  style={{ width: `${progress.percent}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse" />
                </div>
              </div>
              <CardContent className="p-6 space-y-5">
                {/* Header con percentuale grande */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                        <span className="text-2xl font-black bg-gradient-to-br from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                          {progress.percent}%
                        </span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Loader2 className="h-3 w-3 animate-spin text-primary-foreground" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">{t('autoTranslatePage.translating')}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{progress.currentStep}</p>
                    </div>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-9 px-5 text-xs font-semibold"
                    onClick={handleStopTranslation}
                    disabled={stoppedByUser}
                  >
                    {stoppedByUser ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Stopping...</>
                    ) : (
                      <><XCircle className="h-3.5 w-3.5 mr-1.5" /> Stop & Save</>
                    )}
                  </Button>
                </div>

                {/* Stats grid — 5 colonne */}
                <div className="grid grid-cols-5 gap-2">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums">{progress.translatedStrings.toLocaleString()}</div>
                    <div className="text-2xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                      <Languages className="h-3 w-3" /> of {progress.totalStrings.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums text-emerald-400">{strPerMin}</div>
                    <div className="text-2xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                      <Activity className="h-3 w-3" /> str/min
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums">{progress.currentFile}/{progress.totalFiles}</div>
                    <div className="text-2xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                      <FileText className="h-3 w-3" /> Files
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums">{elapsedMin > 0 ? `${elapsedMin}m${String(elapsedSecRem).padStart(2, '0')}s` : `${elapsedSecRem}s`}</div>
                    <div className="text-2xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                      <Timer className="h-3 w-3" /> Elapsed
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums text-violet-400">{remaining !== null ? `~${remaining}m` : '...'}</div>
                    <div className="text-2xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3" /> ETA
                    </div>
                  </div>
                </div>

                {/* Pipeline visuale */}
                <div className="flex items-center justify-center gap-1.5 py-1">
                  {[
                    { icon: Sparkles, label: 'Context', active: useContextHarvest },
                    { icon: Languages, label: 'AI Translate', active: true },
                    { icon: Shield, label: 'QA Check', active: true },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-medium transition-colors",
                        s.active ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
                      )}>
                        <s.icon className="h-3 w-3" />
                        <span>{s.label}</span>
                      </div>
                      {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                  ))}
                </div>

                {/* Live preview ultima traduzione */}
                {lastTranslatedPair && (
                  <div className="bg-gradient-to-r from-muted/60 to-muted/30 rounded-lg p-3 space-y-1.5 border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-medium text-muted-foreground">{t('autoTranslatePage.livePreview')}</span>
                      {lastTranslatedPair.provider && (
                        <Badge variant="outline" className="text-2xs h-4 px-1.5 border-primary/30 text-primary">{lastTranslatedPair.provider}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{lastTranslatedPair.original}</div>
                    <div className="text-sm font-medium truncate">{lastTranslatedPair.translation}</div>
                  </div>
                )}

                {/* Provider Benchmark */}
                {Object.keys(providerStats).length > 0 && (
                  <div className="bg-muted/20 rounded-lg p-2.5 border border-white/5">
                    <div className="text-2xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><Activity className="h-3 w-3" /> Provider Benchmark</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                      {Object.entries(providerStats).sort((a, b) => b[1].calls - a[1].calls).map(([name, s]) => {
                        const avgMs = s.calls > 0 ? Math.round(s.totalMs / s.calls) : 0
                        const rate = s.calls > 0 ? Math.round((s.success / s.calls) * 100) : 0
                        return (
                          <div key={name} className="flex items-center justify-between bg-background/40 rounded px-2 py-1">
                            <span className="text-micro font-mono truncate max-w-[80px]">{name}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={cn("text-2xs h-3.5 px-1", rate >= 90 ? "text-emerald-400 border-emerald-500/30" : rate >= 50 ? "text-yellow-400 border-yellow-500/30" : "text-red-400 border-red-500/30")}>{rate}%</Badge>
                              <span className="text-2xs text-muted-foreground tabular-nums">{avgMs}ms</span>
                              <span className="text-2xs text-muted-foreground/50">×{s.calls}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Errori */}
                {progress.errors.length > 0 && (
                  <div className="space-y-2">
                    {progress.errors.some(e => e.includes('translation providers are blocked') || e.includes('provider di traduzione sono bloccati')) ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-200">{t('autoTranslatePage.translationProvidersExhausted')}</p>
                            <p className="text-2xs text-amber-300/70 mt-1">
                              Free services (Lingva, MyMemory) have reached their request limit.
                              Translations completed so far have been saved.
                            </p>
                          </div>
                        </div>
                        <div className="bg-black/20 rounded p-2 space-y-1">
                          <p className="text-2xs font-medium text-amber-200/80">{t('autoTranslatePage.howToProceed')}</p>
                          <ul className="text-2xs text-amber-300/60 space-y-0.5 list-disc list-inside">
                            <li>{t('autoTranslatePage.wait25MinutesAndClick')}<strong>{t('autoTranslatePage.resume')}</strong> to continue</li>
                            <li>{t('autoTranslatePage.configureAnAiProviderGeminiDee')}<strong>{t('autoTranslatePage.settingsApiKeys')}</strong></li>
                            <li>{t('autoTranslatePage.install')}<strong>Ollama</strong> to translate offline without limits</li>
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

                <p className="text-2xs text-muted-foreground text-center">
                  Progress is saved automatically. You can resume at any time.
                </p>
              </CardContent>
            </Card>
          </div>
          )
        })()}

        {/* ================================================================ */}
        {/* STEP 3: REVIEW */}
        {/* ================================================================ */}
        {step === 'review' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <Card className="p-2.5"><div className="text-2xs text-muted-foreground">{t('autoTranslatePage.translated')}</div><div className="text-lg font-bold">{totalTranslated - untranslatedCount}</div></Card>
              <Card className="p-2.5"><div className="text-2xs text-muted-foreground">{t('autoTranslatePage.avgScore')}</div><div className={cn("text-lg font-bold", avgScore >= 80 ? "text-emerald-400" : avgScore >= 60 ? "text-yellow-400" : "text-red-400")}>{avgScore}%</div></Card>
              <Card className="p-2.5"><div className="text-2xs text-muted-foreground">{t('autoTranslatePage.toReview')}</div><div className="text-lg font-bold text-yellow-400">{issueCount}</div></Card>
              <Card className="p-2.5"><div className="text-2xs text-muted-foreground">{t('autoTranslatePage.edited')}</div><div className="text-lg font-bold text-blue-400">{editedCount}</div></Card>
              <Card className={cn("p-2.5", untranslatedCount > 0 ? "border-red-500/30 bg-red-500/5" : "")}>
                <div className="text-2xs text-muted-foreground">{t('autoTranslatePage.untranslated')}</div>
                <div className="text-lg font-bold text-red-400">{untranslatedCount}</div>
                {untranslatedCount > 0 && !isRetranslating && (
                  <Button size="sm" className="w-full h-6 text-micro mt-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" onClick={handleTranslateUntranslated}>
                    <Zap className="h-2.5 w-2.5 mr-0.5" /> Translate all
                  </Button>
                )}
                {isRetranslating && retranslateProgress && (
                  <div className="mt-1 space-y-0.5">
                    <Progress value={(retranslateProgress.done / retranslateProgress.total) * 100} className="h-1.5" />
                    <div className="text-2xs text-muted-foreground text-center">{retranslateProgress.done}/{retranslateProgress.total}</div>
                    <Button size="sm" variant="ghost" className="w-full h-5 text-2xs" onClick={() => { abortRef.current = true }}>
                      <XCircle className="h-2 w-2 mr-0.5" /> Stop
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleGeneratePatch} className="h-9 text-xs bg-gradient-to-r from-violet-500 to-indigo-500">
                <Package className="h-3.5 w-3.5 mr-1.5" /> Create Patch
              </Button>
              {gameInfo?.installPath && isUnrealEngine(gameInfo.installPath) && (
                <Button
                  onClick={handleTestPatch}
                  className="h-9 text-xs bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                  disabled={testPatchStatus !== 'idle' && testPatchStatus !== 'done' && testPatchStatus !== 'error'}
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" /> Test Patch
                </Button>
              )}
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
                    <span>{t('autoTranslatePage.testPatch')}</span>
                    <span className="text-muted-foreground font-normal">
                      — {testPatchStatus === 'backing_up' ? 'Cleaning previous patches...' : testPatchStatus === 'applying' ? 'Applying translations...' : testPatchStatus === 'launching' ? 'Launching game...' : testPatchStatus === 'monitoring' ? 'Running — check in-game' : testPatchStatus === 'restoring' ? 'Restoring originals...' : testPatchStatus === 'error' ? 'Error' : 'Completed'}
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
                    <div className="space-y-0.5 text-2xs font-mono">
                      {testPatchLogs.map((log, i) => (
                        <div key={i} className={cn("text-muted-foreground", log.includes('✅') && "text-emerald-400/80", log.includes('❌') && "text-red-400/80", log.includes('⚠️') && "text-yellow-400/80", log.includes('📦') && "text-violet-400/80")}>{log}</div>
                      ))}
                      <div ref={(el) => { el?.scrollIntoView({ behavior: 'smooth' }) }} />
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2">
                    {testPatchApplied && (testPatchStatus === 'monitoring' || testPatchStatus === 'done') && (
                      <>
                        <Button size="sm" variant="destructive" className="h-7 text-2xs" onClick={handleRestorePatch}>
                          <RotateCcw className="h-2.5 w-2.5 mr-1" /> Restore Originals
                        </Button>
                        <Button size="xs" className="text-2xs bg-emerald-600 hover:bg-emerald-700" onClick={handleKeepPatch}>
                          <Check className="h-2.5 w-2.5 mr-1" /> Keep Patch
                        </Button>
                      </>
                    )}
                    {testPatchStatus === 'error' && (
                      <Button size="sm" variant="outline" className="h-7 text-2xs" onClick={handleTestPatch}>
                        <RotateCcw className="h-2.5 w-2.5 mr-1" /> Retry
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <Card>
                <CardHeader className="py-2 px-3"><CardTitle className="text-xs">{t('autoTranslatePage.file')}</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {files.map(f => {
                    const fStrings = translatedStrings.get(f.name) || []
                    const fIssues = fStrings.filter(s => !s.qaPassed || s.qaScore < 70).length
                    return (
                      <div key={f.name} onClick={() => setSelectedFile(f.name)}
                        className={cn("p-2 rounded text-xs cursor-pointer transition-colors",
                          selectedFile === f.name ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50")}>
                        <div className="font-medium truncate">{f.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-2xs text-muted-foreground">
                          <span>{fStrings.length} strings</span>
                          {fIssues > 0 && <Badge variant="destructive" className="text-2xs h-3 px-1">{fIssues}</Badge>}
                        </div>
                      </div>
                    )
                  })}
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-2xs text-muted-foreground">{t('autoTranslatePage.filter')}</Label>
                    {(['all', 'issues', 'untranslated', 'edited'] as const).map(f => (
                      <Button key={f} variant={reviewFilter === f ? "default" : "ghost"} size="sm" className="w-full h-6 text-2xs justify-start" onClick={() => setReviewFilter(f)}>
                        {f === 'all' ? '📋 All' : f === 'issues' ? '⚠️ To review' : f === 'untranslated' ? `🔴 Untranslated (${untranslatedCount})` : '✏️ Edited'}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader className="py-2 px-4"><CardTitle className="text-xs">{selectedFile || 'Select a file'} ({filteredStrings.length})</CardTitle></CardHeader>
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
                              <div className="text-micro text-muted-foreground/60 font-mono truncate mb-0.5">{s.key}</div>
                              <div className="text-[11px] text-muted-foreground">{s.original}</div>
                              {isEditing ? (
                                <div className="mt-1 space-y-1">
                                  <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-xs min-h-[60px]" autoFocus />
                                  <div className="flex gap-1">
                                    <Button size="xs" className="text-2xs" onClick={handleEditSave}><Save className="h-2.5 w-2.5 mr-0.5" /> Save</Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-2xs" onClick={handleEditCancel}>{t("common.cancel")}</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs mt-0.5 flex items-start gap-1">
                                  {finalTranslation ? (
                                    <span className={s.isEdited ? "text-blue-400" : ""}><DiffHighlight original={s.original} translated={finalTranslation} /></span>
                                  ) : (
                                    <span className="text-red-400 italic">— untranslated —</span>
                                  )}
                                  {s.isEdited && <Badge className="text-2xs h-3 px-1 bg-blue-500/20 text-blue-400">edited</Badge>}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className={cn("text-micro px-1.5 py-0 h-4",
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
                        <p className="text-sm font-medium">{t('autoTranslatePage.allGood')}</p>
                        <p className="text-xs mt-1">{t('autoTranslatePage.noStringsToReview')}</p>
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
                <h2 className="text-lg font-bold">{t('autoTranslatePage.generatingPatch')}</h2>
              </Card>
            ) : patchResult ? (
              <>
                <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/30">
                  <CardContent className="p-6 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                    <h2 className="text-xl font-bold">{t('autoTranslatePage.patchReady')}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {patchResult.stats.translatedStrings}/{patchResult.stats.totalStrings} strings translated ({patchResult.stats.coveragePercent}%)
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                      <Button onClick={handleDownloadZip} size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-500">
                        <Download className="h-4 w-4 mr-2" /> Download ZIP
                      </Button>
                      <Button
                        onClick={handleTestPatch}
                        size="lg"
                        className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                        disabled={testPatchStatus !== 'idle' && testPatchStatus !== 'done' && testPatchStatus !== 'error'}
                      >
                        <Play className="h-4 w-4 mr-2" /> Test Patch
                      </Button>
                      <Button variant="outline" onClick={() => setStep('review')}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-3 text-center"><div className="text-2xl font-bold">{patchResult.stats.totalFiles}</div><div className="text-2xs text-muted-foreground">{t('autoTranslatePage.files')}</div></Card>
                  <Card className="p-3 text-center"><div className="text-2xl font-bold">{patchResult.stats.translatedStrings}</div><div className="text-2xs text-muted-foreground">{t('autoTranslatePage.strings')}</div></Card>
                  <Card className="p-3 text-center"><div className="text-2xl font-bold text-emerald-400">{patchResult.stats.coveragePercent}%</div><div className="text-2xs text-muted-foreground">{t('autoTranslatePage.coverage')}</div></Card>
                  <Card className="p-3 text-center"><div className="text-2xl font-bold text-blue-400">{avgScore}%</div><div className="text-2xs text-muted-foreground">{t('autoTranslatePage.quality')}</div></Card>
                </div>
                <Card className="border-dashed">
                  <CardHeader className="py-2 px-4"><CardTitle className="text-xs flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Export As (standard formats)</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 flex flex-wrap gap-2">
                    {(['TMX', 'XLIFF', 'PO'] as const).map(fmt => (
                      <Button key={fmt} variant="outline" size="xs" className="text-2xs" onClick={() => {
                        if (!patchResult) return
                        const tFiles: TranslatedFile[] = patchResult.files.filter(f => f.type === 'translated').map(f => ({
                          originalPath: f.path, relativePath: f.path, content: f.content,
                          format: f.path.split('.').pop() || 'txt', stringCount: 0,
                        }))
                        const meta: PatchMetadata = {
                          gameName: gameTitle || 'Game', sourceLanguage: sourceLang, targetLanguage: targetLang,
                          translatedBy: translator || 'GameStringer', createdAt: new Date().toISOString(),
                          version: patchVersion, totalStrings: patchResult.stats.translatedStrings,
                          totalFiles: patchResult.stats.totalFiles, provider: 'GameStringer AI',
                        }
                        const content = fmt === 'TMX' ? exportTMX(tFiles, meta) : fmt === 'XLIFF' ? exportXLIFF(tFiles, meta) : exportPO(tFiles, meta)
                        const ext = fmt === 'TMX' ? '.tmx' : fmt === 'XLIFF' ? '.xliff' : '.po'
                        const blob = new Blob([content], { type: 'text/xml;charset=utf-8' })
                        downloadBlob(blob, `${(gameTitle || 'translation').replace(/\s+/g, '_')}_${targetLang}${ext}`)
                      }}>
                        <Download className="h-2.5 w-2.5 mr-1" /> {fmt}
                      </Button>
                    ))}
                    <span className="text-micro text-muted-foreground self-center ml-1">{t('autoTranslatePage.compatibleWith')}</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-2 px-4"><CardTitle className="text-xs">Files in Patch ({patchResult.files.length})</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 space-y-1">
                    {patchResult.files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/30">
                        <div className="flex items-center gap-2"><FileText className="h-3 w-3 text-muted-foreground" /><span className="font-mono">{f.path}</span></div>
                        <Badge variant="outline" className="text-micro h-4 px-1">
                          {f.type === 'translated' ? '🎮 Translated' : f.type === 'readme' ? '📄 README' : f.type === 'manifest' ? '📋 Manifest' : f.type}
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
                          {testPatchStatus === 'error' && <><XCircle className="h-4 w-4 text-red-400" />{t('qaCheck.error')}</>}
                        </CardTitle>
                        {testPatchApplied && (
                          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-micro">
                            Patch attiva
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-3">
                      {/* Status pipeline */}
                      <div className="flex items-center justify-center gap-1 text-2xs">
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
                        <div className="p-2 space-y-0.5 font-mono text-2xs">
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
                        <p className="text-2xs text-center text-muted-foreground">
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
