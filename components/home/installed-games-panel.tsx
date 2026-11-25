'use client';

import Link from 'next/link';
import { Gamepad2, Sparkles, ArrowRight } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import { getGameDetailUrl, type GameDetailUrlInput } from '@/lib/game-detail-url';

export interface HomeGame extends GameDetailUrlInput {
  engine?: string | null;
}

const MAX_SHOWN = 12;

/**
 * La home parte dai giochi installati, ognuno con il suo String it: è la
 * promessa del prodotto, prima stava sotto un feed di notizie.
 */
export function InstalledGamesPanel({ games, loading }: { games: HomeGame[]; loading: boolean }) {
  const { t } = useTranslation();
  const shown = games.slice(0, MAX_SHOWN);

  return (
    <section className="flex-[3] flex flex-col min-h-0 border-r border-noir-700/40" aria-labelledby="home-games-title">
      <header className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-noir-700/40">
        <h2 id="home-games-title" className="font-mono text-xs uppercase tracking-wider text-noir-300">
          {t('homeGames.title')}
          {games.length > 0 && <span className="ml-2 text-noir-500">{games.length}</span>}
        </h2>
        <Link href="/library" className="inline-flex items-center gap-1 text-2xs text-noir-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge-300 rounded">
          {t('homeGames.fullLibrary')} <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading && games.length === 0 ? (
          <p className="text-xs text-noir-500">{t('homeGames.loading')}</p>
        ) : games.length === 0 ? (
          <div className="max-w-md space-y-2 text-xs text-noir-400">
            <p>{t('homeGames.empty')}</p>
            <Link href="/stores" className="glass-red inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge-300">
              {t('homeGames.connectStores')}
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {shown.map((game) => {
              const url = getGameDetailUrl(game);
              return (
                <li key={`${game.platform}-${game.id || game.app_id}`} className="flex flex-col rounded-md border border-noir-800 bg-noir-900/60 overflow-hidden">
                  <Link href={url} className="block aspect-[16/9] bg-noir-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge-300">
                    {game.header_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={game.header_image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center"><Gamepad2 className="h-6 w-6 text-noir-600" aria-hidden="true" /></span>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-noir-200" title={game.title ?? ''}>{game.title}</p>
                      {game.engine && game.engine !== 'Unknown' && <p className="truncate font-mono text-micro text-noir-500">{game.engine}</p>}
                    </div>
                    <Link
                      href={`${url}&stringit=1`}
                      className="glass-red shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge-300"
                      aria-label={`${t('common.stringIt')}: ${game.title ?? ''}`}
                    >
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      {t('common.stringIt')}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {games.length > MAX_SHOWN && (
          <Link href="/library" className="mt-3 inline-flex items-center gap-1 text-2xs text-noir-400 hover:text-white">
            {t('homeGames.more').replace('{n}', String(games.length - MAX_SHOWN))} <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
