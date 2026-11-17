'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

/**
 * 404 come finestra di dialogo da JRPG (identità B): bordo doppio, titolo in
 * pixel, una sola via d'uscita col cursore ▶. Sostituisce la pagina di Next,
 * che era in inglese fisso dentro un'interfaccia in 12 lingue.
 */
export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-md border border-border bg-popover p-6 text-popover-foreground outline outline-1 outline-offset-[3px] outline-border/70">
        <p className="font-pixel text-3xl leading-none text-primary">404</p>
        <h1 className="mt-3 text-lg font-semibold">{t('notFound.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('notFound.message')}</p>
        <div className="mt-6 flex justify-end">
          <Button asChild>
            <Link href="/">
              <span aria-hidden className="mr-2 text-[10px]">▶</span>
              {t('notFound.back')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
