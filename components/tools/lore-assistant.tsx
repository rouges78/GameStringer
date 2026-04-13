'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Send,
  Trash2,
  Sparkles,
  User,
  Bot,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { loreAssistant, type LoreResponse, type DialogueEntry } from '@/lib/lore-assistant';
import { useTranslation } from '@/lib/i18n';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  relevantDialogues?: DialogueEntry[];
  confidence?: number;
}

export function LoreAssistantChat({ defaultExpanded = true }: { defaultExpanded?: boolean }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showStats, setShowStats] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stats = loreAssistant?.getStats();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || !loreAssistant) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response: LoreResponse = await loreAssistant.ask({
        question: input.trim(),
        language: 'italiano',
      });

      const assistantMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        relevantDialogues: response.relevantDialogues,
        confidence: response.confidence,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Errore nella richiesta. Assicurati che Ollama sia in esecuzione o configura un provider cloud.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-500/20 hover:border-amber-400/40 transition-all text-xs"
      >
        <BookOpen className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-amber-300">{t('loreAssistantComp.loreAssistant')}</span>
        {stats && stats.totalDialogues > 0 && (
          <Badge variant="outline" className="text-micro px-1.5 py-0 h-4 border-amber-500/20 text-amber-400">
            {stats.totalDialogues} dialoghi
          </Badge>
        )}
        <ChevronUp className="h-3 w-3 text-amber-500/50" />
      </button>
    );
  }

  return (
    <Card className="border-amber-500/20 bg-amber-950/20 backdrop-blur-sm">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">{t('loreAssistantComp.loreAssistant')}</span>
            <Badge variant="outline" className="text-micro px-1.5 py-0 h-4 border-amber-500/20 text-amber-400">
              {stats?.totalDialogues || 0} dialoghi
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowStats(!showStats)} title="Statistiche">
              <Info className="h-3 w-3 text-amber-400/50" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setMessages([]); }} title="Pulisci chat">
              <Trash2 className="h-3 w-3 text-amber-400/50" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(false)}>
              <ChevronDown className="h-3 w-3 text-amber-400/50" />
            </Button>
          </div>
        </div>

        {/* Stats panel */}
        {showStats && stats && (
          <div className="mb-2 p-2 rounded-lg bg-amber-950/30 border border-amber-500/10 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-amber-400/60">{t('loreAssistantComp.dialoghiMemorizzati')}</span>
              <span className="text-amber-300">{stats.totalDialogues}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-400/60">{t('loreAssistantComp.personaggiRilevati')}</span>
              <span className="text-amber-300">{stats.uniqueSpeakers}</span>
            </div>
            {stats.speakers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {stats.speakers.filter(Boolean).slice(0, 10).map((s) => (
                  <Badge key={s} variant="outline" className="text-2xs px-1 py-0 h-3.5 border-amber-500/20 text-amber-400/70">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat messages */}
        <div ref={scrollRef} className="space-y-2 max-h-64 overflow-y-auto mb-2">
          {messages.length === 0 ? (
            <div className="text-center py-6">
              <Sparkles className="h-8 w-8 text-amber-400/20 mx-auto mb-2" />
              <p className="text-xs text-amber-400/40">{t('loreAssistantComp.chiediQualsiasiCosaSullaLoreDe')}</p>
              <p className="text-2xs text-amber-400/25 mt-1">&quot;Chi è questo personaggio?&quot; • &quot;Cosa è successo prima?&quot; • &quot;Dove mi trovo?&quot;</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Bot className="h-3 w-3 text-amber-400" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg p-2 ${
                  msg.role === 'user'
                    ? 'bg-violet-500/20 border border-violet-500/20 text-violet-100'
                    : 'bg-amber-950/40 border border-amber-500/10 text-amber-100'
                }`}>
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                  {msg.confidence != null && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        msg.confidence > 0.7 ? 'bg-emerald-400' : msg.confidence > 0.4 ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      <span className="text-micro text-amber-400/40">
                        Confidenza: {Math.round(msg.confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-violet-400" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Bot className="h-3 w-3 text-amber-400 animate-pulse" />
              </div>
              <div className="bg-amber-950/40 border border-amber-500/10 rounded-lg p-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Chiedi sulla lore del gioco..."
            className="h-8 text-xs bg-amber-950/30 border-amber-500/20 placeholder:text-amber-400/30"
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="sm"
            className="h-8 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default LoreAssistantChat;
