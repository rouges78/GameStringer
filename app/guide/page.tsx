'use client';

import React, { useState, useMemo } from 'react';
import { useVersion } from '@/lib/version';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import {
  Keyboard, BookOpen, Zap, ChevronRight, Rocket, ArrowRight,
  Gamepad2, Settings, Sparkles, Brain, Scan, Mic, FolderTree,
  Database, Wand2, ShieldCheck, AlertTriangle, HelpCircle,
  CheckCircle2, Info, Globe, Monitor, Target, Eye, Wrench,
  Package, Heart, Cpu, Film, Layers, AudioLines, User,
  FileArchive, ShoppingBag, Users, MessageSquare, Glasses,
  Subtitles, Play, FileText,
} from 'lucide-react';
import { useTranslation, translations } from '@/lib/i18n';
import {
  getToolsRegistry,
  categoryMeta,
  subcategoryLabels,
  type ToolDefinition,
} from '@/lib/tools-registry';

// ============================================================================
// STEP COMPONENT — usato per ogni passo di un flusso di lavoro
// ============================================================================
function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
          {number}
        </div>
        <div className="flex-1 w-px bg-slate-700/50 mt-1" />
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
        <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// TIP COMPONENT — box colorato per suggerimenti
// ============================================================================
function Tip({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warning' | 'success' }) {
  const styles = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  };
  const icons = {
    info: <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex gap-2 p-2.5 rounded-lg border text-xs leading-relaxed ${styles[variant]}`}>
      {icons[variant]}
      <div>{children}</div>
    </div>
  );
}

// ============================================================================
// NAV LINK — link cliccabile a una pagina dell'app
// ============================================================================
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-400/30 hover:decoration-blue-300/60 transition-colors">
      {children} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function GuidePage() {
  const { t, language } = useTranslation();
  const { version } = useVersion();
  const [activeTab, setActiveTab] = useState('quickstart');

  const guideTrans = (translations[language] as any)?.guidePage || (translations.it as any).guidePage;
  const registry = useMemo(() => getToolsRegistry(), []);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, { subcategory: string; tools: ToolDefinition[] }[]> = {};
    for (const tool of registry) {
      if (!groups[tool.category]) groups[tool.category] = [];
      const sub = tool.subcategory || '_root';
      let existing = groups[tool.category].find((g) => g.subcategory === sub);
      if (!existing) {
        existing = { subcategory: sub, tools: [] };
        groups[tool.category].push(existing);
      }
      existing.tools.push(tool);
    }
    return groups;
  }, [registry]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-3 overflow-hidden">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800/50 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-orange-950/30 p-3 shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-orange-400">{t('guidePage.detailedGuide')}</h1>
              <p className="text-xs text-muted-foreground">{t('guidePage.everythingAbout')} v{version}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">
            {registry.length} {t('nav.tools').toLowerCase()}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-5 w-full h-9 shrink-0">
          <TabsTrigger value="quickstart" className="text-xs gap-1">
            <Rocket className="h-3 w-3" /> Quick Start
          </TabsTrigger>
          <TabsTrigger value="workflows" className="text-xs gap-1">
            <Target className="h-3 w-3" /> Flussi di Lavoro
          </TabsTrigger>
          <TabsTrigger value="tools" className="text-xs gap-1">
            <Wrench className="h-3 w-3" /> Strumenti
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className="text-xs gap-1">
            <Keyboard className="h-3 w-3" /> Scorciatoie
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-xs gap-1">
            <HelpCircle className="h-3 w-3" /> FAQ
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB: QUICK START                                                 */}
        {/* ================================================================ */}
        <TabsContent value="quickstart" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-3 pb-6">
              <Card className="border-blue-500/20 bg-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-400">
                    <Rocket className="h-5 w-5" />
                    Primi Passi con GameStringer
                  </CardTitle>
                  <CardDescription>
                    Segui questi passaggi per iniziare a tradurre il tuo primo gioco in meno di 5 minuti.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title="Configura il provider AI">
                    <p>Vai in <NavLink href="/settings">Impostazioni</NavLink> → tab <strong>AI</strong>.</p>
                    <p>Seleziona un provider (es. <strong>OpenAI</strong>, <strong>Gemini</strong>, <strong>DeepL</strong>) e incolla la tua API key.</p>
                    <p>Clicca <strong>Salva</strong>. La chiave viene salvata in modo sicuro nel tuo profilo.</p>
                    <Tip variant="info">Non hai una API key? Puoi usare <strong>Ollama</strong> per traduzioni gratuite e offline. Vai in Impostazioni → Ollama per configurarlo.</Tip>
                  </Step>

                  <Step number={2} title="Collega i tuoi store di giochi">
                    <p>Vai in <NavLink href="/stores">Stores</NavLink> e configura almeno uno store (Steam, Epic, GOG...).</p>
                    <p>Per <strong>Steam</strong>: inserisci il tuo <strong>Steam ID</strong> e una <strong>API Key Steam</strong> (gratuita da <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">steamcommunity.com/dev/apikey</a>).</p>
                    <p>GameStringer scaricherà automaticamente la tua libreria con tutte le info: engine, lingue supportate, percorso di installazione.</p>
                  </Step>

                  <Step number={3} title="Vai alla Libreria e scegli un gioco">
                    <p>Apri la <NavLink href="/library">Libreria</NavLink>. Vedrai tutti i tuoi giochi con copertine, engine e stato installazione.</p>
                    <p>Clicca su un gioco installato per vedere i dettagli: engine rilevato, file di localizzazione trovati, lingue supportate.</p>
                    <p>Dal dettaglio gioco, clicca <strong>&quot;Traduci&quot;</strong> per avviare la traduzione.</p>
                  </Step>

                  <Step number={4} title="Traduci automaticamente">
                    <p>La pagina <NavLink href="/auto-translate">Auto-Translate</NavLink> scansiona automaticamente i file del gioco.</p>
                    <p>Se trova file traducibili (JSON, CSV, PO, XML, ecc.), li carica e puoi tradurli con un click.</p>
                    <p>Scegli lingua sorgente/destinazione, provider AI, e clicca <strong>&quot;Avvia Traduzione&quot;</strong>.</p>
                    <p>La traduzione avviene in batch con barra di progresso, stima tempo, e salvataggio automatico.</p>
                  </Step>

                  <Step number={5} title="Rivedi, esporta e applica la patch">
                    <p>Dopo la traduzione, la fase di <strong>Review</strong> mostra ogni stringa con punteggio qualità.</p>
                    <p>Puoi modificare manualmente qualsiasi traduzione cliccandoci sopra.</p>
                    <p>Nella fase <strong>Patch</strong>, GameStringer genera un pacchetto ZIP con i file tradotti pronti da copiare nella cartella del gioco.</p>
                    <Tip variant="success">Per giochi Unity, GameStringer può installare automaticamente <strong>BepInEx + XUnity AutoTranslator</strong> — non serve fare nulla a mano!</Tip>
                  </Step>
                </CardContent>
              </Card>

              {/* Cosa serve */}
              <Card className="border-slate-800/50 bg-slate-900/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Cosa serve per iniziare
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <p className="text-xs font-semibold text-white mb-1">API Key AI (consigliata)</p>
                      <p className="text-[11px] text-muted-foreground">OpenAI, Gemini, DeepL, Claude, DeepSeek, Mistral o OpenRouter. Oppure usa Ollama per tradurre gratis offline.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <p className="text-xs font-semibold text-white mb-1">Giochi installati</p>
                      <p className="text-[11px] text-muted-foreground">Almeno un gioco installato su Steam, Epic, GOG o altra piattaforma. GameStringer rileva automaticamente i file.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <p className="text-xs font-semibold text-white mb-1">Connessione internet</p>
                      <p className="text-[11px] text-muted-foreground">Per i provider AI cloud. Non necessaria se usi Ollama o hai già i file tradotti.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: FLUSSI DI LAVORO                                            */}
        {/* ================================================================ */}
        <TabsContent value="workflows" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-3 pb-6">

              {/* Workflow 1: Gioco Unity */}
              <Card className="border-emerald-500/20 bg-emerald-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
                    <Wand2 className="h-4 w-4" />
                    Tradurre un gioco Unity
                  </CardTitle>
                  <CardDescription>Il flusso più comune. GameStringer gestisce tutto automaticamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title="Seleziona il gioco dalla Libreria">
                    <p>Apri <NavLink href="/library">Libreria</NavLink> → cerca il gioco → clicca su di esso.</p>
                    <p>GameStringer rileva se è Unity dalla presenza di <code className="text-[10px] px-1 py-0.5 bg-slate-800 rounded">UnityPlayer.dll</code>.</p>
                  </Step>
                  <Step number={2} title="Clicca 'Traduci' → Auto-Translate">
                    <p>Se non trova file di localizzazione, GameStringer rileva che è Unity e propone di installare <strong>BepInEx + XUnity AutoTranslator</strong>.</p>
                    <p>Clicca <strong>&quot;Installa&quot;</strong> — il processo è completamente automatico.</p>
                  </Step>
                  <Step number={3} title="Avvia il gioco una volta">
                    <p>Dopo l&apos;installazione, avvia il gioco normalmente. BepInEx genera i file di traduzione alla prima esecuzione.</p>
                    <p>Chiudi il gioco e torna su GameStringer.</p>
                  </Step>
                  <Step number={4} title="Ri-scansiona e traduci">
                    <p>Clicca <strong>&quot;Ri-Scansiona&quot;</strong>. Ora GameStringer trova i file di traduzione generati da XUnity.</p>
                    <p>Avvia la traduzione AI. I file tradotti verranno inseriti direttamente nella cartella di XUnity.</p>
                  </Step>
                  <Tip variant="info">In-game puoi premere <strong>ALT+T</strong> per aprire il menu di XUnity AutoTranslator e regolare le impostazioni.</Tip>
                </CardContent>
              </Card>

              {/* Workflow 2: Gioco generico con file */}
              <Card className="border-blue-500/20 bg-blue-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
                    <FileText className="h-4 w-4" />
                    Tradurre un gioco con file di localizzazione
                  </CardTitle>
                  <CardDescription>Per giochi che hanno già file JSON, CSV, PO, XML nella cartella di installazione.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title="Libreria → Traduci">
                    <p>Seleziona il gioco dalla <NavLink href="/library">Libreria</NavLink> e clicca <strong>&quot;Traduci&quot;</strong>.</p>
                    <p>GameStringer scansiona fino a 8 livelli di sotto-cartelle cercando file traducibili.</p>
                  </Step>
                  <Step number={2} title="Seleziona i file da tradurre">
                    <p>Vengono caricati automaticamente i file trovati. Puoi deselezionare quelli che non ti servono.</p>
                    <p>Formati supportati: <strong>JSON, CSV, PO/POT, XLIFF, RESX, XML, YAML, LUA, RPY, INI, TXT, LANG</strong>.</p>
                  </Step>
                  <Step number={3} title="Configura e avvia">
                    <p>Scegli provider AI, lingua sorgente/destinazione, e clicca <strong>&quot;Avvia Traduzione&quot;</strong>.</p>
                    <p>La traduzione procede in batch. Puoi <strong>mettere in pausa</strong> e <strong>riprendere</strong> in qualsiasi momento.</p>
                    <p>Se chiudi l&apos;app, il checkpoint viene salvato automaticamente — puoi riprendere la prossima volta.</p>
                  </Step>
                  <Step number={4} title="Rivedi e applica">
                    <p>Nella fase Review, ogni stringa ha un <strong>punteggio qualità</strong> (0-100). Le stringhe sotto soglia sono evidenziate.</p>
                    <p>Genera la patch ZIP e copia i file nella cartella del gioco.</p>
                  </Step>
                </CardContent>
              </Card>

              {/* Workflow 3: Traduzione Manuale / Pro */}
              <Card className="border-violet-500/20 bg-violet-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-violet-400">
                    <Brain className="h-4 w-4" />
                    Neural Translator Pro — traduzione avanzata
                  </CardTitle>
                  <CardDescription>Per chi vuole controllo totale: scelta file, contesto, glossario, export.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title="Apri Neural Translator Pro">
                    <p>Vai in <NavLink href="/translator/pro">Neural Translator Pro</NavLink>. Seleziona il gioco dal dropdown o dalla Libreria.</p>
                  </Step>
                  <Step number={2} title="Seleziona file e configura">
                    <p>Puoi selezionare singoli file da tradurre. Configura: provider AI, lingua, glossario, Translation Memory.</p>
                    <p>Il sistema usa la <strong>Translation Memory</strong> per riutilizzare traduzioni precedenti e risparmiare costi API.</p>
                  </Step>
                  <Step number={3} title="Traduci con preview in tempo reale">
                    <p>Durante la traduzione vedi ogni stringa tradotta in tempo reale. Timer, progresso, errori — tutto visibile.</p>
                  </Step>
                  <Step number={4} title="Applica al gioco o esporta">
                    <p>Puoi applicare direttamente la patch al gioco (con backup automatico) oppure esportare come ZIP/file singoli.</p>
                    <p>Per giochi Unreal Engine, GameStringer crea file <code className="text-[10px] px-1 py-0.5 bg-slate-800 rounded">.locres</code> e file <code className="text-[10px] px-1 py-0.5 bg-slate-800 rounded">.pak</code> pronti.</p>
                  </Step>
                </CardContent>
              </Card>

              {/* Workflow 4: OCR in tempo reale */}
              <Card className="border-amber-500/20 bg-amber-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                    <Scan className="h-4 w-4" />
                    Traduzione OCR — cattura testo dallo schermo
                  </CardTitle>
                  <CardDescription>Per giochi senza file di localizzazione accessibili. Cattura e traduci il testo visibile.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title="Apri OCR Translator">
                    <p>Vai in <NavLink href="/ocr-translator">OCR Translator</NavLink> o premi <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-600 text-[10px] font-mono">Ctrl+Shift+T</kbd> da qualsiasi punto.</p>
                  </Step>
                  <Step number={2} title="Seleziona l'area dello schermo">
                    <p>Cattura una porzione dello schermo dove appare il testo del gioco (dialoghi, menu, ecc.).</p>
                    <p>L&apos;OCR estrae il testo automaticamente. Per giochi retro/pixel art, usa i preset di pre-processing (8-bit, 16-bit, DOS).</p>
                  </Step>
                  <Step number={3} title="Traduzione istantanea">
                    <p>Il testo estratto viene tradotto istantaneamente con il provider AI configurato.</p>
                    <p>Il risultato appare nell&apos;overlay o nel pannello laterale.</p>
                  </Step>
                  <Tip variant="info">Per traduzione continua senza click, usa <NavLink href="/live-ocr">Live OCR</NavLink> — cattura automatica a intervalli regolari.</Tip>
                </CardContent>
              </Card>

              {/* Workflow 5: Voce */}
              <Card className="border-pink-500/20 bg-pink-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-pink-400">
                    <Mic className="h-4 w-4" />
                    Traduzione vocale e voice clone
                  </CardTitle>
                  <CardDescription>Traduci dialoghi parlati e ricrea le voci nella lingua di destinazione.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  <Step number={1} title="Carica o registra audio">
                    <p>In <NavLink href="/voice-translator">Voice Translator</NavLink>, carica un file audio o registra direttamente.</p>
                    <p>Whisper (OpenAI) trascrive automaticamente l&apos;audio in testo.</p>
                  </Step>
                  <Step number={2} title="Traduzione del testo">
                    <p>Il testo trascritto viene tradotto con il provider AI selezionato.</p>
                  </Step>
                  <Step number={3} title="Text-to-Speech nella lingua target">
                    <p>La traduzione viene letta ad alta voce con voci AI (Nova, Alloy, Echo, Fable, Onyx, Shimmer).</p>
                    <p>Per voci personalizzate, usa <NavLink href="/voice-clone">Voice Clone Studio</NavLink> con ElevenLabs.</p>
                  </Step>
                </CardContent>
              </Card>

            </div>
          </ScrollArea>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: STRUMENTI (RIFERIMENTO)                                     */}
        {/* ================================================================ */}
        <TabsContent value="tools" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-5 pr-3 pb-6">
              {(['core', 'translation', 'tools', 'resources'] as const).map((cat) => {
                const meta = categoryMeta[cat];
                if (!meta || !groupedByCategory[cat]) return null;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`h-1 w-8 rounded-full bg-${meta.color}-500`} />
                      <h2 className={`text-sm font-bold text-${meta.color}-400 uppercase tracking-wider`}>{meta.label}</h2>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        {groupedByCategory[cat].reduce((acc, g) => acc + g.tools.length, 0)}
                      </Badge>
                    </div>
                    {groupedByCategory[cat].map((group) => (
                      <div key={group.subcategory} className="mb-3">
                        {group.subcategory !== '_root' && (
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                            {subcategoryLabels[group.subcategory] || group.subcategory}
                          </h3>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {group.tools.map((tool) => {
                            const Icon = tool.icon;
                            return (
                              <Link key={tool.id} href={tool.href}>
                                <Card className="border-slate-800/50 bg-slate-900/30 hover:bg-slate-800/40 hover:border-slate-700/60 transition-colors cursor-pointer h-full">
                                  <CardHeader className="py-2 px-3">
                                    <CardTitle className="text-xs flex items-center gap-2">
                                      <div className={`p-1 rounded bg-${tool.color}-500/20`}>
                                        <Icon className={`h-3.5 w-3.5 text-${tool.color}-400`} />
                                      </div>
                                      <span className="text-white">{tool.name}</span>
                                      {tool.isNew && <Badge className="text-[8px] px-1 py-0 h-3.5 bg-amber-500/20 text-amber-400 border-amber-500/30">NEW</Badge>}
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="py-1 px-3 pb-2">
                                    <ul className="space-y-0.5">
                                      {tool.features.slice(0, 3).map((f, j) => (
                                        <li key={j} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                                          <ChevronRight className="h-2.5 w-2.5 mt-0.5 text-slate-600 shrink-0" />
                                          <span>{f}</span>
                                        </li>
                                      ))}
                                      {tool.features.length > 3 && (
                                        <li className="text-[10px] text-slate-600 pl-4">+{tool.features.length - 3} altre funzioni</li>
                                      )}
                                    </ul>
                                  </CardContent>
                                </Card>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: SCORCIATOIE                                                 */}
        {/* ================================================================ */}
        <TabsContent value="shortcuts" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-3 pb-6">
              {/* Navigazione */}
              <Card className="border-slate-800/50 bg-slate-900/30">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-blue-400" />
                    Navigazione e interfaccia
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { shortcut: 'Ctrl + K', desc: 'Command Palette — cerca qualsiasi pagina o azione' },
                      { shortcut: 'Ctrl + F', desc: 'Ricerca globale nella pagina corrente' },
                      { shortcut: 'Ctrl + ,', desc: 'Apri Impostazioni' },
                      { shortcut: 'Ctrl + R', desc: 'Aggiorna dati libreria' },
                      { shortcut: 'Esc', desc: 'Chiudi modale, pannello o dropdown aperto' },
                      { shortcut: 'Shift + ?', desc: 'Mostra tutte le scorciatoie' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-2 rounded bg-slate-800/30">
                        <kbd className="px-2 py-1 bg-slate-900 rounded border border-slate-700 text-[10px] font-mono text-blue-400 whitespace-nowrap">
                          {s.shortcut}
                        </kbd>
                        <span className="text-[11px] text-muted-foreground text-right">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Hotkey globali */}
              <Card className="border-green-500/20 bg-green-950/10">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-400" />
                    Hotkey globali (attive anche con gioco in primo piano)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { shortcut: 'Ctrl + Shift + T', desc: 'Cattura OCR — seleziona area e traduci' },
                      { shortcut: 'Ctrl + Shift + Q', desc: 'Traduzione rapida — traduci testo negli appunti' },
                      { shortcut: 'Ctrl + Alt + O', desc: 'Toggle Overlay — mostra/nascondi overlay traduzione' },
                      { shortcut: 'ALT + T', desc: 'Menu XUnity AutoTranslator (in-game, dopo installazione)' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-2 rounded bg-slate-800/30">
                        <kbd className="px-2 py-1 bg-slate-900 rounded border border-green-500/30 text-[10px] font-mono text-green-400 whitespace-nowrap">
                          {s.shortcut}
                        </kbd>
                        <span className="text-[11px] text-muted-foreground text-right">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                  <Tip variant="info">Le hotkey globali funzionano anche quando GameStringer è in background e il gioco è in primo piano.</Tip>
                </CardContent>
              </Card>

              {/* Durante traduzione */}
              <Card className="border-slate-800/50 bg-slate-900/30">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    Durante la traduzione
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { shortcut: 'Spazio', desc: 'Pausa / Riprendi traduzione' },
                      { shortcut: 'Tab', desc: 'Stringa successiva (in Review)' },
                      { shortcut: 'Shift + Tab', desc: 'Stringa precedente (in Review)' },
                      { shortcut: 'Enter', desc: 'Conferma modifica stringa' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-2 rounded bg-slate-800/30">
                        <kbd className="px-2 py-1 bg-slate-900 rounded border border-slate-700 text-[10px] font-mono text-violet-400 whitespace-nowrap">
                          {s.shortcut}
                        </kbd>
                        <span className="text-[11px] text-muted-foreground text-right">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: FAQ                                                          */}
        {/* ================================================================ */}
        <TabsContent value="faq" className="flex-1 overflow-hidden mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-3 pb-6">

              {/* FAQ — Generali */}
              <h2 className="text-sm font-bold text-white flex items-center gap-2 px-1">
                <HelpCircle className="h-4 w-4 text-orange-400" />
                Domande frequenti
              </h2>

              {[
                {
                  q: 'Quanto costa usare GameStringer?',
                  a: 'GameStringer è gratuito e open source. Paghi solo le API dei provider AI che scegli di usare (OpenAI, Gemini, ecc.). Con Ollama puoi tradurre gratuitamente usando modelli AI locali sul tuo PC.',
                },
                {
                  q: 'Quali provider AI posso usare?',
                  a: 'OpenAI (GPT-4o, GPT-4), Google Gemini, Anthropic Claude, DeepSeek, Mistral, OpenRouter, DeepL, e Ollama per traduzione offline. Puoi anche usare Multi-LLM per confrontare i risultati di più provider.',
                },
                {
                  q: 'Posso tradurre in qualsiasi lingua?',
                  a: 'Sì. GameStringer supporta qualsiasi coppia di lingue supportata dal provider AI selezionato. Le lingue più comuni (IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL) hanno supporto i18n completo nell\'interfaccia.',
                },
                {
                  q: 'La traduzione modifica i file originali del gioco?',
                  a: 'No. GameStringer genera sempre file separati o patch ZIP. Per l\'applicazione diretta (es. Unreal .pak), viene fatto un backup automatico dei file originali. Puoi sempre ripristinare.',
                },
                {
                  q: 'Funziona con giochi multiplayer online?',
                  a: 'Dipende dal gioco. La traduzione dei file di localizzazione è sicura e non modifica gli eseguibili. Per giochi con anti-cheat aggressivo (EAC, BattlEye), usa l\'Overlay o l\'OCR che non toccano i file di gioco.',
                },
              ].map((faq, i) => (
                <Card key={i} className="border-slate-800/50 bg-slate-900/30">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs text-white">{faq.q}</CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}

              <Separator className="my-2 bg-slate-800" />

              {/* Troubleshooting */}
              <h2 className="text-sm font-bold text-white flex items-center gap-2 px-1">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Risoluzione problemi
              </h2>

              {[
                {
                  q: '"Nessun file traducibile trovato" — come risolvo?',
                  a: 'Alcuni giochi criptano o comprimono i file. Prova:\n• Per giochi Unity: usa il Unity Patcher che installa BepInEx automaticamente\n• Per giochi Unreal: usa l\'UE Translator per file .locres/.pak\n• Per altri engine: usa il Crawler per scansionare file in profondità, oppure carica manualmente i file dalla schermata Auto-Translate',
                },
                {
                  q: 'La traduzione si blocca o dà errore API',
                  a: '• Verifica che la API key sia valida in Impostazioni → AI\n• Controlla di avere credito sul provider (es. OpenAI)\n• Riduci il Batch Size in Impostazioni → Performance\n• Se usi Ollama, assicurati che il server sia avviato\n• La traduzione ha checkpoint automatico: se si blocca, puoi riprendere dallo stesso punto',
                },
                {
                  q: 'BepInEx non funziona / il gioco crasha dopo installazione',
                  a: '• Assicurati che il gioco sia chiuso prima di installare BepInEx\n• Per Unity < 5.6, GameStringer usa IPA invece di BepInEx (automatico)\n• Verifica che l\'antivirus non blocchi BepInEx (è un modding framework legittimo)\n• Prova a cancellare la cartella BepInEx e reinstallare',
                },
                {
                  q: 'I caratteri speciali (giapponese, cinese, arabo) non appaiono correttamente',
                  a: '• Usa il Fixer (Strumenti → Giochi → Fixer) per correggere encoding\n• Assicurati che il file sia salvato in UTF-8\n• Per giochi retro con font bitmap, potrebbe essere necessario un font mod separato',
                },
                {
                  q: 'Come faccio backup delle mie traduzioni?',
                  a: '• Vai in Impostazioni → Backup e attiva l\'Auto-Backup\n• Le traduzioni sono salvate anche nella Translation Memory (Dizionario) accessibile dalla sidebar\n• Puoi esportare qualsiasi progetto come ZIP dalla pagina Project Manager',
                },
              ].map((faq, i) => (
                <Card key={i} className="border-amber-500/10 bg-slate-900/30">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs text-amber-300">{faq.q}</CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-3 pb-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}

              <Separator className="my-2 bg-slate-800" />

              {/* Engine specifici */}
              <h2 className="text-sm font-bold text-white flex items-center gap-2 px-1">
                <Gamepad2 className="h-4 w-4 text-emerald-400" />
                Guida per engine di gioco
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { engine: 'Unity', tool: 'Unity Patcher', href: '/unity-patcher', desc: 'BepInEx + XUnity AutoTranslator. Automatico.', color: 'emerald' },
                  { engine: 'Unreal Engine 4/5', tool: 'UE Translator', href: '/unreal-translator', desc: 'Estrae .locres, traduce, crea .pak.', color: 'blue' },
                  { engine: 'RPG Maker (MV/MZ/VX)', tool: 'RPG Maker Patcher', href: '/rpgmaker-patcher', desc: 'Estrae database e mappe automaticamente.', color: 'amber' },
                  { engine: "Ren'Py", tool: "Ren'Py Patcher", href: '/renpy-patcher', desc: 'Gestisce script .rpy con variabili.', color: 'pink' },
                  { engine: 'Wolf RPG', tool: 'Wolf RPG Patcher', href: '/wolfrpg-patcher', desc: 'Estrae e modifica dati proprietari.', color: 'orange' },
                  { engine: 'Telltale', tool: 'Telltale Patcher', href: '/telltale-patcher', desc: 'File .langdb/.dlog per Walking Dead ecc.', color: 'violet' },
                  { engine: 'Godot', tool: 'Crawler + Fixer', href: '/crawler', desc: 'Scansiona e traduci file .tres/.tscn.', color: 'cyan' },
                  { engine: 'GameMaker', tool: 'Auto-Translate', href: '/auto-translate', desc: 'Cerca file data.win e stringhe interne.', color: 'yellow' },
                ].map((e, i) => (
                  <Link key={i} href={e.href}>
                    <Card className="border-slate-800/50 bg-slate-900/30 hover:bg-slate-800/40 transition-colors cursor-pointer h-full">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[9px] border-${e.color}-500/30 text-${e.color}-400 bg-${e.color}-500/10`}>
                            {e.engine}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-white">{e.tool}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{e.desc}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
