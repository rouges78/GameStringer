'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  MessageCircle,
  Send,
  Copy,
  Mail,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { useVersion } from '@/lib/version';
import { getSupabase } from '@/lib/social/community-hub-backend';
import { clientLogger } from '@/lib/client-logger';
import type { FeedbackSource } from '@/lib/feedback-bus';

// Indirizzo di fallback (placeholder): funziona anche senza backend Supabase.
const FEEDBACK_EMAIL = 'feedback@gamestringer.ai';

type FeedbackCategory = 'bug' | 'idea' | 'other';

interface FeedbackContext {
  appVersion: string;
  platform: string;
  route: string;
  gameId: string | null;
  userAgent: string | null;
  ts: string;
  /** Punto d'ingresso da cui è stato aperto il dialog. */
  source: FeedbackSource;
}

// Rileva OS + ambiente (Tauri/Web) in modo best-effort dallo userAgent.
// Nessuna dipendenza da API asincrone: sicuro anche fuori da Tauri.
function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  let os = 'unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  const isTauri =
    typeof window !== 'undefined' &&
    ('__TAURI_IPC__' in window || '__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  return `${os} · ${isTauri ? 'Tauri' : 'Web'}`;
}

// Report testuale usato per gli appunti e per il corpo della mail (fallback
// senza DB). Non è testo JSX: le stringhe fisse qui NON sono user-facing i18n.
function buildReport(category: FeedbackCategory, message: string, ctx: FeedbackContext): string {
  return [
    'GameStringer — feedback',
    `category: ${category}`,
    '',
    message.trim(),
    '',
    '--- context ---',
    `version: ${ctx.appVersion}`,
    `platform: ${ctx.platform}`,
    `route: ${ctx.route}`,
    `game: ${ctx.gameId ?? '-'}`,
    `source: ${ctx.source}`,
    `userAgent: ${ctx.userAgent ?? '-'}`,
    `timestamp: ${ctx.ts}`,
  ].join('\n');
}

export interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Punto d'ingresso, allegato al report per misurare quale canale raccoglie. */
  source?: FeedbackSource;
}

/**
 * Dialog di feedback, controllato dall'esterno. Estratto da `feedback-widget`
 * il 30/07/2026 per poter essere aperto anche da sidebar, pagina dedicata e
 * invito post-traduzione, non solo dalle Impostazioni.
 */
export function FeedbackDialog({ open, onOpenChange, source = 'other' }: FeedbackDialogProps) {
  const { t } = useTranslation();
  const { version } = useVersion();
  const pathname = usePathname();

  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedToDb, setSavedToDb] = useState(false);
  const [platform, setPlatform] = useState('');

  // navigator è disponibile solo lato client → calcolo dopo il mount.
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Contesto gioco best-effort: le rotte di gioco sono /library/<id>.
  const gameId = useMemo(() => {
    const m = /\/library\/([^/?#]+)/.exec(pathname || '');
    return m ? decodeURIComponent(m[1]) : null;
  }, [pathname]);

  const context = useMemo<FeedbackContext>(
    () => ({
      appVersion: version,
      platform,
      route: pathname || '/',
      gameId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ts: new Date().toISOString(),
      source,
    }),
    [version, platform, pathname, gameId, source],
  );

  const report = useMemo(() => buildReport(category, message, context), [category, message, context]);

  const mailtoHref = useMemo(() => {
    const subject = `GameStringer feedback [${category}]`;
    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(report)}`;
  }, [category, report]);

  const resetForm = useCallback(() => {
    setCategory('bug');
    setMessage('');
    setSent(false);
    setSavedToDb(false);
    setSending(false);
  }, []);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      onOpenChange(v);
      if (!v) resetForm();
    },
    [onOpenChange, resetForm],
  );

  const copyReport = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(report);
      return true;
    } catch {
      return false;
    }
  }, [report]);

  const handleCopy = useCallback(async () => {
    const ok = await copyReport();
    if (ok) toast.success(t('feedback.copied'));
    else toast.error(t('feedback.copyFailed'));
  }, [copyReport, t]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) {
      toast.error(t('feedback.messageRequired'));
      return;
    }
    setSending(true);

    // 1) Prova l'insert su Supabase — fail-open: qualunque errore non blocca.
    let dbOk = false;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from('feedback').insert({
        category,
        message: message.trim(),
        context,
        created_at: new Date().toISOString(),
      });
      if (!error) dbOk = true;
      else clientLogger.warn('[feedback] insert non riuscito:', error.message);
    } catch (e: unknown) {
      // Backend non configurato / offline: si passa al fallback.
      clientLogger.warn('[feedback] Supabase non disponibile:', String(e));
    }

    // 2) Fallback SEMPRE disponibile: copia il report negli appunti.
    const copied = await copyReport();

    setSavedToDb(dbOk);
    setSending(false);
    setSent(true);

    if (dbOk) toast.success(t('feedback.sentDb'));
    else if (copied) toast.success(t('feedback.sentFallbackCopied'));
    else toast.info(t('feedback.sentFallbackManual'));
  }, [message, category, context, copyReport, t]);

  const categories: { value: FeedbackCategory; label: string; icon: typeof Bug }[] = [
    { value: 'bug', label: t('feedback.category.bug'), icon: Bug },
    { value: 'idea', label: t('feedback.category.idea'), icon: Lightbulb },
    { value: 'other', label: t('feedback.category.other'), icon: MessageCircle },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-sky-400" />
            {t('feedback.dialogTitle')}
          </DialogTitle>
          <DialogDescription>{t('feedback.dialogDesc')}</DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-emerald-400">{t('feedback.thanksTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {savedToDb ? t('feedback.thanksDb') : t('feedback.thanksFallback')}
            </p>
            {!savedToDb && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  {t('feedback.copyReport')}
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={mailtoHref}>
                    <Mail className="h-3.5 w-3.5" />
                    {t('feedback.email')}
                  </a>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Categoria */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('feedback.categoryLabel')}</Label>
              <div className="flex items-center gap-2">
                {categories.map((c) => {
                  const Icon = c.icon;
                  const active = category === c.value;
                  return (
                    <Button
                      key={c.value}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => setCategory(c.value)}
                      className="gap-1.5 flex-1"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {c.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Messaggio */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('feedback.messageLabel')}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('feedback.messagePlaceholder')}
                className="h-28 text-sm"
              />
            </div>

            {/* Contesto automatico (read-only) */}
            <div className="space-y-2 p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
              <p className="text-2xs font-bold text-slate-500 uppercase tracking-widest">
                {t('feedback.contextTitle')}
              </p>
              <div className="grid grid-cols-1 gap-1 text-2xs text-slate-400">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t('feedback.ctxVersion')}</span>
                  <span className="font-mono truncate">{context.appVersion}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t('feedback.ctxPlatform')}</span>
                  <span className="font-mono truncate">{context.platform}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t('feedback.ctxRoute')}</span>
                  <span className="font-mono truncate">{context.route}</span>
                </div>
                {context.gameId && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">{t('feedback.ctxGame')}</span>
                    <span className="font-mono truncate">{context.gameId}</span>
                  </div>
                )}
              </div>
              <p className="text-micro text-slate-600">{t('feedback.contextNote')}</p>
            </div>
          </div>
        )}

        {!sent && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              {t('feedback.copyReport')}
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={mailtoHref}>
                <Mail className="h-3.5 w-3.5" />
                {t('feedback.email')}
              </a>
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={sending || !message.trim()} className="gap-1.5">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {t('feedback.submit')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
