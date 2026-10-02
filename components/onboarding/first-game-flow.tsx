'use client';

/**
 * FirstGameFlow — "Traduci il tuo primo gioco in 5 minuti".
 *
 * Flusso guidato che, dopo l'onboarding di base, propone all'utente il titolo
 * più FACILE già presente nella sua libreria (motore in lib/onboarding/first-game.ts)
 * e lo porta con un click alla traduzione. Obiettivo: far arrivare il momento
 * "wow" entro pochi minuti dall'installazione.
 *
 * Non-invasivo: appare una sola volta, solo dopo il tutorial iniziale, e solo
 * se la libreria è già stata scansionata. Tutto lo stato è in localStorage.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket, Sparkles, Clock, Gamepad2, Library, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { pickFirstGame, type FirstGameInput } from '@/lib/onboarding/first-game';
import { clientLogger } from '@/lib/client-logger';
import { isOnboardingDone, isTosAccepted, isTutorialDone, whenReady } from './first-run';

const DONE_KEY = 'gamestringer_first_game_done';

function toFirstGameInputs(raw: Array<Record<string, unknown>>): FirstGameInput[] {
  return raw.map((gm) => ({
    id: String(gm.id ?? gm.app_id ?? ''),
    title: String(gm.title ?? ''),
    engine: (gm.engine as string | null | undefined) ?? null,
    isInstalled: Boolean(gm.is_installed),
    // La Libreria salva install_dir; la scansione di avvio (GameInfo Rust) install_path.
    installDir: ((gm.install_dir ?? gm.install_path) as string | null | undefined) ?? null,
    supportedLanguages: Array.isArray(gm.supported_languages)
      ? (gm.supported_languages as string[])
      : undefined,
    genres: Array.isArray(gm.genres) ? (gm.genres as string[]) : undefined,
    lastPlayed: typeof gm.last_played === 'number' ? gm.last_played : undefined,
  }));
}

/**
 * Legge i giochi scansionati: dalla cache in memoria della Libreria se quella
 * pagina è già stata aperta in questa sessione, altrimenti dalla cache
 * IndexedDB `gs_library_games` (scritta dalla Libreria e dalla scansione di
 * avvio in MainLayout). Prima leggeva solo la cache in memoria, che fuori
 * dalla Libreria non esiste: il dialogo diceva quasi sempre "nessun gioco".
 */
export async function readLibraryGames(): Promise<FirstGameInput[]> {
  try {
    const cache = (globalThis as Record<string, unknown>).__gsLibCache as
      | { games?: { data?: Array<Record<string, unknown>> } }
      | undefined;
    const inMemory = cache?.games?.data;
    if (Array.isArray(inMemory) && inMemory.length > 0) return toFirstGameInputs(inMemory);
    const { get } = await import('idb-keyval');
    const stored = await get<Array<Record<string, unknown>>>('gs_library_games');
    return Array.isArray(stored) ? toFirstGameInputs(stored) : [];
  } catch (e: unknown) {
    clientLogger.warn('[FirstGameFlow] lettura cache libreria fallita:', e);
    return [];
  }
}

/**
 * Ricava la lingua target come le schermate di traduzione (useDefaultTargetLang):
 * `translation.defaultTargetLang`, altrimenti la lingua dell'interfaccia.
 */
export function readTargetLanguage(uiLanguage: string): string {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    return settings?.translation?.defaultTargetLang || uiLanguage;
  } catch {
    return uiLanguage;
  }
}

export function FirstGameFlow() {
  const { t, language } = useTranslation() as unknown as { t: (k: string) => string; language: string };
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<FirstGameInput[]>([]);
  const hasGames = games.length > 0;
  const suggestion = useMemo(
    () => (open ? pickFirstGame(games, { targetLanguage: readTargetLanguage(language || 'it') }) : null),
    [open, games, language]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Gate: mostra una sola volta.
    if (localStorage.getItem(DONE_KEY) === 'true') return;

    let cancelled = false;
    const loadGames = () => {
      readLibraryGames().then((list) => {
        if (!cancelled) setGames(list);
      });
    };
    // La scansione di avvio (MainLayout) può finire con il dialogo già aperto.
    window.addEventListener('gs-library-updated', loadGames);

    // Solo dopo Termini, wizard (lingua) e tour: non sovrapporsi al primo avvio.
    // Piccolo ritardo per non competere con altri overlay.
    const stopWaiting = whenReady(
      () => isTosAccepted() && isOnboardingDone() && isTutorialDone(),
      () => {
        readLibraryGames().then((list) => {
          if (cancelled) return;
          setGames(list);
          setOpen(true);
        });
      },
      1200
    );

    return () => {
      cancelled = true;
      stopWaiting();
      window.removeEventListener('gs-library-updated', loadGames);
    };
  }, []);

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, 'true');
    } catch {
      /* no-op */
    }
    setOpen(false);
  }, []);

  const goToGame = useCallback(() => {
    if (!suggestion) return;
    const g = suggestion.game;
    const params = new URLSearchParams();
    params.set('id', g.id);
    params.set('name', g.title);
    if (g.installDir) params.set('installDir', g.installDir);
    params.set('installed', 'true');
    params.set('firstGame', '1'); // segnala l'arrivo dal flusso onboarding
    markDone();
    window.location.href = `/library/?${params.toString()}`;
  }, [suggestion, markDone]);

  const goToLibrary = useCallback(() => {
    markDone();
    window.location.href = '/library/';
  }, [markDone]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) markDone(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Rocket className="h-5 w-5 text-purple-400" />
            {t('firstGame.title')}
          </DialogTitle>
          <DialogDescription>{t('firstGame.subtitle')}</DialogDescription>
        </DialogHeader>

        {suggestion ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-teal-400" />
                {t('firstGame.pickedForYou')}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-violet-400" />
                <span className="text-lg font-semibold">{suggestion.game.title}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {suggestion.engineLabel ? <Badge variant="secondary">{suggestion.engineLabel}</Badge> : null}
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('firstGame.estMinutes').replace('{min}', String(suggestion.estimatedMinutes))}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {t(`firstGame.reason.${suggestion.reasonKey}`)}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={goToGame} className="flex-1">
                {t('firstGame.translateNow')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToLibrary}>
                <Library className="mr-1 h-4 w-4" />
                {t('firstGame.chooseAnother')}
              </Button>
            </div>
            <button
              type="button"
              onClick={markDone}
              className="mx-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t('firstGame.later')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {hasGames ? t('firstGame.noEasyGame') : t('firstGame.noGames')}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={goToLibrary} className="flex-1">
                <Library className="mr-1 h-4 w-4" />
                {t('firstGame.scanLibrary')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={markDone}>
                {t('firstGame.later')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default FirstGameFlow;
