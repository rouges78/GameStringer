"use client"

import { useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Wheat,
  Play,
  FileText,
  Upload,
  Download,
  Monitor,
  User,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Trash2,
  Copy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  harvestBatch,
  harvestContext,
  listHarvests,
  saveHarvest,
  deleteHarvest,
  loadHarvest,
  type HarvestInput,
  type HarvestedContext,
  type BatchHarvestResult,
  type ScreenType,
  type SpeakerType,
  type ToneType,
} from "@/lib/context-harvester"
import { useTranslation } from '@/lib/i18n';

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_STRINGS: HarvestInput[] = [
  { text: "New Game", key: "menu.new_game", filename: "mainmenu.json" },
  { text: "Continue", key: "menu.continue", filename: "mainmenu.json" },
  { text: "Settings", key: "menu.settings", filename: "mainmenu.json" },
  { text: "Exit", key: "menu.exit", filename: "mainmenu.json" },
  { text: "Guard: Stop right there! You're not allowed in this area.", key: "dlg_guard_01", filename: "dialogue/guard.json", gameGenre: "RPG" },
  { text: "What do you want?", key: "dlg_merchant_03", filename: "dialogue/merchant.json", gameGenre: "RPG" },
  { text: '"I knew you would come," the old wizard said with a knowing smile.', key: "story_ch3_02", filename: "narrative/chapter3.json", gameGenre: "RPG" },
  { text: "The ancient temple loomed before you, its crumbling walls whispering secrets of a forgotten age. Dark vines crept across the entrance, and a cold wind carried the scent of decay.", key: "narr_temple_01", filename: "narrative/locations.json", gameGenre: "RPG" },
  { text: "Attack", key: "combat.attack", filename: "combat_ui.json" },
  { text: "Defend", key: "combat.defend", filename: "combat_ui.json" },
  { text: "CRITICAL HIT!", key: "combat.critical", filename: "combat_ui.json" },
  { text: "You dealt {damage} damage to {enemy_name}!", key: "combat.damage_dealt", filename: "combat_ui.json" },
  { text: "Health Potion", key: "item.health_potion", filename: "items/consumables.json" },
  { text: "Restores 50 HP. A basic healing concoction brewed by village herbalists.", key: "item.health_potion_desc", filename: "items/consumables.json" },
  { text: "Iron Sword +2", key: "item.iron_sword_plus2", filename: "items/weapons.json" },
  { text: "Press {key_interact} to interact with objects", key: "tutorial.interact", filename: "tutorial.json" },
  { text: "Tip: Hold SHIFT to sprint", key: "tutorial.sprint_tip", filename: "tutorial.json" },
  { text: "Quest Updated: Find the Lost Artifact", key: "quest.artifact_update", filename: "quests/main.json" },
  { text: "Talk to the village elder", key: "quest.talk_elder", filename: "quests/main.json" },
  { text: "Game saved successfully!", key: "sys.saved", filename: "system.json" },
  { text: "Error: Connection lost. Please check your internet.", key: "sys.connection_error", filename: "system.json" },
  { text: "Achievement Unlocked: Dragon Slayer", key: "achieve.dragon_slayer", filename: "achievements.json" },
  { text: "Buy", key: "shop.buy", filename: "shop_ui.json" },
  { text: "Sell", key: "shop.sell", filename: "shop_ui.json" },
  { text: "500 Gold", key: "shop.price_display", filename: "shop_ui.json" },
  { text: "Hey yo! Need some goods? I got the best prices in town, bro!", key: "dlg_shady_merchant_01", filename: "dialogue/shady_merchant.json", gameGenre: "RPG" },
  { text: "...farewell, old friend. I shall miss you dearly.", key: "dlg_companion_farewell", filename: "dialogue/companion.json", gameGenre: "RPG" },
  { text: "SURRENDER NOW, MORTAL! Your feeble resistance is meaningless!", key: "dlg_boss_taunt_01", filename: "dialogue/boss.json", gameGenre: "RPG" },
  { text: "Loading...", key: "sys.loading", filename: "system.json" },
  { text: "Did you know? You can fast travel by opening the map and clicking on a discovered location.", key: "loading.tip_03", filename: "loading_tips.json" },
]

// ============================================================================
// COLORS & LABELS
// ============================================================================

const SCREEN_COLORS: Record<ScreenType, string> = {
  main_menu: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pause_menu: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  settings: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  dialogue: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  cutscene: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  combat: "bg-red-500/15 text-red-400 border-red-500/30",
  inventory: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  shop: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  quest_log: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  map: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  hud: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  tutorial: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  loading: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  credits: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  character_creation: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  crafting: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  skill_tree: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  achievement: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  notification: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  tooltip: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  unknown: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
}

const SPEAKER_COLORS: Record<SpeakerType, string> = {
  player: "bg-green-500/15 text-green-400 border-green-500/30",
  npc: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  narrator: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  system: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  ui: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  enemy: "bg-red-500/15 text-red-400 border-red-500/30",
  companion: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  merchant: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  quest_giver: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  tutorial_guide: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  unknown: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
}

const TONE_COLORS: Record<ToneType, string> = {
  formal: "bg-blue-500/15 text-blue-400",
  informal: "bg-green-500/15 text-green-400",
  urgent: "bg-red-500/15 text-red-400",
  epic: "bg-purple-500/15 text-purple-400",
  comedic: "bg-yellow-500/15 text-yellow-400",
  dark: "bg-gray-500/15 text-gray-300",
  neutral: "bg-zinc-500/15 text-zinc-400",
  mysterious: "bg-violet-500/15 text-violet-400",
  friendly: "bg-emerald-500/15 text-emerald-400",
  threatening: "bg-rose-500/15 text-rose-400",
  sad: "bg-sky-500/15 text-sky-400",
}

const SCREEN_ICONS: Partial<Record<ScreenType, string>> = {
  main_menu: "🏠", pause_menu: "⏸️", settings: "⚙️", dialogue: "💬",
  cutscene: "🎬", combat: "⚔️", inventory: "🎒", shop: "🛒",
  quest_log: "📜", map: "🗺️", hud: "📊", tutorial: "📖",
  loading: "⏳", credits: "🎬", character_creation: "👤", crafting: "🔨",
  skill_tree: "🌳", achievement: "🏆", notification: "🔔", tooltip: "💡",
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ContextHarvesterPage() {
  const { t } = useTranslation();
  const [result, setResult] = useState<BatchHarvestResult | null>(null)
  const [inputMode, setInputMode] = useState<"demo" | "paste" | "file">("demo")
  const [pasteText, setPasteText] = useState("")
  const [gameNameInput, setGameNameInput] = useState("")
  const [gameGenreInput, setGameGenreInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [filterScreen, setFilterScreen] = useState<ScreenType | "all">("all")
  const [filterSpeaker, setFilterSpeaker] = useState<SpeakerType | "all">("all")
  const [savedHarvests, setSavedHarvests] = useState(() => listHarvests())

  const runHarvest = useCallback(() => {
    setIsProcessing(true)
    setSelectedIndex(null)

    setTimeout(() => {
      let inputs: HarvestInput[]

      if (inputMode === "demo") {
        inputs = DEMO_STRINGS
      } else if (inputMode === "paste") {
        const lines = pasteText.split("\n").filter(l => l.trim())
        inputs = lines.map((line, i) => {
          // Supporta formato "key=value" o "key\tvalue" o solo testo
          const tabSplit = line.split("\t")
          const eqSplit = line.split("=")
          if (tabSplit.length >= 2) {
            return { text: tabSplit[1].trim(), key: tabSplit[0].trim(), gameGenre: gameGenreInput || undefined, gameName: gameNameInput || undefined }
          }
          if (eqSplit.length >= 2 && eqSplit[0].length < 80) {
            return { text: eqSplit.slice(1).join("=").trim(), key: eqSplit[0].trim(), gameGenre: gameGenreInput || undefined, gameName: gameNameInput || undefined }
          }
          return { text: line.trim(), gameGenre: gameGenreInput || undefined, gameName: gameNameInput || undefined }
        })
      } else {
        inputs = [] // File mode handled separately
      }

      if (inputs.length > 0) {
        const batchResult = harvestBatch(inputs)
        setResult(batchResult)
      }
      setIsProcessing(false)
    }, 100)
  }, [inputMode, pasteText, gameGenreInput, gameNameInput])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsProcessing(true)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      let inputs: HarvestInput[] = []

      try {
        // Prova JSON
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          inputs = parsed.map((item: any) => ({
            text: item.text || item.value || item.source || String(item),
            key: item.key || item.id,
            filename: file.name,
            comment: item.comment || item.context,
            maxLength: item.maxLength,
            gameGenre: gameGenreInput || undefined,
            gameName: gameNameInput || undefined,
          }))
        } else if (typeof parsed === "object") {
          inputs = Object.entries(parsed).map(([key, value]) => ({
            text: String(value),
            key,
            filename: file.name,
            gameGenre: gameGenreInput || undefined,
            gameName: gameNameInput || undefined,
          }))
        }
      } catch {
        // Fallback: testo semplice, una riga = una stringa
        inputs = content.split("\n").filter(l => l.trim()).map(line => ({
          text: line.trim(),
          filename: file.name,
          gameGenre: gameGenreInput || undefined,
          gameName: gameNameInput || undefined,
        }))
      }

      if (inputs.length > 0) {
        const batchResult = harvestBatch(inputs)
        setResult(batchResult)
      }
      setIsProcessing(false)
    }
    reader.readAsText(file)
  }, [gameGenreInput, gameNameInput])

  const filteredContexts = useMemo(() => {
    if (!result) return []
    return result.contexts.map((ctx, i) => ({ ctx, index: i })).filter(({ ctx }) => {
      if (filterScreen !== "all" && ctx.screen !== filterScreen) return false
      if (filterSpeaker !== "all" && ctx.speaker !== filterSpeaker) return false
      return true
    })
  }, [result, filterScreen, filterSpeaker])

  const handleSave = useCallback(() => {
    if (!result) return
    const gameId = gameNameInput || `harvest_${Date.now()}`
    saveHarvest(gameId, result, gameNameInput || "Unnamed")
    setSavedHarvests(listHarvests())
  }, [result, gameNameInput])

  const handleExport = useCallback(() => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `context-harvest-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  const handleCopyPrompt = useCallback(() => {
    if (!result?.batchPromptHint) return
    navigator.clipboard.writeText(result.batchPromptHint)
  }, [result])

  const selectedCtx = selectedIndex !== null ? result?.contexts[selectedIndex] : null

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Wheat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('nav.contextHarvester')}</h1>
              <p className="text-white/70 text-sm">{t('contextHarvesterPage.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-black/30 rounded-lg px-3 py-1.5 shadow-lg shadow-black/40 border border-white/10 text-white/90">
              <Sparkles className="h-3 w-3 mr-1" />
              {result ? `${result.stats.totalStrings} stringhe analizzate` : "Pronto"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Input Section */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Input Stringhe
            </CardTitle>
            <CardDescription className="text-xs">
              Carica le stringhe del gioco per estrarre contesto automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="demo" className="text-xs h-7">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Demo (30 stringhe)
                </TabsTrigger>
                <TabsTrigger value="paste" className="text-xs h-7">
                  <MessageSquare className="h-3 w-3 mr-1" />{t('heatmap.paste')}</TabsTrigger>
                <TabsTrigger value="file" className="text-xs h-7">
                  <Upload className="h-3 w-3 mr-1" />
                  File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="mt-2 space-y-2">
                <Textarea
                  placeholder={"Incolla stringhe (una per riga)\nFormato: key=value  oppure  key\\tvalue  oppure  solo testo"}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={5}
                  className="text-xs font-mono"
                />
              </TabsContent>

              <TabsContent value="file" className="mt-2">
                <Label htmlFor="file-upload" className="text-xs">
                  Carica file JSON, CSV o TXT
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".json,.csv,.txt,.po,.ini,.properties"
                  onChange={handleFileUpload}
                  className="h-8 text-xs mt-1"
                />
              </TabsContent>

              <TabsContent value="demo" className="mt-2">
                <p className="text-xs text-muted-foreground">
                  30 stringhe di esempio da un RPG generico — menu, dialoghi, combattimento, inventario, quest, sistema.
                </p>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">{t('communityHub.gameName')}</Label>
                <Input
                  value={gameNameInput}
                  onChange={(e) => setGameNameInput(e.target.value)}
                  placeholder="es. The Elder Scrolls"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">{t('library.genre')}</Label>
                <Input
                  value={gameGenreInput}
                  onChange={(e) => setGameGenreInput(e.target.value)}
                  placeholder="es. RPG, Visual Novel, FPS"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <Button
                onClick={runHarvest}
                disabled={isProcessing || (inputMode === "paste" && !pasteText.trim())}
                className="h-8 text-xs"
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                Analizza
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-medium">{t('contextHarvesterPage.screenshots')}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(result.stats.screens)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([screen, count]) => (
                      <Badge key={screen} variant="outline" className={cn("text-[10px] px-1.5 py-0", SCREEN_COLORS[screen as ScreenType])}>
                        {SCREEN_ICONS[screen as ScreenType] || "📄"} {screen} ({count})
                      </Badge>
                    ))}
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-medium">{t('contextHarvesterPage.speaker')}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(result.stats.speakers)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([speaker, count]) => (
                      <Badge key={speaker} variant="outline" className={cn("text-[10px] px-1.5 py-0", SPEAKER_COLORS[speaker as SpeakerType])}>
                        {speaker} ({count})
                      </Badge>
                    ))}
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-medium">{t('contextHarvesterPage.constraints')}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>{result.stats.stringsWithPlaceholders} con placeholder</div>
                  <div>{result.stats.stringsWithConstraints} con vincoli UI</div>
                  {result.stats.avgMaxLength && <div>~{result.stats.avgMaxLength} chars max medio</div>}
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-medium">{t('contextHarvesterPage.tones')}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(result.stats.tones)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([tone, count]) => (
                      <Badge key={tone} variant="outline" className={cn("text-[10px] px-1.5 py-0", TONE_COLORS[tone as ToneType])}>
                        {tone} ({count})
                      </Badge>
                    ))}
                </div>
              </Card>
            </div>

            {/* Batch Prompt Hint */}
            {result.batchPromptHint && (
              <Card>
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Prompt Hint Generato (iniettato automaticamente)
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleCopyPrompt}>
                    <Copy className="h-3 w-3 mr-1" />{t('translationFixer.copy')}</Button>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <pre className="text-xs font-mono bg-muted/50 rounded p-2 whitespace-pre-wrap text-muted-foreground">
                    {result.batchPromptHint}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExport}>
                <Download className="h-3 w-3 mr-1" /> Esporta JSON
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSave}>
                <FileText className="h-3 w-3 mr-1" /> Salva per Gioco
              </Button>
              {/* Filters */}
              <div className="flex-1" />
              <select
                value={filterScreen}
                onChange={(e) => setFilterScreen(e.target.value as any)}
                className="h-7 text-xs bg-background border rounded px-2"
              >
                <option value="all">{t('contextHarvesterPage.allScreenshots')}</option>
                {Object.keys(result.stats.screens).map(s => (
                  <option key={s} value={s}>{SCREEN_ICONS[s as ScreenType] || ""} {s} ({result.stats.screens[s as ScreenType]})</option>
                ))}
              </select>
              <select
                value={filterSpeaker}
                onChange={(e) => setFilterSpeaker(e.target.value as any)}
                className="h-7 text-xs bg-background border rounded px-2"
              >
                <option value="all">{t('contextHarvesterPage.allSpeakers')}</option>
                {Object.keys(result.stats.speakers).map(s => (
                  <option key={s} value={s}>{s} ({result.stats.speakers[s as SpeakerType]})</option>
                ))}
              </select>
            </div>

            {/* String List + Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* List */}
              <Card className="lg:col-span-2">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs">
                    Stringhe Analizzate ({filteredContexts.length}/{result.stats.totalStrings})
                  </CardTitle>
                </CardHeader>
                <ScrollArea className="h-[500px]">
                  <div className="px-4 pb-3 space-y-1">
                    {filteredContexts.map(({ ctx, index }) => {
                      const input = inputMode === "demo" ? DEMO_STRINGS[index] : undefined
                      const text = input?.text || `String #${index + 1}`
                      const isSelected = selectedIndex === index

                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedIndex(isSelected ? null : index)}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded cursor-pointer border transition-colors",
                            isSelected ? "bg-accent border-accent-foreground/20" : "hover:bg-muted/50 border-transparent"
                          )}
                        >
                          <span className="text-[10px] text-muted-foreground w-5 text-right mt-0.5 shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">{text}</div>
                            {input?.key && (
                              <div className="text-[10px] text-muted-foreground font-mono truncate">{input.key}</div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 shrink-0">
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", SCREEN_COLORS[ctx.screen])}>
                              {SCREEN_ICONS[ctx.screen] || "📄"} {ctx.screen}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", SPEAKER_COLORS[ctx.speaker])}>
                              {ctx.speaker}
                            </Badge>
                            {ctx.constraints.hasPlaceholders && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                                ⚠️ vars
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </Card>

              {/* Detail Panel */}
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    {selectedCtx ? `Dettaglio #${selectedIndex! + 1}` : "Seleziona una stringa"}
                  </CardTitle>
                </CardHeader>
                {selectedCtx ? (
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Screen */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('contextHarvesterPage.screen')}</Label>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={cn("text-xs", SCREEN_COLORS[selectedCtx.screen])}>
                          {SCREEN_ICONS[selectedCtx.screen]} {selectedCtx.screen}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          ({Math.round(selectedCtx.screenConfidence * 100)}% conf.)
                        </span>
                      </div>
                    </div>

                    {/* Speaker */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('contextHarvesterPage.speaker')}</Label>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={cn("text-xs", SPEAKER_COLORS[selectedCtx.speaker])}>
                          {selectedCtx.speakerName || selectedCtx.speaker}
                        </Badge>
                        {selectedCtx.speakerName && (
                          <span className="text-[10px] text-muted-foreground">({selectedCtx.speaker})</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          ({Math.round(selectedCtx.speakerConfidence * 100)}% conf.)
                        </span>
                      </div>
                    </div>

                    {/* Tone */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('contextHarvesterPage.tone')}</Label>
                      <div className="mt-0.5">
                        <Badge className={cn("text-xs", TONE_COLORS[selectedCtx.tone])}>
                          {selectedCtx.tone}
                        </Badge>
                      </div>
                    </div>

                    {/* Content Type */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('contextHarvesterPage.contentType')}</Label>
                      <div className="mt-0.5">
                        <Badge variant="outline" className="text-xs">{selectedCtx.contentType}</Badge>
                      </div>
                    </div>

                    <Separator />

                    {/* Constraints */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('contextHarvesterPage.uiConstraints')}</Label>
                      <div className="space-y-1 mt-1">
                        {selectedCtx.constraints.maxLength !== null && (
                          <div className="text-xs">📏 Max lunghezza: <span className="font-medium">{selectedCtx.constraints.maxLength}</span> chars</div>
                        )}
                        {selectedCtx.constraints.hasPlaceholders && (
                          <div className="text-xs">
                            ⚠️ Placeholder: <code className="text-[10px] bg-muted px-1 rounded">{selectedCtx.constraints.placeholders.join(", ")}</code>
                          </div>
                        )}
                        {selectedCtx.constraints.isAllCaps && (
                          <div className="text-xs">🔠 Tutto maiuscolo</div>
                        )}
                        {selectedCtx.constraints.singleLine && (
                          <div className="text-xs">↔️ Riga singola</div>
                        )}
                        {!selectedCtx.constraints.maxLength && !selectedCtx.constraints.hasPlaceholders && !selectedCtx.constraints.isAllCaps && (
                          <div className="text-xs text-muted-foreground">{t('contextHarvesterPage.noConstraints')}</div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Tags */}
                    {selectedCtx.tags.length > 0 && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t('contextHarvesterPage.tag')}</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedCtx.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prompt Hint */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t('contextHarvesterPage.promptHint')}</Label>
                      <pre className="text-[10px] font-mono bg-muted/50 rounded p-1.5 mt-1 whitespace-pre-wrap text-muted-foreground">
                        {selectedCtx.promptHint || "—"}
                      </pre>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent className="px-4 pb-4">
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Clicca su una stringa per vedere il contesto estratto
                    </p>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Saved Harvests */}
            {savedHarvests.length > 0 && (
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs">Harvest Salvati ({savedHarvests.length})</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1">
                    {savedHarvests.map((h) => (
                      <div key={h.gameId} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                        <div>
                          <span className="font-medium">{h.gameName || h.gameId}</span>
                          <span className="text-muted-foreground ml-2">{h.totalStrings} stringhe</span>
                          <span className="text-muted-foreground ml-2">{new Date(h.harvestedAt).toLocaleDateString("it-IT")}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-destructive"
                          onClick={() => {
                            deleteHarvest(h.gameId)
                            setSavedHarvests(listHarvests())
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
