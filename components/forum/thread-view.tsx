'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  ArrowLeft,
  MessageSquare,
  Heart,
  Download,
  Share2,
  Flag,
  MoreHorizontal,
  Pin,
  Lock,
  CheckCircle2,
  Edit,
  Trash2,
  Quote,
  Reply,
  Send,
  Eye,
  Clock,
  Gamepad2,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getThread,
  getPosts,
  createPost,
  toggleLike,
  trackDownload,
  markAsSolution,
  updateThread,
  deleteThread,
  type ForumThread,
  type ForumPost,
  type ForumCategory,
} from '@/lib/social/forum';
import { getCurrentUserId } from '@/lib/social/auth-bridge';
import { formatDistanceToNow, format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

// ─── THREAD VIEW ─────────────────────────────────────────────────────────────

interface ThreadViewProps {
  threadId: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  onBack?: () => void;
}

export function ThreadView({ threadId, userId, userName, userAvatar, onBack }: ThreadViewProps) {
  const { language } = useTranslation();
  const locale = language === 'it' ? it : enUS;
  
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<ForumPost | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Identità SUPABASE dell'utente. Serve perché `thread.author_id` è l'uid
  // Supabase, mentre la prop `userId` è l'id del profilo LOCALE: confrontarli
  // direttamente dava sempre falso, quindi all'autore non comparivano mai
  // "Modifica" ed "Elimina" sul proprio thread.
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentUserId()
      .then(uid => { if (!cancelled) setAuthUserId(uid); })
      .catch(() => { /* backend community non raggiungibile: resta null */ });
    return () => { cancelled = true; };
  }, []);

  const isAuthor = !!authUserId && !!thread && authUserId === thread.author_id;

  // ─── LOAD DATA ─────────────────────────────────────────────────────────────
  
  const { t } = useTranslation();
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [threadData, postsData] = await Promise.all([
        getThread(threadId, userId),
        getPosts(threadId, userId),
      ]);
      
      if (threadData) {
        setThread(threadData);
        setLiked(threadData.user_liked || false);
        setLikeCount(threadData.like_count);
      }
      setPosts(postsData);
    } catch (error) {
      console.error('[ThreadView] Error loading:', error);
      toast.error(t('common.erroreNelCaricamentoDelThread'));
    } finally {
      setLoading(false);
    }
  }, [threadId, userId]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // ─── HANDLERS ──────────────────────────────────────────────────────────────
  
  const startEdit = () => {
    if (!thread) return;
    setEditTitle(thread.title);
    setEditContent(thread.content);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!thread) return;
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error(t('forum.editEmpty'));
      return;
    }
    setSavingEdit(true);
    try {
      const ok = await updateThread(thread.id, { title: editTitle.trim(), content: editContent.trim() });
      if (ok) {
        setThread({ ...thread, title: editTitle.trim(), content: editContent.trim() });
        setEditing(false);
        toast.success(t('forum.editSaved'));
      } else {
        toast.error(t('forum.editFailed'));
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!thread) return;
    setDeleting(true);
    try {
      const ok = await deleteThread(thread.id);
      if (ok) {
        toast.success(t('forum.deleteDone'));
        onBack?.();
      } else {
        toast.error(t('forum.deleteFailed'));
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleLike = async () => {
    if (!userId) {
      toast.error('Devi essere loggato per mettere mi piace');
      return;
    }
    
    const success = await toggleLike(userId, threadId);
    if (success) {
      setLiked(!liked);
      setLikeCount(prev => liked ? prev - 1 : prev + 1);
    }
  };
  
  const handleDownload = async () => {
    if (!thread?.pack_data?.download_url) return;
    
    await trackDownload(threadId, userId);
    window.open(thread.pack_data.download_url, '_blank');
    toast.success(t('common.downloadAvviato'));
  };
  
  const handleShare = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t('common.linkCopiato'));
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleReply = async () => {
    if (!userId || !userName) {
      toast.error('Devi essere loggato per rispondere');
      return;
    }
    
    if (!replyContent.trim()) {
      toast.error(t('common.scriviQualcosaPrimaDiInviare'));
      return;
    }
    
    setSubmitting(true);
    try {
      const post = await createPost(
        {
          thread_id: threadId,
          content: replyContent,
          reply_to_id: replyingTo?.id,
          quote_text: replyingTo ? replyingTo.content.substring(0, 200) : undefined,
        },
        { id: userId, name: userName, avatar: userAvatar }
      );
      
      if (post) {
        setPosts(prev => [...prev, post]);
        setReplyContent('');
        setReplyingTo(null);
        toast.success(t('common.rispostaPubblicata'));
      }
    } catch {
      toast.error(t('common.erroreNellaPubblicazione'));
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleMarkSolution = async (postId: string) => {
    if (!userId || thread?.author_id !== userId) {
      toast.error('Solo l\'autore può segnare una soluzione');
      return;
    }
    
    const success = await markAsSolution(postId, threadId);
    if (success) {
      setPosts(prev => prev.map(p => ({ ...p, is_solution: p.id === postId })));
      setThread(prev => prev ? { ...prev, is_solved: true } : null);
      toast.success(t('common.rispostaSegnataComeSoluzione'));
    }
  };
  
  // ─── RENDER ────────────────────────────────────────────────────────────────
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
        <p>{t('common.threadNonTrovato')}</p>
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Torna indietro
          </Button>
        )}
      </div>
    );
  }
  
  const category = thread.category as ForumCategory | undefined;
  
  return (
    <div className="space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        
        {category && (
          <Badge variant="secondary" style={{ backgroundColor: `${category.color}20`, color: category.color }}>
            {category.icon} {category.name}
          </Badge>
        )}
        
        {thread.is_pinned && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
            <Pin className="h-3 w-3 mr-1" /> Pinnato
          </Badge>
        )}
        {thread.is_locked && (
          <Badge variant="outline" className="border-red-500/50 text-red-400">
            <Lock className="h-3 w-3 mr-1" /> Chiuso
          </Badge>
        )}
        {thread.is_solved && (
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Risolto
          </Badge>
        )}
      </div>
      
      {/* ── MAIN POST ── */}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
        {/* Title */}
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h1 className="text-xl font-bold text-white">{thread.title}</h1>
          
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={thread.author_avatar || undefined} />
                <AvatarFallback className="text-xs">{thread.author_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-slate-300">{thread.author_name}</span>
            </div>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(thread.created_at), 'dd MMM yyyy, HH:mm', { locale })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {thread.view_count} visualizzazioni
            </span>
          </div>
        </div>
        
        {/* Pack Info */}
        {thread.is_translation_pack && thread.pack_data && (
          <div className="px-5 py-4 bg-amber-500/5 border-b border-amber-500/20">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-amber-400" />
                <span className="font-semibold text-white">{thread.pack_data.game_name}</span>
              </div>
              <Badge variant="secondary">{thread.pack_data.source_lang} → {thread.pack_data.target_lang}</Badge>
              <Badge variant="outline">{thread.pack_data.string_count?.toLocaleString()} stringhe</Badge>
              {thread.pack_data.version && <Badge variant="outline">v{thread.pack_data.version}</Badge>}
              {thread.pack_data.engine && <Badge variant="outline">{thread.pack_data.engine}</Badge>}
              
              <Button onClick={handleDownload} className="ml-auto bg-amber-600 hover:bg-amber-500">
                <Download className="h-4 w-4 mr-2" />
                Scarica Pack ({thread.download_count})
              </Button>
            </div>
          </div>
        )}
        
        {/* Content — in modifica diventa un editor per titolo e testo */}
        <div className="px-5 py-4">
          {editing ? (
            <div className="space-y-3">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full rounded-md bg-slate-900/80 border border-slate-700 px-3 py-2 text-white"
                placeholder={t('common.inserisciUnTitolo')}
              />
              <Textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={8}
                className="bg-slate-900/80 border-slate-700"
                placeholder={t('common.inserisciUnContenuto')}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit ? t('common.salvataggio') : t('common.salva')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={savingEdit}>
                  {t('common.annulla')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              {thread.content.split('\n').map((line, i) => (
                <p key={i} className="text-slate-300">{line || <br />}</p>
              ))}
            </div>
          )}
        </div>

        {/* Conferma eliminazione: mai un delete a un solo click */}
        {confirmDelete && (
          <div className="mx-5 mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">{t('forum.deleteConfirm')}</p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? t('common.eliminazione') : t('common.elimina')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                {t('common.annulla')}
              </Button>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="px-5 py-3 border-t border-slate-700/50 flex items-center gap-2">
          <Button
            variant={liked ? 'default' : 'ghost'}
            size="sm"
            onClick={handleLike}
            className={liked ? 'bg-pink-600 hover:bg-pink-500' : ''}
          >
            <Heart className={`h-4 w-4 mr-1 ${liked ? 'fill-current' : ''}`} />
            {likeCount}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={handleShare}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
            {copied ? 'Copiato!' : 'Condividi'}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Flag className="h-4 w-4 mr-2" /> Segnala
              </DropdownMenuItem>
              {isAuthor && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={startEdit}>
                    <Edit className="h-4 w-4 mr-2" /> {t('common.modifica')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-400" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4 mr-2" /> {t('common.elimina')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* ── REPLIES ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {posts.length} {posts.length === 1 ? 'risposta' : 'risposte'}
        </h2>
        
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            locale={locale}
            userId={userId}
            isThreadAuthor={isAuthor}
            onReply={() => setReplyingTo(post)}
            onMarkSolution={() => handleMarkSolution(post.id)}
          />
        ))}
      </div>
      
      {/* ── REPLY FORM ── */}
      {!thread.is_locked && (
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
          {replyingTo && (
            <div className="mb-3 p-2 rounded-lg bg-slate-700/50 border-l-2 border-blue-500 flex items-start gap-2">
              <Quote className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-blue-400 font-medium">Rispondi a {replyingTo.author_name}</span>
                <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{replyingTo.content}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)} className="h-6 w-6 p-0">
                ×
              </Button>
            </div>
          )}
          
          <Textarea
            placeholder={userId ? "Scrivi una risposta..." : "Effettua il login per rispondere"}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            disabled={!userId}
            className="min-h-[100px] bg-slate-900/50 border-slate-600/50"
          />
          
          <div className="flex justify-end mt-3">
            <Button onClick={handleReply} disabled={!userId || submitting || !replyContent.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Invio...' : 'Rispondi'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── POST CARD ───────────────────────────────────────────────────────────────

interface PostCardProps {
  post: ForumPost;
  locale: typeof it;
  userId?: string;
  isThreadAuthor?: boolean;
  onReply: () => void;
  onMarkSolution: () => void;
}

function PostCard({ post, locale, userId, isThreadAuthor, onReply, onMarkSolution }: PostCardProps) {
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  
  const handleLike = async () => {
    if (!userId) return;
    const success = await toggleLike(userId, undefined, post.id);
    if (success) {
      setLiked(!liked);
      setLikeCount(prev => liked ? prev - 1 : prev + 1);
    }
  };
  
  return (
    <div className={`rounded-lg border p-4 ${post.is_solution ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
      {/* Solution badge */}
      {post.is_solution && (
        <div className="flex items-center gap-2 mb-3 text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-semibold">SOLUZIONE ACCETTATA</span>
        </div>
      )}
      
      {/* Quote */}
      {post.quote_text && (
        <div className="mb-3 p-2 rounded bg-slate-700/30 border-l-2 border-slate-500 text-xs text-slate-400">
          <Quote className="h-3 w-3 inline mr-1" />
          {post.quote_text}
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={post.author_avatar || undefined} />
          <AvatarFallback className="text-xs">{post.author_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <span className="text-sm font-medium text-white">{post.author_name}</span>
          <span className="text-xs text-slate-500 ml-2">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale })}
            {post.is_edited && ' (modificato)'}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="text-sm text-slate-300 whitespace-pre-wrap">
        {post.content}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/30">
        <Button variant="ghost" size="sm" onClick={handleLike} className={liked ? 'text-pink-400' : ''}>
          <Heart className={`h-3.5 w-3.5 mr-1 ${liked ? 'fill-current' : ''}`} />
          {likeCount}
        </Button>
        
        <Button variant="ghost" size="sm" onClick={onReply}>
          <Reply className="h-3.5 w-3.5 mr-1" />
          Rispondi
        </Button>
        
        {isThreadAuthor && !post.is_solution && (
          <Button variant="ghost" size="sm" onClick={onMarkSolution} className="text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Segna come soluzione
          </Button>
        )}
      </div>
    </div>
  );
}

