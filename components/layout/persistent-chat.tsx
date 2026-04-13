'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  Send,
  Hash,
  Circle,
  Plus,
  Reply,
  Edit3,
  Trash2,
  Gamepad2,
  Bug,
  Megaphone,
  Globe,
  Loader2,
  LogIn,
  X,
  Minimize2,
  Maximize2,
  ChevronDown,
  Languages,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import {
  isChatEnabled,
  getCurrentUserId,
  autoSyncGSToSupabase,
  fetchRooms,
  fetchMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  createRoom,
  subscribeToRoom,
  subscribeToPresence,
  updatePresence,
  joinRoom,
  markRoomRead,
  type ChatRoom,
  type ChatMessage,
  type UserPresence,
} from '@/lib/community-chat';
import { translateChatMessage } from '@/lib/ai-translate-direct';
import { clientLogger } from '@/lib/client-logger';

// ─── Room icon helper ───────────────────────────────────────────

function getRoomIcon(type: ChatRoom['type']) {
  switch (type) {
    case 'game': return <Gamepad2 className="h-3.5 w-3.5 text-emerald-400" />;
    case 'feedback': return <Bug className="h-3.5 w-3.5 text-amber-400" />;
    case 'announcement': return <Megaphone className="h-3.5 w-3.5 text-red-400" />;
    case 'translation_request': return <Globe className="h-3.5 w-3.5 text-cyan-400" />;
    default: return <Hash className="h-3.5 w-3.5 text-slate-400" />;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'ora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m fa`;
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── PERSISTENT CHAT WIDGET ─────────────────────────────────────

export function PersistentChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gs_chat_open') === 'true';
    }
    return false;
  });
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomType, setNewRoomType] = useState<ChatRoom['type']>('general');
  const [showRooms, setShowRooms] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [autoTranslate, setAutoTranslate] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('gs_chat_auto_translate') === 'true';
    return false;
  });
  const { language } = useTranslation();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const unsubMessageRef = useRef<(() => void) | null>(null);
  const unsubPresenceRef = useRef<(() => void) | null>(null);

  // Persist open state
  useEffect(() => {
    localStorage.setItem('gs_chat_open', String(open));
  }, [open]);

  // ─── Init ───────────────────────────────────────────────────
  useEffect(() => {
    const chatEnabled = isChatEnabled();
    setEnabled(chatEnabled);
    if (!chatEnabled) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      const timeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
        Promise.race([promise, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

      try {
        let uid = await timeout(getCurrentUserId(), 5000).catch(() => null);
        if (!uid) {
          uid = await timeout(autoSyncGSToSupabase(), 5000).catch(() => null);
        }
        setUserId(uid);
        const chatRooms = await timeout(fetchRooms(), 5000).catch(() => [] as ChatRoom[]);
        setRooms(chatRooms);
        if (chatRooms.length > 0) {
          setActiveRoom(chatRooms[0]);
        }
        if (uid) {
          updatePresence('online').catch(() => {});
          unsubPresenceRef.current = await timeout(subscribeToPresence((users) => {
            setOnlineUsers(users);
          }), 5000).catch(() => null);
        }
      } catch (e: unknown) {
        clientLogger.error('[PersistentChat] Init error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();

    return () => {
      unsubMessageRef.current?.();
      unsubPresenceRef.current?.();
      updatePresence('offline').catch(() => {});
    };
  }, []);

  // ─── Room change → load messages + subscribe ────────────────
  useEffect(() => {
    if (!activeRoom || !open) return;

    const loadRoom = async () => {
      try {
        const msgs = await fetchMessages(activeRoom.id, 50);
        setMessages(msgs);
        await joinRoom(activeRoom.id);
        await markRoomRead(activeRoom.id);

        unsubMessageRef.current?.();
        unsubMessageRef.current = await subscribeToRoom(activeRoom.id, (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // Notifica per messaggi di altri utenti
            if (newMsg.authorId !== userId) {
              if (!open) setUnreadCount((c) => c + 1);
              // Suono notifica (breve beep)
              try {
                const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                osc.type = 'sine';
                gain.gain.value = 0.08;
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.15);
              } catch {}
            }
            return [...prev, newMsg];
          });
        });
      } catch (e: unknown) {
        clientLogger.error('[PersistentChat] Load room error:', e);
      }
    };
    loadRoom();

    return () => {
      unsubMessageRef.current?.();
    };
  }, [activeRoom?.id, open]);

  // ─── Auto-scroll ────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear unread when opening
  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  // ─── Send message ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!messageInput.trim() || !activeRoom || isSending) return;

    const content = messageInput.trim();
    setIsSending(true);
    setMessageInput('');

    try {
      if (editingMsg) {
        await editMessage(editingMsg.id, content);
        setMessages((prev) =>
          prev.map((m) => (m.id === editingMsg.id ? { ...m, content, edited: true } : m))
        );
        setEditingMsg(null);
      } else {
        await sendMessage(activeRoom.id, content, 'text', replyTo?.id);
        setReplyTo(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore invio messaggio';
      toast.error(msg);
      setMessageInput(content);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [messageInput, activeRoom, isSending, editingMsg, replyTo]);

  // ─── Delete message ─────────────────────────────────────────
  const handleDelete = async (msg: ChatMessage) => {
    try {
      await deleteMessage(msg.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, deleted: true, content: '[messaggio eliminato]' } : m))
      );
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Errore eliminazione';
      toast.error(errMsg);
    }
  };

  // ─── Translate message ──────────────────────────────────────
  const handleTranslateMessage = useCallback(async (msg: ChatMessage) => {
    if (translatedMessages[msg.id]) {
      setTranslatedMessages(prev => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }
    setTranslatingIds(prev => new Set(prev).add(msg.id));
    try {
      const LANG_MAP: Record<string, string> = {
        it: 'Italian', en: 'English', es: 'Spanish', de: 'German',
        fr: 'French', pt: 'Portuguese', ja: 'Japanese', zh: 'Chinese',
        ko: 'Korean', ru: 'Russian', pl: 'Polish',
      };
      const targetLang = LANG_MAP[language] || 'Italian';
      const { translated } = await translateChatMessage(
        msg.content, targetLang,
      );
      setTranslatedMessages(prev => ({ ...prev, [msg.id]: translated }));
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Errore traduzione';
      toast.error(errMsg);
    } finally {
      setTranslatingIds(prev => { const next = new Set(prev); next.delete(msg.id); return next; });
    }
  }, [language, translatedMessages]);

  const toggleAutoTranslate = useCallback(() => {
    setAutoTranslate(prev => {
      const next = !prev;
      localStorage.setItem('gs_chat_auto_translate', String(next));
      return next;
    });
  }, []);

  const detectLangTag = useCallback((text: string): string | null => {
    if (/[\u0400-\u04FF]{3,}/.test(text)) return 'RU';
    if (/[\u4E00-\u9FFF]{2,}/.test(text)) return 'ZH';
    if (/[\u3040-\u309F\u30A0-\u30FF]{2,}/.test(text)) return 'JA';
    if (/[\uAC00-\uD7AF]{2,}/.test(text)) return 'KO';
    if (/[\u0600-\u06FF]{3,}/.test(text)) return 'AR';
    if (/[\u0E00-\u0E7F]{3,}/.test(text)) return 'TH';
    const LANG_HINTS: Record<string, RegExp> = {
      EN: /\b(the|and|this|that|with|have|from|they|what|your)\b/i,
      ES: /\b(que|los|las|por|una|con|para|esta|pero|como)\b/i,
      DE: /\b(und|die|der|das|ist|nicht|ein|ich|sich|auf)\b/i,
      FR: /\b(les|des|une|que|est|pas|pour|dans|sur|avec)\b/i,
      PT: /\b(que|não|para|com|uma|dos|está|isso|mais|por)\b/i,
    };
    const appLang = language.toUpperCase();
    for (const [lang, re] of Object.entries(LANG_HINTS)) {
      if (lang !== appLang && re.test(text)) return lang;
    }
    return null;
  }, [language]);

  useEffect(() => {
    if (!autoTranslate || messages.length === 0) return;
    for (const msg of messages) {
      if (msg.deleted || msg.authorId === userId) continue;
      if (translatedMessages[msg.id] || translatingIds.has(msg.id)) continue;
      const lang = detectLangTag(msg.content);
      if (lang) handleTranslateMessage(msg);
    }
  }, [autoTranslate, messages, userId, translatedMessages, translatingIds, detectLangTag, handleTranslateMessage]);

  // ─── Create room ────────────────────────────────────────────
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const room = await createRoom(newRoomName.trim(), newRoomDesc.trim(), newRoomType);
      setRooms((prev) => [room, ...prev]);
      setActiveRoom(room);
      setShowNewRoom(false);
      setNewRoomName('');
      setNewRoomDesc('');
      toast.success('Stanza creata!');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Errore creazione stanza';
      toast.error(errMsg);
    }
  };

  // Don't render if chat backend not configured
  if (!enabled) return null;

  // Hide on community-hub page (has its own inline chat)
  if (pathname?.includes('community')) return null;

  const chatWidth = expanded ? 'w-[480px]' : 'w-[360px]';
  const chatHeight = expanded ? 'h-[600px]' : 'h-[420px]';

  // ─── FLOATING TOGGLE BUTTON ─────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-48 z-50 flex items-center gap-2 px-3 py-2.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/40 transition-all hover:scale-105 active:scale-95"
      >
        <MessageSquare className="h-5 w-5" />
        <span className="text-sm font-medium">Chat</span>
        {unreadCount > 0 && (
          <span className="flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-2xs font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {onlineUsers.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] opacity-80">
            <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
            {onlineUsers.length}
          </span>
        )}
      </button>
    );
  }

  // ─── CHAT PANEL ─────────────────────────────────────────────

  return (
    <>
      <div className={`fixed bottom-14 right-4 z-50 ${chatWidth} ${chatHeight} flex flex-col rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 transition-all duration-200`}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/40 bg-slate-800/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">Community Chat</span>
            {onlineUsers.length > 0 && (
              <Badge variant="outline" className="text-2xs h-5 px-1.5 border-emerald-500/30 text-emerald-400">
                <Circle className="h-1.5 w-1.5 fill-emerald-400 mr-1" />
                {onlineUsers.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="xs" className="w-6 p-0" onClick={() => setExpanded(!expanded)}>
              {expanded ? <Minimize2 className="h-3.5 w-3.5 text-slate-400" /> : <Maximize2 className="h-3.5 w-3.5 text-slate-400" />}
            </Button>
            <Button variant="ghost" size="xs" className="w-6 p-0" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </div>
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        )}

        {/* ── Not authenticated ── */}
        {!isLoading && !userId && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-4">
            <LogIn className="h-8 w-8 text-slate-500" />
            <p className="text-xs text-slate-400">Effettua il login per chattare</p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={async () => {
                setIsLoading(true);
                const uid = await autoSyncGSToSupabase();
                if (uid) {
                  setUserId(uid);
                  const chatRooms = await fetchRooms();
                  setRooms(chatRooms);
                  if (chatRooms.length > 0) setActiveRoom(chatRooms[0]);
                  updatePresence('online');
                }
                setIsLoading(false);
              }}
            >
              <LogIn className="h-3 w-3 mr-1" /> Connetti
            </Button>
          </div>
        )}

        {/* ── Chat content ── */}
        {!isLoading && userId && (
          <>
            {/* Room selector bar */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-700/30 bg-slate-850/30">
              <button
                onClick={() => setShowRooms(!showRooms)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-xs text-slate-300"
              >
                {activeRoom && getRoomIcon(activeRoom.type)}
                <span className="font-medium truncate max-w-[180px]">{activeRoom?.name || 'Stanze'}</span>
                <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${showRooms ? 'rotate-180' : ''}`} />
              </button>
              <Button
                variant="ghost"
                size="xs"
                className={`w-6 p-0 ml-auto ${autoTranslate ? 'text-cyan-400' : 'text-slate-500'}`}
                onClick={toggleAutoTranslate}
                title={autoTranslate ? 'Disattiva auto-traduzione' : 'Auto-traduci messaggi'}
              >
                <Languages className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="xs" className="w-6 p-0" onClick={() => setShowNewRoom(true)}>
                <Plus className="h-3 w-3 text-slate-500" />
              </Button>
            </div>

            {/* Room dropdown */}
            {showRooms && (
              <div className="border-b border-slate-700/30 bg-slate-800/50 max-h-40 overflow-y-auto">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => { setActiveRoom(room); setShowRooms(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                      activeRoom?.id === room.id
                        ? 'bg-slate-700/50 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200'
                    }`}
                  >
                    {getRoomIcon(room.type)}
                    <span className="truncate">{room.name}</span>
                    {room.isPinned && <span className="text-micro">📌</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 px-2 py-1.5">
              <div className="space-y-0.5">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                    <MessageSquare className="h-6 w-6 mb-1.5 opacity-30" />
                    <span className="text-xs">Nessun messaggio</span>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isOwn = msg.authorId === userId;
                  const showAvatar = i === 0 || messages[i - 1]?.authorId !== msg.authorId;
                  return (
                    <div
                      key={msg.id}
                      className={`group flex items-start gap-1.5 px-1 py-0.5 rounded hover:bg-slate-800/30 ${
                        msg.deleted ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="w-6 flex-shrink-0">
                        {showAvatar && (
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={msg.authorAvatar} />
                            <AvatarFallback className="text-2xs bg-slate-700">
                              {(msg.authorName || '?')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {showAvatar && (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-bold ${isOwn ? 'text-cyan-400' : 'text-orange-400'}`}>
                              {msg.authorName || 'Utente'}
                            </span>
                            <span className="text-micro text-slate-600">{formatTime(msg.createdAt)}</span>
                            {(() => {
                              const lang = detectLangTag(msg.content);
                              return lang ? (
                                <span className="text-micro px-0.5 rounded bg-slate-700/50 text-slate-400 font-mono">{lang}</span>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {msg.replyTo && (
                          <div className="text-micro text-slate-500 border-l-2 border-slate-600 pl-1.5 mb-0.5 truncate">
                            ↳ risposta
                          </div>
                        )}
                        <p className="text-[12px] text-slate-300 break-words leading-relaxed">{msg.content}</p>
                        {translatedMessages[msg.id] && (
                          <p className="text-[12px] text-cyan-300/80 break-words leading-relaxed mt-0.5 border-l-2 border-cyan-500/30 pl-2">
                            {translatedMessages[msg.id]}
                          </p>
                        )}
                      </div>
                      {!msg.deleted && (
                        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => handleTranslateMessage(msg)} title={translatedMessages[msg.id] ? 'Nascondi traduzione' : 'Traduci messaggio'}>
                            {translatingIds.has(msg.id) ? (
                              <Loader2 className="h-2.5 w-2.5 text-cyan-400 animate-spin" />
                            ) : (
                              <Languages className={`h-2.5 w-2.5 ${translatedMessages[msg.id] ? 'text-cyan-400' : 'text-slate-500'}`} />
                            )}
                          </Button>
                          {isOwn && (
                            <>
                              <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => { setEditingMsg(msg); setMessageInput(msg.content); inputRef.current?.focus(); }}>
                                <Edit3 className="h-2.5 w-2.5 text-slate-500" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => handleDelete(msg)}>
                                <Trash2 className="h-2.5 w-2.5 text-red-500/50" />
                              </Button>
                            </>
                          )}
                          {!isOwn && (
                            <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}>
                              <Reply className="h-2.5 w-2.5 text-slate-500" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Reply/Edit indicator */}
            {(replyTo || editingMsg) && (
              <div className="px-2 py-1 bg-slate-800/50 border-t border-slate-700/30 flex items-center justify-between">
                <span className="text-2xs text-slate-400">
                  {editingMsg ? '✏️ Modifica' : <>↳ Rispondi a <strong className="text-orange-400">{replyTo?.authorName}</strong></>}
                </span>
                <Button variant="ghost" size="sm" className="h-4 text-micro px-1" onClick={() => { setReplyTo(null); setEditingMsg(null); setMessageInput(''); }}>
                  Annulla
                </Button>
              </div>
            )}

            {/* Input */}
            <div className="p-2 border-t border-slate-700/30">
              <div className="flex items-center gap-1.5">
                <Input
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={activeRoom ? `#${activeRoom.name}...` : 'Seleziona stanza...'}
                  className="h-8 text-xs bg-slate-800/50 border-slate-700/50"
                  disabled={!activeRoom || isSending}
                />
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 bg-cyan-600 hover:bg-cyan-700"
                  onClick={handleSend}
                  disabled={!messageInput.trim() || !activeRoom || isSending}
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Create Room Dialog ── */}
      <Dialog open={showNewRoom} onOpenChange={setShowNewRoom}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova stanza</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="es. Hollow Knight IT" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Descrizione</Label>
              <Textarea value={newRoomDesc} onChange={(e) => setNewRoomDesc(e.target.value)} placeholder="Di cosa si parla?" className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={newRoomType} onValueChange={(v: string) => setNewRoomType(v as ChatRoom['type'])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">💬 Generale</SelectItem>
                  <SelectItem value="game">🎮 Gioco specifico</SelectItem>
                  <SelectItem value="translation_request">🌍 Richiesta traduzione</SelectItem>
                  <SelectItem value="feedback">🐛 Feedback & Bug</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRoom(false)}>Annulla</Button>
            <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()}>Crea stanza</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
