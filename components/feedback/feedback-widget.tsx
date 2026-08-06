'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquarePlus } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';

/**
 * Card di feedback per la pagina Impostazioni.
 *
 * La logica del form vive in `FeedbackDialog`: qui resta solo il contenitore.
 * Estrazione fatta il 30/07/2026 perché questo era l'UNICO punto di montaggio
 * del feedback in tutta l'app (`app/settings/page.tsx`), e la tabella `feedback`
 * era di conseguenza vuota. Vedi anche `components/feedback/feedback-host.tsx`.
 */
export function FeedbackWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          <MessageSquarePlus className="h-4 w-4 text-sky-400" />
          {t('feedback.cardTitle')}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{t('feedback.cardDesc')}</p>
      </CardHeader>
      <CardContent>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          {t('feedback.openButton')}
        </Button>
      </CardContent>

      <FeedbackDialog open={open} onOpenChange={setOpen} source="settings" />
    </Card>
  );
}
