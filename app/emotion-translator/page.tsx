"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmotionBadge, EmotionStats } from "@/components/translator/emotion-badge"
import { analyzeEmotion, EMOTION_STYLES, EmotionType } from "@/lib/emotion-analyzer"
import { Sparkles, Languages, Zap, ArrowRight, Copy, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

const EXAMPLE_DIALOGUES = [
  {
    category: "Anger",
    icon: "😠",
    texts: [
      "You fool! How DARE you betray us! I will destroy everything you love!",
      "Get out of my sight! I don't ever want to see your pathetic face again!",
      "This is the LAST time you cross me. You will pay for this!!"
    ]
  },
  {
    category: "Sadness", 
    icon: "😢",
    texts: [
      "I miss her so much... She's been gone for years, but it still hurts...",
      "I'm sorry... I never meant for any of this to happen. I've lost everything...",
      "We used to be so happy here... Now it's all just memories and dust..."
    ]
  },
  {
    category: "Fear",
    icon: "😨",
    texts: [
      "Did you hear that? Something's moving in the darkness... We need to hide!",
      "I'm scared... What if they find us? We can't run anymore...",
      "Don't go in there! Something terrible happened in that place... I can feel it."
    ]
  },
  {
    category: "Joy",
    icon: "😊",
    texts: [
      "We did it! I can't believe we actually won! This is the best day ever!",
      "Thank you so much! You've made me the happiest person in the world!",
      "Finally! After all these years, we're reunited! I love you all so much!"
    ]
  },
  {
    category: "Sarcasm",
    icon: "😏",
    texts: [
      "Oh sure, brilliant plan. Let's just walk into the enemy fortress. What could go wrong?",
      "Wow, you're a genius. Nobody has EVER thought of that before.",
      "Right, because trusting the guy who betrayed us twice is totally smart."
    ]
  },
  {
    category: "Tension",
    icon: "😰",
    texts: [
      "Shh... be quiet. They're right outside the door. Don't. Move.",
      "Something's not right here... Keep your eyes open. Watch the shadows.",
      "Wait... do you smell that? We need to get out. Now. Quietly."
    ]
  }
]

const LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
]

export default function EmotionTranslatorPage() {
  const { t, language } = useTranslation()
  const [inputText, setInputText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState("en")
  const [targetLanguage, setTargetLanguage] = useState("it")
  const [isTranslating, setIsTranslating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [emotionAware, setEmotionAware] = useState(true)
  const [lastEmotion, setLastEmotion] = useState<any>(null)

  const currentAnalysis = inputText ? analyzeEmotion(inputText) : null

  const handleTranslate = async () => {
    if (!inputText.trim()) return
    
    setIsTranslating(true)
    setLastEmotion(null)
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          targetLanguage,
          sourceLanguage,
          provider: 'libre', // Usa provider gratuito per demo
          emotionAware
        })
      })
      
      const data = await response.json()
      setTranslatedText(data.translatedText || 'Errore nella traduzione')
      if (data.emotion) {
        setLastEmotion(data.emotion)
      }
    } catch (error) {
      setTranslatedText('Errore nella traduzione')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadExample = (text: string) => {
    setInputText(text)
    setTranslatedText("")
    setLastEmotion(null)
  }

  return (
      <div className="space-y-6">
        {/* Hero Header - Compact */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 p-4 text-white">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{t('emotionTranslator.title')}</h1>
                <p className="text-white/80 text-sm">{t('emotionTranslator.subtitle')}</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-md text-sm">
                <Zap className="h-4 w-4" />
                <span>10 {t('emotionTranslator.emotions')}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-md text-sm">
                <Languages className="h-4 w-4" />
                <span>10+ {t('emotionTranslator.languages')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Translation Panel */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Languages className="h-5 w-5" />
                      {t('emotionTranslator.translator')}
                    </CardTitle>
                    <CardDescription>
                      {t('emotionTranslator.translatorDesc')}
                    </CardDescription>
                  </div>
                  <Button
                    variant={emotionAware ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmotionAware(!emotionAware)}
                    className={cn(
                      "gap-2",
                      emotionAware && "bg-gradient-to-r from-violet-500 to-purple-500"
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                    {emotionAware ? "Emotion ON" : "Emotion OFF"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('emotionTranslator.originalText')}</Label>
                    {currentAnalysis && currentAnalysis.primary !== 'neutral' && (
                      <EmotionBadge text={inputText} showDetails />
                    )}
                  </div>
                  <Textarea
                    placeholder="Enter text to translate... Try something emotional like 'I hate you!' or 'I miss you so much...'"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Language Selection */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(lang => (
                          <SelectItem key={lang.code} value={lang.code}>
                            <span className="flex items-center gap-2">
                              <span>{lang.flag}</span>
                              <span>{lang.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(lang => (
                          <SelectItem key={lang.code} value={lang.code}>
                            <span className="flex items-center gap-2">
                              <span>{lang.flag}</span>
                              <span>{lang.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleTranslate}
                    disabled={!inputText.trim() || isTranslating}
                    className="gap-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('emotionTranslator.translating')}
                      </>
                    ) : (
                      <>
                        {t('emotionTranslator.translate')}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Supported Emotions - Compact */}
                <div className="flex flex-wrap gap-1.5 py-2">
                  {Object.values(EMOTION_STYLES).map(style => (
                    <Badge
                      key={style.emotion}
                      variant="outline"
                      className="gap-1 text-xs"
                    >
                      <span>{style.icon}</span>
                      <span>{language === 'it' ? style.labelIt : style.label}</span>
                    </Badge>
                  ))}
                </div>

                {/* Output */}
                {translatedText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('emotionTranslator.translation')}</Label>
                      <div className="flex items-center gap-2">
                        {lastEmotion && (
                          <Badge variant="outline" className="gap-1">
                            {EMOTION_STYLES[lastEmotion.primary as EmotionType]?.icon}
                            {lastEmotion.primary}
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={handleCopy}>
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg min-h-[100px]">
                      <p className="whitespace-pre-wrap">{translatedText}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Analysis */}
            {currentAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('emotionTranslator.realTimeAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-3xl mb-1">
                        {EMOTION_STYLES[currentAnalysis.primary]?.icon || '😐'}
                      </p>
                      <p className="text-sm font-medium">
                        {language === 'it' ? (EMOTION_STYLES[currentAnalysis.primary]?.labelIt || 'Neutro') : (EMOTION_STYLES[currentAnalysis.primary]?.label || 'Neutral')}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('emotionTranslator.emotion')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-2xl font-bold mb-1">{currentAnalysis.confidence}%</p>
                      <p className="text-xs text-muted-foreground">{t('emotionTranslator.confidence')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-2xl font-bold mb-1 capitalize">{currentAnalysis.intensity}</p>
                      <p className="text-xs text-muted-foreground">{t('emotionTranslator.intensity')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-center">
                      <p className="text-2xl font-bold mb-1">{currentAnalysis.markers.length}</p>
                      <p className="text-xs text-muted-foreground">{t('emotionTranslator.markers')}</p>
                    </div>
                  </div>
                  
                  {currentAnalysis.markers.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="text-sm text-muted-foreground">Markers:</span>
                      {currentAnalysis.markers.map((m, i) => (
                        <Badge key={i} variant="secondary">{m}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Examples Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('emotionTranslator.exampleDialogues')}</CardTitle>
                <CardDescription>
                  {t('emotionTranslator.clickToLoad')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="Anger" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 rounded-none border-b">
                    {EXAMPLE_DIALOGUES.slice(0, 3).map(cat => (
                      <TabsTrigger key={cat.category} value={cat.category} className="text-xs">
                        {cat.icon}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsList className="w-full grid grid-cols-3 rounded-none">
                    {EXAMPLE_DIALOGUES.slice(3).map(cat => (
                      <TabsTrigger key={cat.category} value={cat.category} className="text-xs">
                        {cat.icon}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {EXAMPLE_DIALOGUES.map(cat => (
                    <TabsContent key={cat.category} value={cat.category} className="p-4 space-y-2">
                      <p className="text-sm font-medium mb-3">{cat.icon} {cat.category}</p>
                      {cat.texts.map((text, i) => (
                        <Button
                          key={i}
                          variant="ghost"
                          className="w-full justify-start h-auto py-2 px-3 text-left text-xs hover:bg-muted"
                          onClick={() => loadExample(text)}
                        >
                          <span className="line-clamp-2">{text}</span>
                        </Button>
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
  )
}
