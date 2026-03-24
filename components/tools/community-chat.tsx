'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  MessageSquare,
  Send,
  Hash,
  Users,
  Circle,
  ArrowLeft,
  Plus,
  Reply,
  Edit3,
  Trash2,
  Gamepad2,
  Bug,
  Megaphone,
  Globe,
  Loader2,
  WifiOff,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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

// ─── Room icon helper ───────────────────────────────────────────

function getRoomIcon(type: ChatRoom['type']) {
  switch (type) {
    case 'game': return <Gamepad2 className="h-4 w-4 text-emerald-400" />;
    case 'feedback': return <Bug className="h-4 w-4 text-amber-400" />;
    case 'announcement': return <Megaphone className="h-4 w-4 text-red-400" />;
    case 'translation_request': return <Globe className="h-4 w-4 text-cyan-400" />;
    default: return <Hash className="h-4 w-4 text-slate-400" />;
  }
}

// ─── Time formatter ─────────────────────────────────────────────

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

// ─── MAIN COMPONENT ─────────────────────────────────────────────

export function CommunityChat() {
  const { t } = useTranslation();
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const unsubMessageRef = useRef<(() => void) | null>(null);
  const unsubPresenceRef = useRef<(() => void) | null>(null);

  // ─── Init ───────────────────────────────────────────────────

  useEffect(() => {
    const chatEnabled = isChatEnabled();
    setEnabled(chatEnabled);
    if (!chatEnabled) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        // Try to auto-bridge GS account to Supabase
        let uid = await getCurrentUserId();
        if (!uid) {
          uid = await autoSyncGSToSupabase();
        }
        setUserId(uid);
        const chatRooms = await fetchRooms();
        setRooms(chatRooms);
        if (chatRooms.length > 0) {
          setActiveRoom(chatRooms[0]);
        }
        // Start presence
        if (uid) {
          updatePresence('online');
          unsubPresenceRef.current = await subscribeToPresence((users) => {
            setOnlineUsers(users);
          });
        }
      } catch (e: any) {
        console.error('[Chat] Init error:', e);
        toast.error(e.message || 'Errore inizializzazione chat');
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
    if (!activeRoom) return;

    const loadRoom = async () => {
      try {
        const msgs = await fetchMessages(activeRoom.id, 80);
        setMessages(msgs);
        await joinRoom(activeRoom.id);
        await markRoomRead(activeRoom.id);

        // Subscribe to new messages
        unsubMessageRef.current?.();
        unsubMessageRef.current = await subscribeToRoom(activeRoom.id, (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        });
      } catch (e: any) {
        console.error('[Chat] Load room error:', e);
      }
    };
    loadRoom();

    return () => {
      unsubMessageRef.current?.();
    };
  }, [activeRoom?.id]);

  // ─── Auto-scroll ────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    } catch (e: any) {
      toast.error(e.message || 'Errore invio messaggio');
      setMessageInput(content); // restore
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
    } catch (e: any) {
      toast.error(e.message || 'Errore eliminazione');
    }
  };

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
    } catch (e: any) {
      toast.error(e.message || 'Errore creazione stanza');
    }
  };

  // ─── NOT ENABLED STATE ────────────────────────────────────────

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-4">
        <WifiOff className="h-12 w-12 text-slate-500" />
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Chat offline</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            Per usare la chat, configura il backend Supabase in <strong>Impostazioni → Community Hub Backend</strong>.
          </p>
        </div>
      </div>
    );
  }

  // ─── NOT AUTHENTICATED STATE ──────────────────────────────────

  if (!isLoading && !userId) {
    const handleRetrySync = async () => {
      setIsLoading(true);
      try {
        const uid = await autoSyncGSToSupabase();
        if (uid) {
          setUserId(uid);
          const chatRooms = await fetchRooms();
          setRooms(chatRooms);
          if (chatRooms.length > 0) setActiveRoom(chatRooms[0]);
          updatePresence('online');
          toast.success('Connesso alla chat community!');
        } else {
          toast.error('Devi prima effettuare il login in GameStringer.');
        }
      } catch (e: any) {
        toast.error(e.message || 'Errore connessione');
      } finally {
        setIsLoading(false);
      }
    };
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-4">
        <LogIn className="h-12 w-12 text-slate-500" />
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Accedi per chattare</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            Effettua il login in GameStringer per partecipare alla chat community.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRetrySync} className="gap-2">
          <LogIn className="h-4 w-4" />
          Riprova connessione
        </Button>
      </div>
    );
  }

  // ─── LOADING STATE ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  // ─── MAIN CHAT UI ─────────────────────────────────────────────

  return (
    <div className="flex h-full rounded-lg border border-slate-700/50 bg-slate-900/50 overflow-hidden">
      {/* ── Sidebar: Rooms + Online Users ── */}
      <div className="w-56 flex-shrink-0 border-r border-slate-700/50 flex flex-col">
        {/* Rooms header */}
        <div className="p-3 border-b border-slate-700/30 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stanze</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowNewRoom(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Room list */}
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors ${
                  activeRoom?.id === room.id
                    ? 'bg-slate-700/60 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                {getRoomIcon(room.type)}
                <span className="truncate flex-1 text-xs font-medium">{room.name}</span>
                {room.isPinned && <span className="text-[10px] text-yellow-500">📌</span>}
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Online users */}
        <div className="border-t border-slate-700/30 p-2">
          <div className="flex items-center gap-1.5 px-1 mb-1.5">
            <Users className="h-3 w-3 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Online — {onlineUsers.length}
            </span>
          </div>
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {onlineUsers.slice(0, 10).map((u) => (
              <div key={u.userId} className="flex items-center gap-1.5 px-1 py-0.5">
                <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
                <span className="text-[11px] text-slate-400 truncate">{u.username}</span>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <span className="text-[10px] text-slate-600 px-1">Nessuno online</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col">
        {/* Room header */}
        {activeRoom && (
          <div className="h-11 px-4 flex items-center gap-2 border-b border-slate-700/30 bg-slate-900/30">
            {getRoomIcon(activeRoom.type)}
            <span className="text-sm font-semibold text-slate-200">{activeRoom.name}</span>
            {activeRoom.description && (
              <span className="text-[11px] text-slate-500 truncate ml-2">{activeRoom.description}</span>
            )}
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                <span className="text-sm">Nessun messaggio. Inizia la conversazione!</span>
              </div>
            )}
            {messages.map((msg, i) => {
              const isOwn = msg.authorId === userId;
              const showAvatar = i === 0 || messages[i - 1]?.authorId !== msg.authorId;
              return (
                <div
                  key={msg.id}
                  className={`group flex items-start gap-2 px-1 py-0.5 rounded hover:bg-slate-800/30 ${
                    msg.deleted ? 'opacity-40' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-8 flex-shrink-0">
                    {showAvatar && (
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={msg.authorAvatar} />
                        <AvatarFallback className="text-[10px] bg-slate-700">
                          {(msg.authorName || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isOwn ? 'text-cyan-400' : 'text-orange-400'}`}>
                          {msg.authorName || 'Utente'}
                        </span>
                        <span className="text-[10px] text-slate-600">{formatTime(msg.createdAt)}</span>
                        {msg.edited && <span className="text-[9px] text-slate-600">(modificato)</span>}
                      </div>
                    )}

                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div className="text-[10px] text-slate-500 border-l-2 border-slate-600 pl-2 mb-0.5 truncate">
                        ↳ risposta a un messaggio
                      </div>
                    )}

                    <p className="text-[13px] text-slate-300 break-words leading-relaxed">{msg.content}</p>
                  </div>

                  {/* Actions (hover) */}
                  {isOwn && !msg.deleted && (
                    <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          setEditingMsg(msg);
                          setMessageInput(msg.content);
                          inputRef.current?.focus();
                        }}
                      >
                        <Edit3 className="h-3 w-3 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => handleDelete(msg)}
                      >
                        <Trash2 className="h-3 w-3 text-red-500/50" />
                      </Button>
                    </div>
                  )}
                  {!isOwn && !msg.deleted && (
                    <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          setReplyTo(msg);
                          inputRef.current?.focus();
                        }}
                      >
                        <Reply className="h-3 w-3 text-slate-500" />
                      </Button>
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
          <div className="px-3 py-1.5 bg-slate-800/50 border-t border-slate-700/30 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {editingMsg ? (
                <>✏️ Modifica messaggio</>
              ) : (
                <>↳ Rispondi a <strong className="text-orange-400">{replyTo?.authorName}</strong></>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5"
              onClick={() => {
                setReplyTo(null);
                setEditingMsg(null);
                setMessageInput('');
              }}
            >
              Annulla
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="p-2.5 border-t border-slate-700/30">
          <div className="flex items-center gap-2">
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
              placeholder={
                activeRoom
                  ? `Scrivi in #${activeRoom.name}...`
                  : 'Seleziona una stanza...'
              }
              className="h-9 text-sm bg-slate-800/50 border-slate-700/50"
              disabled={!activeRoom || isSending}
            />
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-cyan-600 hover:bg-cyan-700"
              onClick={handleSend}
              disabled={!messageInput.trim() || !activeRoom || isSending}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
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
              <Input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="es. Hollow Knight IT"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Descrizione</Label>
              <Textarea
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder="Di cosa si parla in questa stanza?"
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={newRoomType} onValueChange={(v: any) => setNewRoomType(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowNewRoom(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()}>
              Crea stanza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
