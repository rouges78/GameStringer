'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquarePlus, Bug, Lightbulb } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';

/**
 * Pagina dedicata al feedback, raggiungibile dalla sidebar (gruppo Risorse).
 *
 * Esiste perché fino al 30/07/2026 il feedback era sepolto nelle Impostazioni:
 * un solo punto di montaggio, e nessun utente lo trovava. Il form si apre già
 * al caricamento della pagina — chi arriva qui vuole scrivere, non cercare un
 * altro pulsante.
 */
export default function FeedbackPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquarePlus className="h-6 w-6 text-sky-400" />
          {t('feedback.pageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('feedback.pageDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            {t('feedback.pageWhatTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 text-sm">
            <Bug className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{t('feedback.pageWhatBug')}</span>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{t('feedback.pageWhatIdea')}</span>
          </div>

          <Button onClick={() => setOpen(true)} className="gap-1.5 mt-2">
            <MessageSquarePlus className="h-4 w-4" />
            {t('feedback.openButton')}
          </Button>
        </CardContent>
      </Card>

      <FeedbackDialog open={open} onOpenChange={setOpen} source="page" />
    </div>
  );
}
